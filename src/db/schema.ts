/**
 * Schéma de la base — socle + module 1 (clients et sites).
 *
 * Conventions appliquées à TOUTES les tables métier (voir docs/ARCHITECTURE.md) :
 *  - `id` uuid : peut être généré côté téléphone (hors-ligne) → pas de collision à la synchro.
 *  - `org_id` : l'entreprise propriétaire. Isolation garantie par Postgres (RLS), pas seulement par le code.
 *  - `created_at`, `updated_at`, `row_version` : tenus à jour par un trigger, servent à la synchro hors-ligne.
 *  - `deleted_at` : suppression "douce" (archivage) pour que la suppression se propage aux téléphones.
 *  - Les liens entre tables passent par une clé (org_id, id) : impossible de rattacher
 *    un site au client d'une autre entreprise, même par erreur de code.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  integer,
  check,
  doublePrecision,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Colonnes communes ──────────────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Colonnes de toute table métier synchronisable. */
const syncColumns = {
  ...timestamps,
  rowVersion: bigint("row_version", { mode: "number" })
    .notNull()
    .default(sql`nextval('sync_seq')`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

// ─── Socle : entreprises, utilisateurs, sessions ───────────────────────────

/** proprietaire : tous les droits, ne peut pas être modifié par un membre. membre : droits accordés un à un. */
export const memberRole = pgEnum("member_role", ["proprietaire", "membre"]);

/** Cycle de vie d'un espace : validé par le gestionnaire de la plateforme avant utilisation. */
export const orgStatus = pgEnum("org_status", ["en_attente", "active", "suspendue"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  siret: text("siret"),
  email: text("email"),
  phone: text("phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  postalCode: text("postal_code"),
  city: text("city"),
  country: text("country").notNull().default("FR"),
  /** Fuseau de l'entreprise : métropole et DOM n'ont pas la même heure (planning, horodatages PDF). */
  timezone: text("timezone").notNull().default("Europe/Paris"),
  /** N° d'attestation de capacité (manipulation des fluides) — requis sur le CERFA 15497. */
  fluidCapacityCertificate: text("fluid_capacity_certificate"),
  status: orgStatus("status").notNull().default("en_attente"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  /** Motif de suspension, visible par le client. */
  statusReason: text("status_reason"),
  /** Formule commerciale (pilote, essai, payant…), gérée par le gestionnaire. */
  plan: text("plan").notNull().default("pilote"),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Toujours stocké en minuscules. */
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    /** Gestionnaire de la plateforme (accès à l'espace de validation des comptes). */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("membre"),
    /** Fonction affichée : « Technicien », « Secrétaire »… */
    title: text("title"),
    /** Autorisations accordées (voir src/lib/permissions.ts). Ignoré pour le propriétaire. */
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    /** Un membre désactivé ne peut plus se connecter ; son historique est conservé. */
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    title: text("title"),
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    /** Empreinte SHA-256 du jeton du lien : le lien lui-même n'est jamais stocké. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invitations_token_uq").on(t.tokenHash), index("invitations_org_idx").on(t.orgId)],
);

/** Journal et notes du gestionnaire de la plateforme (traçabilité ; jamais visible par les clients). */
export const adminEvents = pgTable(
  "admin_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_events_org_idx").on(t.orgId, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais stocké. */
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Module 1 : clients et sites d'intervention ────────────────────────────

export const clientType = pgEnum("client_type", ["particulier", "professionnel"]);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: clientType("type").notNull().default("particulier"),
    /** Raison sociale (professionnel). */
    companyName: text("company_name"),
    /** Particulier : le client. Professionnel : l'interlocuteur. */
    firstName: text("first_name"),
    lastName: text("last_name"),
    siret: text("siret"),
    email: text("email"),
    phone: text("phone"),
    phone2: text("phone2"),
    // Adresse de facturation
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country").notNull().default("FR"),
    notes: text("notes"),
    /** Nom affiché et clé de tri (calculé par l'application). */
    displayName: text("display_name").notNull(),
    /** Texte de recherche normalisé (minuscules, sans accents), calculé par l'application. */
    searchText: text("search_text").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...syncColumns,
  },
  (t) => [
    unique("clients_org_id_uq").on(t.orgId, t.id),
    index("clients_org_name_idx").on(t.orgId, t.displayName),
    index("clients_org_version_idx").on(t.orgId, t.rowVersion),
    check(
      "clients_identity_ck",
      sql`(${t.type} = 'professionnel' and ${t.companyName} is not null)
          or (${t.type} = 'particulier' and ${t.lastName} is not null)`,
    ),
  ],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    /** Ex. « Domicile », « Magasin Jarry », « Bureaux 2e étage ». */
    label: text("label").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull().default("FR"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /** Origine de la position : gps (relevée sur place), adresse (calculée), manuel (collée). */
    geoSource: text("geo_source"),
    /** Précision du relevé GPS en mètres. */
    geoAccuracyM: integer("geo_accuracy_m"),
    geoUpdatedAt: timestamp("geo_updated_at", { withTimezone: true }),
    /** Code portail, étage, chien, emplacement des unités extérieures… */
    accessNotes: text("access_notes"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    notes: text("notes"),
    searchText: text("search_text").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...syncColumns,
  },
  (t) => [
    unique("sites_org_id_uq").on(t.orgId, t.id),
    foreignKey({
      name: "sites_client_fk",
      columns: [t.orgId, t.clientId],
      foreignColumns: [clients.orgId, clients.id],
    }).onDelete("cascade"),
    index("sites_org_client_idx").on(t.orgId, t.clientId),
    index("sites_org_version_idx").on(t.orgId, t.rowVersion),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;

// ─── Lot B : réglages de l'entreprise ──────────────────────────────────────

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

export const vatRegime = pgEnum("vat_regime", ["reel", "franchise"]);
export const docTemplate = pgEnum("doc_template", ["classique", "moderne", "epure"]);
export const logoPosition = pgEnum("logo_position", ["gauche", "centre", "droite"]);
export const docFont = pgEnum("doc_font", ["helvetica", "times"]);

/** Réglages légaux, commerciaux et de mise en page (une ligne par entreprise). */
export const companySettings = pgTable("company_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Identité légale (le nom, le SIRET et l'adresse du siège sont dans organizations)
  legalForm: text("legal_form"),
  tradeName: text("trade_name"),
  shareCapitalCents: bigint("share_capital_cents", { mode: "number" }),
  /** Immatriculation : « RCS Pointe-à-Pitre 123 456 789 » ou « RM 971 123 456 789 ». */
  registration: text("registration"),
  vatNumber: text("vat_number"),
  nafCode: text("naf_code"),
  website: text("website"),
  // TVA
  vatRegime: vatRegime("vat_regime").notNull().default("reel"),
  /** Option pour le paiement de la TVA d'après les débits (mention obligatoire si choisie). */
  vatOnDebits: boolean("vat_on_debits").notNull().default(false),
  // Assurance professionnelle (décennale) — mention obligatoire pour les artisans du bâtiment
  insurerName: text("insurer_name"),
  insurerAddress: text("insurer_address"),
  insurancePolicy: text("insurance_policy"),
  insuranceCoverage: text("insurance_coverage"),
  // Paiement
  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  latePenaltyText: text("late_penalty_text"),
  earlyPaymentDiscountText: text("early_payment_discount_text"),
  quoteValidityDays: integer("quote_validity_days").notNull().default(30),
  depositPercent: integer("deposit_percent").notNull().default(30),
  paymentMethods: text("payment_methods").array().notNull().default(sql`'{virement,cheque}'::text[]`),
  bankName: text("bank_name"),
  iban: text("iban"),
  bic: text("bic"),
  // Textes
  cgv: text("cgv"),
  quoteFooter: text("quote_footer"),
  invoiceFooter: text("invoice_footer"),
  // Mise en page
  primaryColor: text("primary_color").notNull().default("#0b74a8"),
  accentColor: text("accent_color").notNull().default("#13202b"),
  template: docTemplate("template").notNull().default("moderne"),
  logoPosition: logoPosition("logo_position").notNull().default("gauche"),
  font: docFont("font").notNull().default("helvetica"),
  ...syncColumns,
});

export const companyLogos = pgTable("company_logos", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sha256: text("sha256").notNull(),
  ...syncColumns,
});

export const taxKind = pgEnum("tax_kind", ["normal", "reduit", "particulier", "exonere", "autoliquidation"]);

/** Taux de TVA proposés sur les lignes de devis/factures (modifiables par le propriétaire). */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** Taux en points de base : 2000 = 20 %, 850 = 8,5 %, 210 = 2,1 %. */
    rateBp: integer("rate_bp").notNull(),
    kind: taxKind("kind").notNull().default("normal"),
    /** Mention imprimée sur le document quand ce taux est utilisé. */
    mention: text("mention"),
    /** Le client doit signer une attestation (taux réduits travaux dans les logements). */
    requiresAttestation: boolean("requires_attestation").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...syncColumns,
  },
  (t) => [
    index("tax_rates_org_idx").on(t.orgId, t.position),
    check("tax_rates_rate_ck", sql`${t.rateBp} between 0 and 10000`),
  ],
);

export const docType = pgEnum("doc_type", ["devis", "facture", "avoir", "acompte", "commande"]);
export const numberReset = pgEnum("number_reset", ["annuel", "jamais"]);

/** Numérotation des documents : une séquence continue par type de document. */
export const numberSeries = pgTable(
  "number_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    docType: docType("doc_type").notNull(),
    /** Ex. « FAC-{AAAA}-{N} ». Jetons : {AAAA}, {AA}, {MM}, {N}. */
    pattern: text("pattern").notNull(),
    padding: integer("padding").notNull().default(4),
    reset: numberReset("reset").notNull().default("annuel"),
    lastNumber: integer("last_number").notNull().default(0),
    lastYear: integer("last_year"),
    /** Posé au premier numéro attribué : le format ne peut plus changer ensuite. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...syncColumns,
  },
  (t) => [uniqueIndex("number_series_org_type_uq").on(t.orgId, t.docType)],
);

export type CompanySettings = typeof companySettings.$inferSelect;
export type TaxRate = typeof taxRates.$inferSelect;
export type NumberSeries = typeof numberSeries.$inferSelect;
