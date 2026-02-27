// ── S2PX Financial Data Types (Phase 15) ──
// Response types for QBO financial API endpoints

// ── Actual Revenue (from qbo_sales_transactions) ──

export interface MonthlyActualRevenue {
    month: string;          // YYYY-MM
    revenue: number;        // sum of amounts
    transactionCount: number;
}

export interface ActualRevenueData {
    totalRevenue: number;
    ytdRevenue: number;
    monthlyRevenue: MonthlyActualRevenue[];
    topCustomers: { customerName: string; revenue: number; transactionCount: number }[];
    revenueByType: { type: string; total: number }[];
}

// ── P&L Summary (from qbo_pnl_monthly) ──

export interface PnlMonthlyRow {
    month: string;          // YYYY-MM
    income: number;
    cogs: number;
    expenses: number;
    otherIncome: number;
    otherExpenses: number;
    netIncome: number;
}

export interface PnlAccountDetail {
    account: string;
    category: string;
    total: number;
    monthly: { month: string; amount: number }[];
}

export interface PnlSummary {
    totalIncome: number;
    totalCOGS: number;
    totalExpenses: number;
    totalOtherIncome: number;
    totalOtherExpenses: number;
    netIncome: number;
    monthlyPnl: PnlMonthlyRow[];
    accountDetails: PnlAccountDetail[];
}

// ── Expenses Summary (from qbo_expenses_by_vendor) ──

export interface VendorExpense {
    vendor: string;
    totalAllTime: number;
    totalTrailing12mo: number;
}

export interface ExpenseSummaryData {
    totalAllTime: number;
    totalTrailing12mo: number;
    topVendors: VendorExpense[];
    vendorCount: number;
}

// ── QBO Customer Summary (from qbo_customers + revenue join) ──

export interface QBOCustomerSummary {
    id: number;
    customerName: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    totalRevenue: number;
    transactionCount: number;
    estimateCount: number;
    lastTransactionDate: string | null;
}

export interface QBOCustomerListData {
    customers: QBOCustomerSummary[];
    totalCustomers: number;
    activeCustomers: number;      // customers with transactions in last 12 months
}

// ── Estimate Conversion (from qbo_estimates) ──

export interface EstimateConversionData {
    totalEstimates: number;
    acceptedCount: number;
    invoicedCount: number;
    pendingCount: number;
    conversionRate: number;        // accepted / total
    totalEstimateValue: number;
    totalInvoicedValue: number;
    monthlyEstimates: { month: string; count: number; totalValue: number; acceptedCount: number }[];
}

// ── Balance Sheet (from qbo_balance_sheet) ──

export interface BalanceSheetItem {
    account: string;
    category: string;           // Assets | Liabilities | Equity
    subcategory: string | null; // Current Assets, Fixed Assets, etc.
    total: number;
}

export interface BalanceSheetData {
    snapshotDate: string;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    items: BalanceSheetItem[];
}
