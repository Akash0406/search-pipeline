-- Required Postgres extensions.
--   * `vector` (pgvector) backs the reserved `opportunities.embedding`
--     column, which is DECLARED but NEVER written in this slice (Req 33.3).
--   * `pgcrypto` guarantees `gen_random_uuid()` on every supported Postgres
--     version (built-in on 13+, provided by the extension otherwise).
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."extraction_method" AS ENUM('STRUCTURED_DATA', 'RULE', 'PARSER', 'LLM', 'USER');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('New', 'Active', 'Closing soon', 'Closed', 'Expired', 'Removed', 'Needs review', 'Duplicate');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('greenhouse', 'lever', 'ashby', 'jsonld', 'manual_url', 'gmail');--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"source_type" "source_type" NOT NULL,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"health_status" text DEFAULT 'unknown',
	"last_health_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"oauth_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_checkpoints" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"cursor" text,
	"etags" jsonb,
	"last_modified" jsonb,
	"last_run_at" timestamp with time zone,
	"last_successful_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connector_configs" (
	"connector_id" uuid PRIMARY KEY NOT NULL,
	"rate_limit_per_min" integer NOT NULL,
	"max_bytes" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"max_redirects" integer NOT NULL,
	"allowed_content_types" text[] NOT NULL,
	"default_schedule" text
);
--> statement-breakpoint
CREATE TABLE "connector_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"correlation_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"items_discovered" integer DEFAULT 0,
	"items_fetched" integer DEFAULT 0,
	"items_parsed" integer DEFAULT 0,
	"items_persisted" integer DEFAULT 0,
	"items_failed" integer DEFAULT 0,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"display_name" text NOT NULL,
	"is_first_party" boolean NOT NULL,
	"default_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parser_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parser_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_artifact_id" uuid NOT NULL,
	"parser_definition_id" uuid,
	"correlation_id" text,
	"status" text NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"source_type" "source_type" NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"http_status" integer,
	"content_type" text,
	"headers" jsonb,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"byte_size" integer,
	"etag" text,
	"last_modified" text,
	"retention_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token_enc" "bytea",
	"refresh_token_enc" "bytea",
	"scopes" text[],
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"actor" text,
	"event_type" text NOT NULL,
	"method" text,
	"outcome" text,
	"target_ref" text,
	"metadata" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"approx_location" text,
	"last_active_at" timestamp with time zone NOT NULL,
	"rotated_from" uuid,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"timezone" text,
	"active_role_profile_id" uuid,
	"raw_retention_days" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"email_verified_at" timestamp with time zone,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"timezone" text,
	"anonymized_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_preferences" (
	"role_profile_id" uuid PRIMARY KEY NOT NULL,
	"work_arrangements" text[],
	"employment_types" text[],
	"seniority_levels" text[]
);
--> statement-breakpoint
CREATE TABLE "role_profile_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text,
	"salary_period" text,
	"work_rights" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"changed_fields" text[],
	"previous_content_hash" text,
	"new_content_hash" text,
	"raw_artifact_id" uuid
);
--> statement-breakpoint
CREATE TABLE "duplicate_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_opportunity_id" uuid,
	"strategy" text,
	"confidence" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"canonical_url" text,
	"apply_url" text,
	"work_arrangement" text,
	"employment_type" text,
	"seniority" text,
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text,
	"salary_period" text,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone NOT NULL,
	"closing_at" timestamp with time zone,
	"last_updated_at" timestamp with time zone NOT NULL,
	"status" "opportunity_status" DEFAULT 'New' NOT NULL,
	"is_first_party" boolean DEFAULT false NOT NULL,
	"fingerprint" text,
	"content_hash" text,
	"duplicate_group_id" uuid,
	"match_features" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_content" (
	"opportunity_id" uuid PRIMARY KEY NOT NULL,
	"description_html_sanitized" text,
	"description_text" text
);
--> statement-breakpoint
CREATE TABLE "opportunity_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_source_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value_json" jsonb,
	"source_text" text,
	"method" "extraction_method" NOT NULL,
	"confidence" numeric NOT NULL,
	"uncertain" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text,
	"city" text,
	"region" text,
	"country" text,
	"is_remote" boolean
);
--> statement-breakpoint
CREATE TABLE "opportunity_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"value" text NOT NULL,
	"kind" text
);
--> statement-breakpoint
CREATE TABLE "opportunity_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"raw_artifact_id" uuid,
	"source_type" "source_type" NOT NULL,
	"is_first_party" boolean NOT NULL,
	"external_id" text,
	"source_url" text,
	"apply_url" text,
	"ats_board" text,
	"ats_posting_id" text,
	"fingerprint" text,
	"confidence" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "opportunity_user_state" (
	"user_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_user_state_user_id_opportunity_id_pk" PRIMARY KEY("user_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"raw_artifact_id" uuid,
	"opportunity_source_id" uuid,
	"reason" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_oauth_account_id_accounts_id_fk" FOREIGN KEY ("oauth_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_checkpoints" ADD CONSTRAINT "connector_checkpoints_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_configs" ADD CONSTRAINT "connector_configs_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parser_runs" ADD CONSTRAINT "parser_runs_raw_artifact_id_raw_artifacts_id_fk" FOREIGN KEY ("raw_artifact_id") REFERENCES "public"."raw_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parser_runs" ADD CONSTRAINT "parser_runs_parser_definition_id_parser_definitions_id_fk" FOREIGN KEY ("parser_definition_id") REFERENCES "public"."parser_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_artifacts" ADD CONSTRAINT "raw_artifacts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_active_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("active_role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_locations" ADD CONSTRAINT "role_profile_locations_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_preferences" ADD CONSTRAINT "role_profile_preferences_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_skills" ADD CONSTRAINT "role_profile_skills_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_titles" ADD CONSTRAINT "role_profile_titles_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profiles" ADD CONSTRAINT "role_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_raw_artifact_id_raw_artifacts_id_fk" FOREIGN KEY ("raw_artifact_id") REFERENCES "public"."raw_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_groups" ADD CONSTRAINT "duplicate_groups_canonical_opportunity_id_opportunities_id_fk" FOREIGN KEY ("canonical_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_duplicate_group_id_duplicate_groups_id_fk" FOREIGN KEY ("duplicate_group_id") REFERENCES "public"."duplicate_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_content" ADD CONSTRAINT "opportunity_content_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_opportunity_source_id_opportunity_sources_id_fk" FOREIGN KEY ("opportunity_source_id") REFERENCES "public"."opportunity_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_locations" ADD CONSTRAINT "opportunity_locations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_raw_artifact_id_raw_artifacts_id_fk" FOREIGN KEY ("raw_artifact_id") REFERENCES "public"."raw_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_user_state" ADD CONSTRAINT "opportunity_user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_user_state" ADD CONSTRAINT "opportunity_user_state_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_raw_artifact_id_raw_artifacts_id_fk" FOREIGN KEY ("raw_artifact_id") REFERENCES "public"."raw_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue_items" ADD CONSTRAINT "review_queue_items_opportunity_source_id_opportunity_sources_id_fk" FOREIGN KEY ("opportunity_source_id") REFERENCES "public"."opportunity_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_user_id_idx" ON "connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connections_status_idx" ON "connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "connector_runs_connection_started_idx" ON "connector_runs" USING btree ("connection_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_source_type_unique" ON "connectors" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "parser_definitions_source_version_unique" ON "parser_definitions" USING btree ("source_type","version");--> statement-breakpoint
CREATE INDEX "parser_runs_raw_artifact_idx" ON "parser_runs" USING btree ("raw_artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_artifacts_connection_url_hash_unique" ON "raw_artifacts" USING btree ("connection_id","source_url","content_hash");--> statement-breakpoint
CREATE INDEX "raw_artifacts_connection_fetched_idx" ON "raw_artifacts" USING btree ("connection_id","fetched_at");--> statement-breakpoint
CREATE INDEX "raw_artifacts_content_hash_idx" ON "raw_artifacts" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "raw_artifacts_retention_until_idx" ON "raw_artifacts" USING btree ("retention_until");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_unique" ON "magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_link_tokens_email_idx" ON "magic_link_tokens" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_revoked_idx" ON "sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "role_profile_locations_profile_idx" ON "role_profile_locations" USING btree ("role_profile_id");--> statement-breakpoint
CREATE INDEX "role_profile_skills_profile_kind_idx" ON "role_profile_skills" USING btree ("role_profile_id","kind");--> statement-breakpoint
CREATE INDEX "role_profile_titles_profile_kind_idx" ON "role_profile_titles" USING btree ("role_profile_id","kind");--> statement-breakpoint
CREATE INDEX "role_profiles_user_id_idx" ON "role_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_revisions_opportunity_changed_idx" ON "content_revisions" USING btree ("opportunity_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_canonical_url_unique" ON "opportunities" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_company_idx" ON "opportunities" USING btree ("company");--> statement-breakpoint
CREATE INDEX "opportunities_posted_at_idx" ON "opportunities" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "opportunities_first_seen_at_idx" ON "opportunities" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "opportunities_last_updated_at_idx" ON "opportunities" USING btree ("last_updated_at");--> statement-breakpoint
CREATE INDEX "opportunities_fingerprint_idx" ON "opportunities" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "opportunities_status_last_updated_idx" ON "opportunities" USING btree ("status","last_updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "opportunities_company_status_idx" ON "opportunities" USING btree ("company","status");--> statement-breakpoint
CREATE INDEX "opportunities_active_last_updated_idx" ON "opportunities" USING btree ("last_updated_at" DESC NULLS LAST) WHERE "opportunities"."status" in ('New','Active','Closing soon');--> statement-breakpoint
CREATE INDEX "opportunities_closing_at_idx" ON "opportunities" USING btree ("closing_at") WHERE "opportunities"."closing_at" is not null;--> statement-breakpoint
CREATE INDEX "opportunity_evidence_source_idx" ON "opportunity_evidence" USING btree ("opportunity_source_id");--> statement-breakpoint
CREATE INDEX "opportunity_locations_opportunity_idx" ON "opportunity_locations" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_locations_normalized_idx" ON "opportunity_locations" USING btree ("normalized_value");--> statement-breakpoint
CREATE INDEX "opportunity_locations_geo_idx" ON "opportunity_locations" USING btree ("country","region","city");--> statement-breakpoint
CREATE INDEX "opportunity_skills_opportunity_idx" ON "opportunity_skills" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_sources_opportunity_idx" ON "opportunity_sources" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_sources_fingerprint_idx" ON "opportunity_sources" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_sources_type_external_unique" ON "opportunity_sources" USING btree ("source_type","external_id");--> statement-breakpoint
CREATE INDEX "opportunity_user_state_user_state_idx" ON "opportunity_user_state" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("created_at") WHERE "outbox_events"."published_at" is null;--> statement-breakpoint
CREATE INDEX "review_queue_items_status_created_idx" ON "review_queue_items" USING btree ("status","created_at");

--> statement-breakpoint
-- audit_logs is APPEND-ONLY (Req 9.4): auth + admin events must be attributable
-- and must NOT be editable through standard user actions. The application
-- connects with a least-privilege role that is granted INSERT/SELECT only; the
-- statements below revoke UPDATE/DELETE from PUBLIC as defense-in-depth. A
-- dedicated app role (provisioned in infra) should additionally be granted only
-- INSERT, SELECT on this table.
COMMENT ON TABLE "audit_logs" IS 'APPEND-ONLY (Req 9.4): INSERT/SELECT only; UPDATE/DELETE are not permitted via the application role.';--> statement-breakpoint
REVOKE UPDATE, DELETE ON "audit_logs" FROM PUBLIC;
