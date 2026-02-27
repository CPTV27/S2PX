CREATE TABLE "chat_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"emoji" text DEFAULT '💬',
	"is_default" boolean DEFAULT false,
	"google_chat_webhook_url" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_channels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"about_scan2plan" text,
	"why_scan2plan" text,
	"capabilities" text,
	"difference" text,
	"bim_standards_intro" text,
	"payment_terms_default" text,
	"sf_audit_clause" text,
	"contact_email" text DEFAULT 'admin@scan2plan.io',
	"contact_phone" text DEFAULT '(518) 362-2403',
	"footer_text" text,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_balance_sheet" (
	"id" serial PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"account_category" text,
	"account_subcategory" text,
	"total" numeric(14, 2) NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"bill_address" text,
	"ship_address" text,
	"first_name" text,
	"last_name" text,
	"website" text,
	"terms" text,
	"note" text,
	"qbo_created_on" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qbo_customers_customer_name_unique" UNIQUE("customer_name")
);
--> statement-breakpoint
CREATE TABLE "qbo_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"estimate_date" timestamp NOT NULL,
	"num" text,
	"status" text,
	"accepted_on" timestamp,
	"accepted_by" text,
	"invoice_number" text,
	"amount" numeric(12, 2) NOT NULL,
	"bill_to" text,
	"message" text,
	"subject" text,
	"description" text,
	"qbo_created_on" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_expenses_by_vendor" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_pnl_monthly" (
	"id" serial PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"account_category" text,
	"month" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_sales_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"transaction_type" text NOT NULL,
	"num" text,
	"description" text,
	"quantity" numeric(12, 2),
	"sales_price" numeric(12, 2),
	"amount" numeric(12, 2) NOT NULL,
	"balance" numeric(12, 2),
	"account_name" text,
	"product_service" text,
	"subject" text,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"parent_id" integer,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scoping_forms" ADD COLUMN "mileage_rate" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "scoping_forms" ADD COLUMN "scan_day_fee" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_estimates" ADD CONSTRAINT "qbo_estimates_customer_id_qbo_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."qbo_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_sales_transactions" ADD CONSTRAINT "qbo_sales_transactions_customer_id_qbo_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."qbo_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qbo_pnl_account_month_idx" ON "qbo_pnl_monthly" USING btree ("account","month");