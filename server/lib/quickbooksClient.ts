// ── QuickBooks Online Client ──
// OAuth2 flow, token management, Estimate CRUD, Invoice conversion.
// Adapted from s2p-platform/server/quickbooks-client.ts — focused on the
// scoping → quote → estimate → invoice pipeline.

import { db } from '../db.js';
import { qboTokens } from '../../shared/schema/db.js';
import { eq } from 'drizzle-orm';

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

function getBaseUrl(): string {
    return process.env.QBO_ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
}

interface QBTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    token_type: string;
}

export interface QBEstimateLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

export interface QBEstimateResult {
    estimateId: string;
    estimateNumber: string;
    customerId: string;
    totalAmount: number;
}

class QuickBooksClient {
    private get clientId(): string {
        return process.env.QBO_CLIENT_ID || '';
    }
    private get clientSecret(): string {
        return process.env.QBO_CLIENT_SECRET || '';
    }
    private get redirectUri(): string {
        return process.env.QBO_REDIRECT_URI || '';
    }

    private get basicAuth(): string {
        return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    }

    // ── Configuration ──

    isConfigured(): boolean {
        return !!(this.clientId && this.clientSecret && this.redirectUri);
    }

    getConfig() {
        return {
            hasClientId: !!this.clientId,
            hasClientSecret: !!this.clientSecret,
            hasRedirectUri: !!this.redirectUri,
            environment: process.env.QBO_ENVIRONMENT || 'sandbox',
        };
    }

    // ── OAuth2 ──

    getAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            scope: 'com.intuit.quickbooks.accounting',
            redirect_uri: this.redirectUri,
            state,
        });
        return `${QB_AUTH_URL}?${params.toString()}`;
    }

    async exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
        const response = await fetch(QB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${this.basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to exchange code: ${error}`);
        }

        const data: QBTokenResponse = await response.json();
        await this.saveTokens(data, realmId);
    }

    // ── Token Management ──

    private async saveTokens(data: QBTokenResponse, realmId: string): Promise<void> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + data.expires_in * 1000);
        const refreshExpiresAt = new Date(now.getTime() + data.x_refresh_token_expires_in * 1000);

        const existing = await db.select().from(qboTokens).limit(1);

        if (existing.length > 0) {
            await db.update(qboTokens)
                .set({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    realmId,
                    expiresAt,
                    refreshExpiresAt,
                    updatedAt: now,
                })
                .where(eq(qboTokens.id, existing[0].id));
        } else {
            await db.insert(qboTokens).values({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                realmId,
                expiresAt,
                refreshExpiresAt,
            });
        }
    }

    async getValidToken(): Promise<{ accessToken: string; realmId: string } | null> {
        const tokens = await db.select().from(qboTokens).limit(1);
        if (tokens.length === 0) return null;

        const token = tokens[0];
        const now = new Date();

        // Access token expired — try refresh
        if (token.expiresAt <= now) {
            if (token.refreshExpiresAt <= now) {
                // Refresh token also expired — need re-auth
                await db.delete(qboTokens).where(eq(qboTokens.id, token.id));
                return null;
            }
            await this.refreshAccessToken(token.refreshToken, token.realmId);
            const refreshed = await db.select().from(qboTokens).limit(1);
            return refreshed.length > 0
                ? { accessToken: refreshed[0].accessToken, realmId: refreshed[0].realmId }
                : null;
        }

        return { accessToken: token.accessToken, realmId: token.realmId };
    }

    private async refreshAccessToken(refreshToken: string, realmId: string): Promise<void> {
        const response = await fetch(QB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${this.basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to refresh token: ${error}`);
        }

        const data: QBTokenResponse = await response.json();
        await this.saveTokens(data, realmId);
    }

    async isConnected(): Promise<boolean> {
        const token = await this.getValidToken();
        return token !== null;
    }

    async getRealmId(): Promise<string | null> {
        const tokens = await db.select().from(qboTokens).limit(1);
        return tokens.length > 0 ? tokens[0].realmId : null;
    }

    async disconnect(): Promise<void> {
        const tokens = await db.select().from(qboTokens).limit(1);
        if (tokens.length > 0) {
            // Revoke token at Intuit
            try {
                await fetch(QB_REVOKE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Basic ${this.basicAuth}`,
                    },
                    body: JSON.stringify({ token: tokens[0].refreshToken }),
                });
            } catch {
                // Best-effort revocation
            }
        }
        await db.delete(qboTokens);
    }

    // ── API Helpers ──

    private async apiRequest(method: string, path: string, body?: object): Promise<any> {
        const token = await this.getValidToken();
        if (!token) throw new Error('QuickBooks not connected');

        const url = `${getBaseUrl()}/v3/company/${token.realmId}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token.accessToken}`,
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`QBO API error (${response.status}): ${error}`);
        }

        return response.json();
    }

    private async query(sql: string): Promise<any> {
        const token = await this.getValidToken();
        if (!token) throw new Error('QuickBooks not connected');

        const url = `${getBaseUrl()}/v3/company/${token.realmId}/query?query=${encodeURIComponent(sql)}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token.accessToken}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`QBO query error: ${error}`);
        }

        return response.json();
    }

    // ── Customer ──

    async findOrCreateCustomer(clientName: string, email?: string): Promise<{ id: string; name: string }> {
        // Search for existing customer — escape single quotes per QBO query spec (double them)
        const escapedName = clientName.replace(/'/g, "''");
        const searchQuery = `SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`;
        const result = await this.query(searchQuery);
        const existing = result.QueryResponse?.Customer;

        if (existing && existing.length > 0) {
            return { id: existing[0].Id, name: existing[0].DisplayName };
        }

        // Create new customer
        const customerData: any = {
            DisplayName: clientName,
        };
        if (email) {
            customerData.PrimaryEmailAddr = { Address: email };
        }

        const created = await this.apiRequest('POST', '/customer', customerData);
        return { id: created.Customer.Id, name: created.Customer.DisplayName };
    }

    // ── Estimates ──

    async createEstimate(
        customerName: string,
        projectName: string,
        lineItems: QBEstimateLineItem[],
        email?: string,
    ): Promise<QBEstimateResult> {
        const customer = await this.findOrCreateCustomer(customerName, email);

        const estimateData = {
            CustomerRef: { value: customer.id },
            TxnDate: new Date().toISOString().split('T')[0],
            ExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            CustomerMemo: { value: projectName },
            Line: lineItems.map((item, i) => ({
                LineNum: i + 1,
                Description: item.description,
                Amount: item.amount,
                DetailType: 'SalesItemLineDetail',
                SalesItemLineDetail: {
                    UnitPrice: item.unitPrice,
                    Qty: item.quantity,
                },
            })),
        };

        // Send email if provided
        if (email) {
            (estimateData as any).BillEmail = { Address: email };
        }

        const result = await this.apiRequest('POST', '/estimate', estimateData);
        const estimate = result.Estimate;

        return {
            estimateId: estimate.Id,
            estimateNumber: estimate.DocNumber || estimate.Id,
            customerId: customer.id,
            totalAmount: estimate.TotalAmt,
        };
    }

    async getEstimate(estimateId: string): Promise<any> {
        const result = await this.apiRequest('GET', `/estimate/${estimateId}`);
        return result.Estimate;
    }

    getEstimateUrl(estimateId: string, realmId: string): string {
        const base = process.env.QBO_ENVIRONMENT === 'production'
            ? 'https://app.qbo.intuit.com'
            : 'https://app.sandbox.qbo.intuit.com';
        return `${base}/app/estimate?txnId=${estimateId}&companyId=${realmId}`;
    }

    // ── Invoices ──

    async convertEstimateToInvoice(estimateId: string): Promise<{ invoiceId: string; invoiceNumber: string }> {
        // Fetch the estimate first
        const estimate = await this.getEstimate(estimateId);

        // Filter out SubTotalLineDetail — QBO auto-adds subtotal lines that shouldn't be duplicated
        const filteredLines = (estimate.Line || []).filter(
            (line: any) => line.DetailType !== 'SubTotalLineDetail'
        );

        const invoiceData = {
            CustomerRef: estimate.CustomerRef,
            TxnDate: new Date().toISOString().split('T')[0],
            CustomerMemo: estimate.CustomerMemo,
            BillEmail: estimate.BillEmail,
            Line: filteredLines,
            // Link back to estimate
            LinkedTxn: [{
                TxnId: estimateId,
                TxnType: 'Estimate',
            }],
        };

        const result = await this.apiRequest('POST', '/invoice', invoiceData);
        const invoice = result.Invoice;

        return {
            invoiceId: invoice.Id,
            invoiceNumber: invoice.DocNumber || invoice.Id,
        };
    }

    async getInvoice(invoiceId: string): Promise<any> {
        const result = await this.apiRequest('GET', `/invoice/${invoiceId}`);
        return result.Invoice;
    }

    // ── Email ──

    async emailEstimate(estimateId: string, email: string): Promise<void> {
        await this.apiRequest('POST', `/estimate/${estimateId}/send?sendTo=${encodeURIComponent(email)}`, {});
    }

    async emailInvoice(invoiceId: string, email: string): Promise<void> {
        await this.apiRequest('POST', `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`, {});
    }
}

// Singleton
export const quickbooksClient = new QuickBooksClient();
