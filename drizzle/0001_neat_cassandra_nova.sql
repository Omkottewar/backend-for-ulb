CREATE TYPE "public"."attachment_category_enum" AS ENUM('mandatory', 'page', 'document');--> statement-breakpoint
CREATE TYPE "public"."attachment_file_type_enum" AS ENUM('image', 'pdf', 'word', 'excel', 'text', 'other');--> statement-breakpoint
CREATE TYPE "public"."attachment_storage_backend_enum" AS ENUM('local', 's3', 'azure_blob');--> statement-breakpoint
CREATE TYPE "public"."file_status_enum" AS ENUM('Created', 'Under Review', 'Finalized', 'Pre-Audit');--> statement-breakpoint
CREATE TYPE "public"."risk_flag_enum" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."response_type_enum" AS ENUM('yes_no', 'yes_no_na', 'doc_pending_na', 'text', 'number');--> statement-breakpoint
CREATE TYPE "public"."checklist_status_enum" AS ENUM('Draft', 'In Progress', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."query_priority_enum" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."query_status_enum" AS ENUM('Open', 'In Progress', 'Resolved');--> statement-breakpoint
CREATE TYPE "public"."query_action_type_enum" AS ENUM('created', 'assigned', 'replied', 'participant', 'status', 'resolved');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(20),
	"approve" boolean DEFAULT false,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"category" "attachment_category_enum" NOT NULL,
	"slot" varchar(20),
	"file_name" varchar(500) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(100),
	"file_type" "attachment_file_type_enum",
	"storage_path" text,
	"storage_backend" "attachment_storage_backend_enum" DEFAULT 'local' NOT NULL,
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "contract_types_name_unique" UNIQUE("name"),
	CONSTRAINT "contract_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "file_version_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"field_label" varchar(200) NOT NULL,
	"old_value" text,
	"new_value" text
);
--> statement-breakpoint
CREATE TABLE "file_version_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_by_role" varchar(100),
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_number" varchar(50) NOT NULL,
	"file_title" varchar(500) NOT NULL,
	"ulb_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"contract_type_id" uuid,
	"officer_name" varchar(200),
	"work_description" text,
	"amount" numeric(15, 2),
	"risk_flag" "risk_flag_enum" DEFAULT 'Low' NOT NULL,
	"status" "file_status_enum" DEFAULT 'Created' NOT NULL,
	"finalized" boolean DEFAULT false NOT NULL,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	"ca_observations" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "files_file_number_unique" UNIQUE("file_number"),
	CONSTRAINT "files_amount_non_negative" CHECK ("files"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ulb_team_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ulb_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ulbs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(300) NOT NULL,
	"code" varchar(20) NOT NULL,
	"hod_designation" varchar(200),
	"hod_name" varchar(200),
	"district" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "ulbs_name_unique" UNIQUE("name"),
	CONSTRAINT "ulbs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_type_id" uuid NOT NULL,
	"name" varchar(300) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_template_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"section_number" smallint NOT NULL,
	"section_title" varchar(300) NOT NULL,
	"question_key" varchar(50) NOT NULL,
	"question_number" varchar(10) NOT NULL,
	"question_text" text NOT NULL,
	"response_type" "response_type_enum" NOT NULL,
	"is_conditional" boolean DEFAULT false NOT NULL,
	"parent_question_key" varchar(50),
	"parent_trigger_value" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"auto_query_title" varchar(300),
	"auto_query_description" text
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"phase_number" smallint NOT NULL,
	"checker_name" varchar(200),
	"check_date" date,
	"status" "checklist_status_enum" DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"response_value" varchar(50),
	"remark" text,
	"responded_at" timestamp with time zone,
	"responded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_number" varchar(30) NOT NULL,
	"file_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"priority" "query_priority_enum" DEFAULT 'Medium' NOT NULL,
	"status" "query_status_enum" DEFAULT 'Open' NOT NULL,
	"raised_by" uuid NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_text" text,
	"days_taken" integer,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"checklist_ref" varchar(50),
	"checklist_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queries_query_number_unique" UNIQUE("query_number")
);
--> statement-breakpoint
CREATE TABLE "query_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid
);
--> statement-breakpoint
CREATE TABLE "query_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"parent_reply_id" uuid,
	"reply_text" text NOT NULL,
	"replied_by" uuid NOT NULL,
	"replied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"reply_id" uuid,
	"file_name" varchar(500) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(100),
	"storage_path" text,
	"storage_backend" varchar(20) DEFAULT 'local' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"action_type" "query_action_type_enum" NOT NULL,
	"actor_id" uuid NOT NULL,
	"detail" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_name" varchar(300) NOT NULL,
	"pan" varchar(10),
	"gst_no" varchar(15),
	"epf_registration_no" varchar(50),
	"esic_registration_no" varchar(50),
	"labour_licence_no" varchar(100),
	"department_name" varchar(200),
	"file_no" varchar(50),
	"fund_name" varchar(200)
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_version_changes" ADD CONSTRAINT "file_version_changes_version_id_file_version_history_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."file_version_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_version_history" ADD CONSTRAINT "file_version_history_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_version_history" ADD CONSTRAINT "file_version_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_ulb_id_ulbs_id_fk" FOREIGN KEY ("ulb_id") REFERENCES "public"."ulbs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_contract_type_id_contract_types_id_fk" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ulb_team_assignments" ADD CONSTRAINT "ulb_team_assignments_ulb_id_ulbs_id_fk" FOREIGN KEY ("ulb_id") REFERENCES "public"."ulbs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ulb_team_assignments" ADD CONSTRAINT "ulb_team_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ulb_team_assignments" ADD CONSTRAINT "ulb_team_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ulbs" ADD CONSTRAINT "ulbs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ulbs" ADD CONSTRAINT "ulbs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_contract_type_id_contract_types_id_fk" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_questions" ADD CONSTRAINT "checklist_template_questions_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_question_id_checklist_template_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."checklist_template_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_participants" ADD CONSTRAINT "query_participants_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_participants" ADD CONSTRAINT "query_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_participants" ADD CONSTRAINT "query_participants_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_replies" ADD CONSTRAINT "query_replies_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_replies" ADD CONSTRAINT "query_replies_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_replies" ADD CONSTRAINT "query_replies_parent_reply_id_fk" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."query_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_attachments" ADD CONSTRAINT "query_attachments_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_attachments" ADD CONSTRAINT "query_attachments_reply_id_query_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."query_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_attachments" ADD CONSTRAINT "query_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_activity_log" ADD CONSTRAINT "query_activity_log_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_activity_log" ADD CONSTRAINT "query_activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_user_unique" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_version_history_file_version_unique" ON "file_version_history" USING btree ("file_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "ulb_team_unique" ON "ulb_team_assignments" USING btree ("ulb_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_templates_contract_version_unique" ON "checklist_templates" USING btree ("contract_type_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "template_question_key_unique" ON "checklist_template_questions" USING btree ("template_id","question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "template_sort_unique" ON "checklist_template_questions" USING btree ("template_id","section_number","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "checklists_file_phase_unique" ON "checklists" USING btree ("file_id","phase_number");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_responses_checklist_question_unique" ON "checklist_responses" USING btree ("checklist_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "query_participants_query_user_unique" ON "query_participants" USING btree ("query_id","user_id");