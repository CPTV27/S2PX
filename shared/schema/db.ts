// ── S2PX Database Schema (Drizzle ORM) ──
// All tables needed through Phase 6 — defined upfront so we migrate once.

import {
    pgTable,
    serial,
    text,
    integer,
    boolean,
    timestamp,
    numeric,
    jsonb,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Users ──
// Firebase-authenticated users with app roles
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    firebaseUid: text('firebase_uid').notNull().unique(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    profileImageUrl: text('profile_image_url'),
    role: text('role').notNull().default('user'), // user | admin | ceo
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Scoping Forms ──
// One row per deal. The 78-field entry point for every project.
export const scopingForms = pgTable('scoping_forms', {
    id: serial('id').primaryKey(),
    upid: text('upid').notNull().unique(), // "S2P-[SEQ]-[YEAR]"
    status: text('status').notNull().default('draft'),

    // Section A — Project Identification
    clientCompany: text('client_company').notNull(),
    projectName: text('project_name').notNull(),
    projectAddress: text('project_address').notNull(),
    projectLat: numeric('project_lat', { precision: 10, scale: 7 }),
    projectLng: numeric('project_lng', { precision: 11, scale: 7 }),
    buildingFootprintSqft: integer('building_footprint_sqft'),
    specificBuilding: text('specific_building'),
    email: text('email').notNull(),

    // Section B — Contacts
    primaryContactName: text('primary_contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone'),
    billingSameAsPrimary: boolean('billing_same_as_primary').default(true),
    billingContactName: text('billing_contact_name'),
    billingEmail: text('billing_email'),
    billingPhone: text('billing_phone'),

    // Section C — Building Characteristics
    numberOfFloors: integer('number_of_floors').notNull(),
    basementAttic: jsonb('basement_attic').$type<string[]>(), // ["Basement","Attic"]
    estSfBasementAttic: integer('est_sf_basement_attic'),
    insuranceRequirements: text('insurance_requirements'),

    // Section E — Landscape
    landscapeModeling: text('landscape_modeling').default('No'),
    landscapeAcres: numeric('landscape_acres', { precision: 10, scale: 2 }),
    landscapeTerrain: text('landscape_terrain'),

    // Section F — Deliverable Format
    bimDeliverable: text('bim_deliverable').notNull(),
    bimVersion: text('bim_version'),
    customTemplate: boolean('custom_template').default(false),
    templateFileUrl: text('template_file_url'),
    georeferencing: boolean('georeferencing').notNull(),

    // Section G — Site Conditions
    era: text('era').notNull(),
    roomDensity: integer('room_density').notNull(),
    riskFactors: jsonb('risk_factors').$type<string[]>().notNull(),

    // Section H — Additional Services
    scanRegOnly: text('scan_reg_only').default('none'),
    expedited: boolean('expedited').notNull(),

    // Section I — Travel
    dispatchLocation: text('dispatch_location').notNull(),
    oneWayMiles: integer('one_way_miles').notNull(),
    travelMode: text('travel_mode').notNull(),
    customTravelCost: numeric('custom_travel_cost', { precision: 12, scale: 2 }),

    // Section M — Timeline & Payment
    estTimeline: text('est_timeline'),
    projectTimeline: text('project_timeline'),
    timelineNotes: text('timeline_notes'),
    paymentTerms: text('payment_terms'),
    paymentNotes: text('payment_notes'),

    // Section N — Documentation
    sfAssumptionsUrl: text('sf_assumptions_url'),
    sqftAssumptionsNote: text('sqft_assumptions_note'),
    scopingDocsUrls: jsonb('scoping_docs_urls').$type<string[]>(),
    internalNotes: text('internal_notes'),
    customScope: text('custom_scope'),

    // Section O — Attribution & Pipeline
    leadSource: text('lead_source').notNull(),
    sourceNote: text('source_note'),
    marketingInfluence: jsonb('marketing_influence').$type<string[]>(),
    proofLinks: text('proof_links'),
    probability: integer('probability').notNull(),
    dealStage: text('deal_stage').notNull(),
    priority: integer('priority').notNull(),

    // CEO Sections (J, K, L) — editable only by CEO/Sales role
    pricingTier: text('pricing_tier'),
    bimManager: text('bim_manager'),
    scannerAssignment: text('scanner_assignment'),
    estScanDays: integer('est_scan_days'),
    techsPlanned: integer('techs_planned'),
    mOverride: numeric('m_override', { precision: 10, scale: 4 }),
    whaleScanCost: numeric('whale_scan_cost', { precision: 12, scale: 2 }),
    whaleModelCost: numeric('whale_model_cost', { precision: 12, scale: 2 }),
    assumedSavingsM: numeric('assumed_savings_m', { precision: 10, scale: 4 }),
    caveatsProfitability: text('caveats_profitability'),

    // Meta
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Scope Areas ──
// Repeatable Section D blocks (1:N with scoping_forms)
export const scopeAreas = pgTable('scope_areas', {
    id: serial('id').primaryKey(),
    scopingFormId: integer('scoping_form_id')
        .notNull()
        .references(() => scopingForms.id, { onDelete: 'cascade' }),

    areaType: text('area_type').notNull(), // 13 building types
    areaName: text('area_name'),
    squareFootage: integer('square_footage').notNull(),
    projectScope: text('project_scope').notNull(), // Full / Int Only / Ext Only / Mixed
    lod: text('lod').notNull(), // 200 / 300 / 350
    mixedInteriorLod: text('mixed_interior_lod'), // Conditional: scope = Mixed
    mixedExteriorLod: text('mixed_exterior_lod'), // Conditional: scope = Mixed

    structural: jsonb('structural').$type<{ enabled: boolean; sqft?: number }>(),
    mepf: jsonb('mepf').$type<{ enabled: boolean; sqft?: number }>(),
    cadDeliverable: text('cad_deliverable').notNull(), // No / Basic / A+S+Site / Full
    act: jsonb('act').$type<{ enabled: boolean; sqft?: number }>(),
    belowFloor: jsonb('below_floor').$type<{ enabled: boolean; sqft?: number }>(),
    customLineItems: jsonb('custom_line_items').$type<{ description: string; amount: number }[]>(),

    sortOrder: integer('sort_order').default(0),
});

// ── Quotes ──
// Priced line items from CEO
export const quotes = pgTable('quotes', {
    id: serial('id').primaryKey(),
    scopingFormId: integer('scoping_form_id')
        .notNull()
        .references(() => scopingForms.id),

    lineItems: jsonb('line_items').notNull(), // LineItemShell[]
    totals: jsonb('totals'), // QuoteTotals
    integrityStatus: text('integrity_status'), // passed | warning | blocked
    version: integer('version').default(1),

    // QBO sync tracking
    qboEstimateId: text('qbo_estimate_id'),
    qboEstimateNumber: text('qbo_estimate_number'),
    qboCustomerId: text('qbo_customer_id'),
    qboInvoiceId: text('qbo_invoice_id'),
    qboSyncedAt: timestamp('qbo_synced_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Proposals ──
// Generated PDF proposals sent to clients
export const proposals = pgTable('proposals', {
    id: serial('id').primaryKey(),
    scopingFormId: integer('scoping_form_id')
        .notNull()
        .references(() => scopingForms.id),
    quoteId: integer('quote_id')
        .notNull()
        .references(() => quotes.id),

    status: text('status').notNull().default('draft'), // draft | sent | viewed | accepted | rejected
    pdfUrl: text('pdf_url'), // GCS URL for generated PDF
    accessToken: text('access_token').notNull(), // magic link token for client portal
    customMessage: text('custom_message'), // optional cover note
    sentTo: text('sent_to'), // email address proposal was sent to
    sentAt: timestamp('sent_at'),
    viewedAt: timestamp('viewed_at'),
    respondedAt: timestamp('responded_at'),
    version: integer('version').default(1),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── QBO Tokens ──
// QuickBooks OAuth2 credentials
export const qboTokens = pgTable('qbo_tokens', {
    id: serial('id').primaryKey(),
    realmId: text('realm_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    refreshExpiresAt: timestamp('refresh_expires_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Production Projects ──
// Stage tracking (Phase 6)
export const productionProjects = pgTable('production_projects', {
    id: serial('id').primaryKey(),
    scopingFormId: integer('scoping_form_id')
        .notNull()
        .references(() => scopingForms.id),
    upid: text('upid').notNull(),
    currentStage: text('current_stage').notNull(), // scheduling | field_capture | registration | bim_qc | pc_delivery | final_delivery
    stageData: jsonb('stage_data').notNull(), // per-stage field values

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Project Assets ──
// GCS paths linked to production projects (Phase 8)
export const projectAssets = pgTable('project_assets', {
    id: serial('id').primaryKey(),
    productionProjectId: integer('production_project_id')
        .notNull()
        .references(() => productionProjects.id, { onDelete: 'cascade' }),
    bucket: text('bucket').notNull(), // 's2p-active-projects', 's2p-incoming-staging', etc.
    gcsPath: text('gcs_path').notNull(), // root folder or file path
    label: text('label'), // human-readable label
    assetType: text('asset_type').notNull().default('folder'), // folder | file
    fileCount: integer('file_count'), // cached count (null = not scanned yet)
    totalSizeBytes: text('total_size_bytes'), // stored as text to handle bigint
    linkedAt: timestamp('linked_at').defaultNow().notNull(),
    linkedBy: text('linked_by'),
});

// ── Relations ──

export const scopingFormsRelations = relations(scopingForms, ({ many }) => ({
    areas: many(scopeAreas),
    quotes: many(quotes),
    proposals: many(proposals),
    productionProjects: many(productionProjects),
}));

export const scopeAreasRelations = relations(scopeAreas, ({ one }) => ({
    scopingForm: one(scopingForms, {
        fields: [scopeAreas.scopingFormId],
        references: [scopingForms.id],
    }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
    scopingForm: one(scopingForms, {
        fields: [quotes.scopingFormId],
        references: [scopingForms.id],
    }),
    proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
    scopingForm: one(scopingForms, {
        fields: [proposals.scopingFormId],
        references: [scopingForms.id],
    }),
    quote: one(quotes, {
        fields: [proposals.quoteId],
        references: [quotes.id],
    }),
}));

export const productionProjectsRelations = relations(productionProjects, ({ one, many }) => ({
    scopingForm: one(scopingForms, {
        fields: [productionProjects.scopingFormId],
        references: [scopingForms.id],
    }),
    assets: many(projectAssets),
}));

export const projectAssetsRelations = relations(projectAssets, ({ one }) => ({
    productionProject: one(productionProjects, {
        fields: [projectAssets.productionProjectId],
        references: [productionProjects.id],
    }),
}));

// ── Knowledge Base Sections ──
// Stores the MKB v4 content as editable sections with FTS support.
export const kbSections = pgTable('kb_sections', {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    emoji: text('emoji'),
    partNumber: integer('part_number'),
    partTitle: text('part_title'),
    sectionNumber: integer('section_number'),
    sortOrder: integer('sort_order').notNull(),
    content: text('content').notNull(),
    contentPlain: text('content_plain').notNull(),
    wordCount: integer('word_count').default(0),
    editedBy: text('edited_by'),
    version: integer('version').default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Knowledge Base Edit History ──
export const kbEditHistory = pgTable('kb_edit_history', {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id').notNull().references(() => kbSections.id, { onDelete: 'cascade' }),
    previousContent: text('previous_content').notNull(),
    newContent: text('new_content').notNull(),
    editedBy: text('edited_by').notNull(),
    editSummary: text('edit_summary'),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kbSectionsRelations = relations(kbSections, ({ many }) => ({
    editHistory: many(kbEditHistory),
}));

export const kbEditHistoryRelations = relations(kbEditHistory, ({ one }) => ({
    section: one(kbSections, {
        fields: [kbEditHistory.sectionId],
        references: [kbSections.id],
    }),
}));

// ── Upload Shares ──
// Token-based upload links for external team members (no login required).
export const uploadShares = pgTable('upload_shares', {
    id: serial('id').primaryKey(),
    productionProjectId: integer('production_project_id')
        .notNull()
        .references(() => productionProjects.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    label: text('label'),
    targetBucket: text('target_bucket').notNull(),
    targetPrefix: text('target_prefix').notNull(),
    createdBy: integer('created_by').references(() => users.id),
    expiresAt: timestamp('expires_at').notNull(),
    maxUploadBytes: text('max_upload_bytes'), // stored as text for bigint
    totalUploadedBytes: text('total_uploaded_bytes').default('0'),
    uploadCount: integer('upload_count').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Upload Share Files ──
// Individual files uploaded through a share link.
export const uploadShareFiles = pgTable('upload_share_files', {
    id: serial('id').primaryKey(),
    shareId: integer('share_id')
        .notNull()
        .references(() => uploadShares.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    gcsPath: text('gcs_path').notNull(),
    sizeBytes: text('size_bytes').notNull(), // text for bigint
    contentType: text('content_type'),
    uploadedByName: text('uploaded_by_name'),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const uploadSharesRelations = relations(uploadShares, ({ one, many }) => ({
    productionProject: one(productionProjects, {
        fields: [uploadShares.productionProjectId],
        references: [productionProjects.id],
    }),
    createdByUser: one(users, {
        fields: [uploadShares.createdBy],
        references: [users.id],
    }),
    files: many(uploadShareFiles),
}));

export const uploadShareFilesRelations = relations(uploadShareFiles, ({ one }) => ({
    share: one(uploadShares, {
        fields: [uploadShareFiles.shareId],
        references: [uploadShares.id],
    }),
}));

// ══════════════════════════════════════════════════════════════
// ── QBO Financial Data (Phase 15) ──
// Actual financial data ingested from QuickBooks CSV exports.
// ══════════════════════════════════════════════════════════════

// ── QBO Customers ──
// Normalized customer master from QBO Customer Contact List.
export const qboCustomers = pgTable('qbo_customers', {
    id: serial('id').primaryKey(),
    customerName: text('customer_name').notNull().unique(),
    company: text('company'),
    email: text('email'),
    phone: text('phone'),
    billAddress: text('bill_address'),
    shipAddress: text('ship_address'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    website: text('website'),
    terms: text('terms'),
    note: text('note'),
    qboCreatedOn: timestamp('qbo_created_on'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── QBO Sales Transactions ──
// Actual invoices and sales receipts from QBO — the real revenue data.
export const qboSalesTransactions = pgTable('qbo_sales_transactions', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').references(() => qboCustomers.id),
    customerName: text('customer_name').notNull(),
    transactionDate: timestamp('transaction_date').notNull(),
    transactionType: text('transaction_type').notNull(), // Invoice | Sales Receipt
    num: text('num'),
    description: text('description'),
    quantity: numeric('quantity', { precision: 12, scale: 2 }),
    salesPrice: numeric('sales_price', { precision: 12, scale: 2 }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    balance: numeric('balance', { precision: 12, scale: 2 }),
    accountName: text('account_name'),
    productService: text('product_service'),
    subject: text('subject'),
    message: text('message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── QBO Estimates ──
// Historical estimate data from QBO exports.
export const qboEstimates = pgTable('qbo_estimates', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').references(() => qboCustomers.id),
    customerName: text('customer_name').notNull(),
    estimateDate: timestamp('estimate_date').notNull(),
    num: text('num'),
    status: text('status'), // Pending | Accepted | Rejected | Closed
    acceptedOn: timestamp('accepted_on'),
    acceptedBy: text('accepted_by'),
    invoiceNumber: text('invoice_number'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    billTo: text('bill_to'),
    message: text('message'),
    subject: text('subject'),
    description: text('description'),
    qboCreatedOn: timestamp('qbo_created_on'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── QBO P&L Monthly ──
// Profit & Loss by month — pivoted from wide QBO export to tall format.
export const qboPnlMonthly = pgTable('qbo_pnl_monthly', {
    id: serial('id').primaryKey(),
    account: text('account').notNull(),
    accountCategory: text('account_category'), // Income | COGS | Expenses | Other Income | Other Expenses
    month: text('month').notNull(), // YYYY-MM
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('qbo_pnl_account_month_idx').on(table.account, table.month),
]);

// ── QBO Expenses by Vendor ──
// Vendor expense summaries (all-time and trailing 12mo).
export const qboExpensesByVendor = pgTable('qbo_expenses_by_vendor', {
    id: serial('id').primaryKey(),
    vendor: text('vendor').notNull(),
    total: numeric('total', { precision: 14, scale: 2 }).notNull(),
    period: text('period').notNull(), // all_time | trailing_12mo
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── QBO Balance Sheet ──
// Point-in-time balance sheet snapshot from QBO.
export const qboBalanceSheet = pgTable('qbo_balance_sheet', {
    id: serial('id').primaryKey(),
    account: text('account').notNull(),
    accountCategory: text('account_category'), // Assets | Liabilities | Equity
    accountSubcategory: text('account_subcategory'), // Current Assets | Bank Accounts | etc.
    total: numeric('total', { precision: 14, scale: 2 }).notNull(),
    snapshotDate: timestamp('snapshot_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── QBO Financial Relations ──
export const qboCustomersRelations = relations(qboCustomers, ({ many }) => ({
    salesTransactions: many(qboSalesTransactions),
    estimates: many(qboEstimates),
}));

export const qboSalesTransactionsRelations = relations(qboSalesTransactions, ({ one }) => ({
    customer: one(qboCustomers, {
        fields: [qboSalesTransactions.customerId],
        references: [qboCustomers.id],
    }),
}));

export const qboEstimatesRelations = relations(qboEstimates, ({ one }) => ({
    customer: one(qboCustomers, {
        fields: [qboEstimates.customerId],
        references: [qboCustomers.id],
    }),
}));

// ── Proposal Templates ──
// Editable boilerplate content for proposal PDF sections.
export const proposalTemplates = pgTable('proposal_templates', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().default('default'),
    aboutScan2plan: text('about_scan2plan'),
    whyScan2plan: text('why_scan2plan'),
    capabilities: text('capabilities'),
    difference: text('difference'),
    bimStandardsIntro: text('bim_standards_intro'),
    paymentTermsDefault: text('payment_terms_default'),
    sfAuditClause: text('sf_audit_clause'),
    contactEmail: text('contact_email').default('admin@scan2plan.io'),
    contactPhone: text('contact_phone').default('(518) 362-2403'),
    footerText: text('footer_text'),
    isActive: boolean('is_active').default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
