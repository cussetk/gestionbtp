ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_org_id_uq" UNIQUE("org_id","id");--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('fichier', 'ia');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('brouillon', 'applique', 'abandonne');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('produit', 'main_oeuvre', 'prestation');--> statement-breakpoint
CREATE TYPE "public"."price_change_source" AS ENUM('creation', 'manuel', 'import');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('coef', 'fixe');--> statement-breakpoint
CREATE TABLE "catalog_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_id" uuid,
	"source" "import_source" NOT NULL,
	"file_name" text,
	"notes" text,
	"status" "import_status" DEFAULT 'brouillon' NOT NULL,
	"rows" jsonb NOT NULL,
	"summary" jsonb,
	"created_by" uuid,
	"applied_at" timestamp with time zone,
	"applied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "catalog_imports_org_id_uq" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "item_kind" DEFAULT 'produit' NOT NULL,
	"reference" text,
	"name" text NOT NULL,
	"description" text,
	"brand" text,
	"category" text,
	"unit" text DEFAULT 'u' NOT NULL,
	"purchase_price_cents" integer,
	"pricing_mode" "pricing_mode" DEFAULT 'fixe' NOT NULL,
	"coef_x1000" integer,
	"sale_price_cents" integer DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"supplier_id" uuid,
	"supplier_ref" text,
	"track_stock" boolean DEFAULT false NOT NULL,
	"track_serial" boolean DEFAULT false NOT NULL,
	"notes" text,
	"search_text" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "catalog_items_org_id_uq" UNIQUE("org_id","id"),
	CONSTRAINT "catalog_items_prices_ck" CHECK ("catalog_items"."sale_price_cents" >= 0 and ("catalog_items"."purchase_price_cents" is null or "catalog_items"."purchase_price_cents" >= 0)),
	CONSTRAINT "catalog_items_coef_ck" CHECK ("catalog_items"."pricing_mode" = 'fixe' or ("catalog_items"."coef_x1000" is not null and "catalog_items"."coef_x1000" > 0))
);
--> statement-breakpoint
CREATE TABLE "item_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"purchase_price_cents" integer,
	"sale_price_cents" integer NOT NULL,
	"source" "price_change_source" NOT NULL,
	"import_id" uuid,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"address_line1" text,
	"address_line2" text,
	"postal_code" text,
	"city" text,
	"country" text DEFAULT 'FR' NOT NULL,
	"siret" text,
	"vat_number" text,
	"customer_account" text,
	"payment_terms_days" integer,
	"notes" text,
	"search_text" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "suppliers_org_id_uq" UNIQUE("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "default_coef_x1000" integer DEFAULT 1400 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_supplier_fk" FOREIGN KEY ("org_id","supplier_id") REFERENCES "public"."suppliers"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_supplier_fk" FOREIGN KEY ("org_id","supplier_id") REFERENCES "public"."suppliers"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_tax_rate_fk" FOREIGN KEY ("org_id","tax_rate_id") REFERENCES "public"."tax_rates"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_item_fk" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."catalog_items"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_imports_org_idx" ON "catalog_imports" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "catalog_items_org_name_idx" ON "catalog_items" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "catalog_items_org_supplier_idx" ON "catalog_items" USING btree ("org_id","supplier_id","supplier_ref");--> statement-breakpoint
CREATE INDEX "item_price_history_item_idx" ON "item_price_history" USING btree ("org_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "suppliers_org_name_idx" ON "suppliers" USING btree ("org_id","name");--> statement-breakpoint
SELECT enable_tenant_rls('suppliers');--> statement-breakpoint
SELECT enable_tenant_rls('catalog_items');--> statement-breakpoint
SELECT enable_tenant_rls('item_price_history');--> statement-breakpoint
SELECT enable_tenant_rls('catalog_imports');