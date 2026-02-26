CREATE TABLE "kb_edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"previous_content" text NOT NULL,
	"new_content" text NOT NULL,
	"edited_by" text NOT NULL,
	"edit_summary" text,
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"part_number" integer,
	"part_title" text,
	"section_number" integer,
	"sort_order" integer NOT NULL,
	"content" text NOT NULL,
	"content_plain" text NOT NULL,
	"word_count" integer DEFAULT 0,
	"edited_by" text,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kb_sections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "production_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoping_form_id" integer NOT NULL,
	"upid" text NOT NULL,
	"current_stage" text NOT NULL,
	"stage_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_project_id" integer NOT NULL,
	"bucket" text NOT NULL,
	"gcs_path" text NOT NULL,
	"label" text,
	"asset_type" text DEFAULT 'folder' NOT NULL,
	"file_count" integer,
	"total_size_bytes" text,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"linked_by" text
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoping_form_id" integer NOT NULL,
	"quote_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"access_token" text NOT NULL,
	"custom_message" text,
	"sent_to" text,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"responded_at" timestamp,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoping_form_id" integer NOT NULL,
	"line_items" jsonb NOT NULL,
	"totals" jsonb,
	"integrity_status" text,
	"version" integer DEFAULT 1,
	"qbo_estimate_id" text,
	"qbo_estimate_number" text,
	"qbo_customer_id" text,
	"qbo_invoice_id" text,
	"qbo_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoping_form_id" integer NOT NULL,
	"area_type" text NOT NULL,
	"area_name" text,
	"square_footage" integer NOT NULL,
	"project_scope" text NOT NULL,
	"lod" text NOT NULL,
	"mixed_interior_lod" text,
	"mixed_exterior_lod" text,
	"structural" jsonb,
	"mepf" jsonb,
	"cad_deliverable" text NOT NULL,
	"act" jsonb,
	"below_floor" jsonb,
	"custom_line_items" jsonb,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "scoping_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"upid" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"client_company" text NOT NULL,
	"project_name" text NOT NULL,
	"project_address" text NOT NULL,
	"project_lat" numeric(10, 7),
	"project_lng" numeric(11, 7),
	"building_footprint_sqft" integer,
	"specific_building" text,
	"email" text NOT NULL,
	"primary_contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"billing_same_as_primary" boolean DEFAULT true,
	"billing_contact_name" text,
	"billing_email" text,
	"billing_phone" text,
	"number_of_floors" integer NOT NULL,
	"basement_attic" jsonb,
	"est_sf_basement_attic" integer,
	"insurance_requirements" text,
	"landscape_modeling" text DEFAULT 'No',
	"landscape_acres" numeric(10, 2),
	"landscape_terrain" text,
	"bim_deliverable" text NOT NULL,
	"bim_version" text,
	"custom_template" boolean DEFAULT false,
	"template_file_url" text,
	"georeferencing" boolean NOT NULL,
	"era" text NOT NULL,
	"room_density" integer NOT NULL,
	"risk_factors" jsonb NOT NULL,
	"scan_reg_only" text DEFAULT 'none',
	"expedited" boolean NOT NULL,
	"dispatch_location" text NOT NULL,
	"one_way_miles" integer NOT NULL,
	"travel_mode" text NOT NULL,
	"custom_travel_cost" numeric(12, 2),
	"est_timeline" text,
	"project_timeline" text,
	"timeline_notes" text,
	"payment_terms" text,
	"payment_notes" text,
	"sf_assumptions_url" text,
	"sqft_assumptions_note" text,
	"scoping_docs_urls" jsonb,
	"internal_notes" text,
	"custom_scope" text,
	"lead_source" text NOT NULL,
	"source_note" text,
	"marketing_influence" jsonb,
	"proof_links" text,
	"probability" integer NOT NULL,
	"deal_stage" text NOT NULL,
	"priority" integer NOT NULL,
	"pricing_tier" text,
	"bim_manager" text,
	"scanner_assignment" text,
	"est_scan_days" integer,
	"techs_planned" integer,
	"m_override" numeric(10, 4),
	"whale_scan_cost" numeric(12, 2),
	"whale_model_cost" numeric(12, 2),
	"assumed_savings_m" numeric(10, 4),
	"caveats_profitability" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scoping_forms_upid_unique" UNIQUE("upid")
);
--> statement-breakpoint
CREATE TABLE "upload_share_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" integer NOT NULL,
	"filename" text NOT NULL,
	"gcs_path" text NOT NULL,
	"size_bytes" text NOT NULL,
	"content_type" text,
	"uploaded_by_name" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_project_id" integer NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"target_bucket" text NOT NULL,
	"target_prefix" text NOT NULL,
	"created_by" integer,
	"expires_at" timestamp NOT NULL,
	"max_upload_bytes" text,
	"total_uploaded_bytes" text DEFAULT '0',
	"upload_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "upload_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"profile_image_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
ALTER TABLE "kb_edit_history" ADD CONSTRAINT "kb_edit_history_section_id_kb_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."kb_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_projects" ADD CONSTRAINT "production_projects_scoping_form_id_scoping_forms_id_fk" FOREIGN KEY ("scoping_form_id") REFERENCES "public"."scoping_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_production_project_id_production_projects_id_fk" FOREIGN KEY ("production_project_id") REFERENCES "public"."production_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_scoping_form_id_scoping_forms_id_fk" FOREIGN KEY ("scoping_form_id") REFERENCES "public"."scoping_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_scoping_form_id_scoping_forms_id_fk" FOREIGN KEY ("scoping_form_id") REFERENCES "public"."scoping_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_areas" ADD CONSTRAINT "scope_areas_scoping_form_id_scoping_forms_id_fk" FOREIGN KEY ("scoping_form_id") REFERENCES "public"."scoping_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_share_files" ADD CONSTRAINT "upload_share_files_share_id_upload_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."upload_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_shares" ADD CONSTRAINT "upload_shares_production_project_id_production_projects_id_fk" FOREIGN KEY ("production_project_id") REFERENCES "public"."production_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_shares" ADD CONSTRAINT "upload_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;