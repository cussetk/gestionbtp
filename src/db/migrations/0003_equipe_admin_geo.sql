CREATE TYPE "public"."org_status" AS ENUM('en_attente', 'active', 'suspendue');--> statement-breakpoint
CREATE TABLE "admin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"admin_user_id" uuid,
	"action" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Rôles renommés (les comptes existants sont conservés) : gerant → proprietaire, technicien → membre.
ALTER TYPE "public"."member_role" RENAME VALUE 'gerant' TO 'proprietaire';--> statement-breakpoint
ALTER TYPE "public"."member_role" RENAME VALUE 'technicien' TO 'membre';--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'membre';--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "permissions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status" "org_status" DEFAULT 'en_attente' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan" text DEFAULT 'pilote' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "geo_source" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "geo_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "geo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_events" ADD CONSTRAINT "admin_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_events" ADD CONSTRAINT "admin_events_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_events_org_idx" ON "admin_events" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("org_id");--> statement-breakpoint
-- Les espaces créés avant la validation par le gestionnaire restent actifs.
UPDATE "organizations" SET "status" = 'active', "status_changed_at" = now();--> statement-breakpoint
-- Un client peut modifier les informations de son entreprise, jamais son statut ni sa formule.
REVOKE UPDATE ON "organizations" FROM app_tenant;--> statement-breakpoint
GRANT UPDATE ("name", "siret", "email", "phone", "address_line1", "address_line2", "postal_code", "city", "country", "timezone", "fluid_capacity_certificate") ON "organizations" TO app_tenant;
