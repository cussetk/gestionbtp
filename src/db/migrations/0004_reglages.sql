CREATE TYPE "public"."doc_font" AS ENUM('helvetica', 'times');--> statement-breakpoint
CREATE TYPE "public"."doc_template" AS ENUM('classique', 'moderne', 'epure');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('devis', 'facture', 'avoir', 'acompte', 'commande');--> statement-breakpoint
CREATE TYPE "public"."logo_position" AS ENUM('gauche', 'centre', 'droite');--> statement-breakpoint
CREATE TYPE "public"."number_reset" AS ENUM('annuel', 'jamais');--> statement-breakpoint
CREATE TYPE "public"."tax_kind" AS ENUM('normal', 'reduit', 'particulier', 'exonere', 'autoliquidation');--> statement-breakpoint
CREATE TYPE "public"."vat_regime" AS ENUM('reel', 'franchise');--> statement-breakpoint
CREATE TABLE "company_logos" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"legal_form" text,
	"trade_name" text,
	"share_capital_cents" bigint,
	"registration" text,
	"vat_number" text,
	"naf_code" text,
	"website" text,
	"vat_regime" "vat_regime" DEFAULT 'reel' NOT NULL,
	"vat_on_debits" boolean DEFAULT false NOT NULL,
	"insurer_name" text,
	"insurer_address" text,
	"insurance_policy" text,
	"insurance_coverage" text,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"late_penalty_text" text,
	"early_payment_discount_text" text,
	"quote_validity_days" integer DEFAULT 30 NOT NULL,
	"deposit_percent" integer DEFAULT 30 NOT NULL,
	"payment_methods" text[] DEFAULT '{virement,cheque}'::text[] NOT NULL,
	"bank_name" text,
	"iban" text,
	"bic" text,
	"cgv" text,
	"quote_footer" text,
	"invoice_footer" text,
	"primary_color" text DEFAULT '#0b74a8' NOT NULL,
	"accent_color" text DEFAULT '#13202b' NOT NULL,
	"template" "doc_template" DEFAULT 'moderne' NOT NULL,
	"logo_position" "logo_position" DEFAULT 'gauche' NOT NULL,
	"font" "doc_font" DEFAULT 'helvetica' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "number_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"pattern" text NOT NULL,
	"padding" integer DEFAULT 4 NOT NULL,
	"reset" "number_reset" DEFAULT 'annuel' NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"last_year" integer,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text NOT NULL,
	"rate_bp" integer NOT NULL,
	"kind" "tax_kind" DEFAULT 'normal' NOT NULL,
	"mention" text,
	"requires_attestation" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tax_rates_rate_ck" CHECK ("tax_rates"."rate_bp" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "company_logos" ADD CONSTRAINT "company_logos_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_series" ADD CONSTRAINT "number_series_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "number_series_org_type_uq" ON "number_series" USING btree ("org_id","doc_type");--> statement-breakpoint
CREATE INDEX "tax_rates_org_idx" ON "tax_rates" USING btree ("org_id","position");--> statement-breakpoint
SELECT enable_tenant_rls('company_settings');--> statement-breakpoint
SELECT enable_tenant_rls('company_logos');--> statement-breakpoint
SELECT enable_tenant_rls('tax_rates');--> statement-breakpoint
SELECT enable_tenant_rls('number_series');
