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

export const memberRole = pgEnum("member_role", ["gerant", "technicien"]);

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
    role: memberRole("role").notNull().default("technicien"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
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
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
