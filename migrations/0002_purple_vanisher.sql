CREATE TABLE "field_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_project_id" integer NOT NULL,
	"uploaded_by" integer,
	"filename" text NOT NULL,
	"gcs_path" text NOT NULL,
	"bucket" text NOT NULL,
	"size_bytes" text NOT NULL,
	"content_type" text,
	"file_category" text NOT NULL,
	"capture_method" text,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_checklist_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_project_id" integer NOT NULL,
	"checklist_id" integer NOT NULL,
	"responded_by" integer,
	"responses" jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"checklist_type" text NOT NULL,
	"items" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scan_checklists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "section_visibility" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "client_message" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "field_uploads" ADD CONSTRAINT "field_uploads_production_project_id_production_projects_id_fk" FOREIGN KEY ("production_project_id") REFERENCES "public"."production_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_uploads" ADD CONSTRAINT "field_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_checklist_responses" ADD CONSTRAINT "scan_checklist_responses_production_project_id_production_projects_id_fk" FOREIGN KEY ("production_project_id") REFERENCES "public"."production_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_checklist_responses" ADD CONSTRAINT "scan_checklist_responses_checklist_id_scan_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."scan_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_checklist_responses" ADD CONSTRAINT "scan_checklist_responses_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;