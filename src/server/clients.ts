/**
 * Module 1 — Clients et sites d'intervention (couche données).
 * Chaque fonction s'exécute via withTenant : Postgres garantit l'isolation par entreprise.
 * Les créations acceptent un id fourni par le téléphone et sont idempotentes
 * (renvoyer deux fois la même création hors-ligne ne crée pas de doublon).
 */
import { and, asc, count, eq, isNull, sql, type SQL } from "drizzle-orm";
import { withTenant } from "@/db";
import { clients, sites, type Client, type Site } from "@/db/schema";
import { escapeLike, normalizeSearch } from "@/lib/text";
import type { ClientInput, SiteInput } from "@/lib/validation";
import { assertCan, type Permission } from "@/lib/permissions";
import { parseCoordinates } from "@/lib/geo";
import { geocodeAddress } from "./geocode";

/** Contexte d'appel : entreprise, utilisateur et ses droits effectifs. */
export type Ctx = { orgId: string; userId: string; permissions: readonly Permission[] };

export class NotFoundError extends Error {
  constructor(what = "Élément introuvable") {
    super(what);
  }
}

// ─── Champs calculés ───────────────────────────────────────────────────────

export function clientDisplayName(c: Pick<ClientInput, "type" | "companyName" | "firstName" | "lastName">): string {
  if (c.type === "professionnel") return c.companyName ?? "";
  return [c.lastName?.toUpperCase(), c.firstName].filter(Boolean).join(" ");
}

function clientSearchText(c: ClientInput): string {
  return normalizeSearch(
    [c.companyName, c.firstName, c.lastName, c.email, c.phone, c.phone2, c.city, c.postalCode, c.siret]
      .filter(Boolean)
      .join(" "),
  );
}

function siteSearchText(s: SiteInput): string {
  return normalizeSearch(
    [s.label, s.addressLine1, s.addressLine2, s.postalCode, s.city, s.contactName, s.contactPhone]
      .filter(Boolean)
      .join(" "),
  );
}

function clientValues(input: ClientInput) {
  return {
    type: input.type,
    companyName: input.type === "professionnel" ? input.companyName : null,
    firstName: input.firstName,
    lastName: input.lastName,
    siret: input.type === "professionnel" ? input.siret : null,
    email: input.email,
    phone: input.phone,
    phone2: input.phone2,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    postalCode: input.postalCode,
    city: input.city,
    notes: input.notes,
    displayName: clientDisplayName(input),
    searchText: clientSearchText(input),
  };
}

function siteValues(input: SiteInput) {
  return {
    label: input.label,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    postalCode: input.postalCode,
    city: input.city,
    accessNotes: input.accessNotes,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    notes: input.notes,
    searchText: siteSearchText(input),
  };
}

// ─── Clients ───────────────────────────────────────────────────────────────

export type ClientListItem = Pick<
  Client,
  "id" | "type" | "displayName" | "firstName" | "lastName" | "companyName" | "phone" | "city" | "postalCode"
> & { siteCount: number };

/**
 * Liste les clients actifs. Recherche : chaque mot doit apparaître dans le client
 * (nom, société, téléphone, e-mail, ville…) OU dans l'un de ses sites (adresse, ville, contact).
 */
export async function listClients(
  ctx: Ctx,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<ClientListItem[]> {
  assertCan(ctx, "clients.voir");
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const terms = normalizeSearch(opts.q)
    .split(" ")
    .map((t) => t.replace(/[\s.\-()]/g, ""))
    .filter((t) => t.length > 0)
    .slice(0, 6);

  const conditions: SQL[] = [isNull(clients.deletedAt)];
  for (const term of terms) {
    const pattern = `%${escapeLike(term)}%`;
    conditions.push(
      sql`(${clients.searchText} like ${pattern} or replace(${clients.searchText}, ' ', '') like ${pattern} or exists (
        select 1 from ${sites} s
        where s.client_id = "clients"."id" and s.deleted_at is null and s.search_text like ${pattern}
      ))`,
    );
  }

  return withTenant(ctx.orgId, (tx) =>
    tx
      .select({
        id: clients.id,
        type: clients.type,
        displayName: clients.displayName,
        firstName: clients.firstName,
        lastName: clients.lastName,
        companyName: clients.companyName,
        phone: clients.phone,
        city: clients.city,
        postalCode: clients.postalCode,
        siteCount: sql<number>`(select count(*)::int from ${sites} s where s.client_id = "clients"."id" and s.deleted_at is null)`,
      })
      .from(clients)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${clients.displayName})`), asc(clients.id))
      .limit(limit)
      .offset(offset),
  );
}

export async function countClients(ctx: Ctx): Promise<number> {
  assertCan(ctx, "clients.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx.select({ n: count() }).from(clients).where(isNull(clients.deletedAt));
    return row.n;
  });
}

export async function getClient(ctx: Ctx, id: string): Promise<{ client: Client; sites: Site[] }> {
  assertCan(ctx, "clients.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
    if (!client) throw new NotFoundError("Client introuvable");
    const clientSites = await tx
      .select()
      .from(sites)
      .where(and(eq(sites.clientId, id), isNull(sites.deletedAt)))
      .orderBy(asc(sites.createdAt));
    return { client, sites: clientSites };
  });
}

/** Crée un client (et, si demandé, son premier site à l'adresse de facturation). Idempotent sur l'id. */
export async function createClient(ctx: Ctx, input: ClientInput): Promise<{ id: string; siteId: string | null }> {
  assertCan(ctx, "clients.modifier");
  // Position du site calculée avant la transaction (appel réseau).
  const geo =
    input.createSiteFromAddress && input.addressLine1 && input.postalCode && input.city
      ? await geocodeAddress({ addressLine1: input.addressLine1, postalCode: input.postalCode, city: input.city })
      : null;
  return withTenant(ctx.orgId, async (tx) => {
    const id = input.id ?? crypto.randomUUID();
    const inserted = await tx
      .insert(clients)
      .values({ id, orgId: ctx.orgId, createdBy: ctx.userId, ...clientValues(input) })
      .onConflictDoNothing({ target: clients.id })
      .returning({ id: clients.id });

    if (inserted.length === 0) {
      // Déjà créé (renvoi après coupure réseau) : on vérifie qu'il est bien à nous.
      const [existing] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, id));
      if (!existing) throw new NotFoundError("Client introuvable");
      return { id, siteId: null };
    }

    let siteId: string | null = null;
    if (input.createSiteFromAddress && input.addressLine1 && input.postalCode && input.city) {
      siteId = crypto.randomUUID();
      const siteInputValue: SiteInput = {
        clientId: id,
        label: input.type === "professionnel" ? "Siège" : "Domicile",
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        postalCode: input.postalCode,
        city: input.city,
        coordinates: null,
        geoSource: null,
        geoAccuracyM: null,
        accessNotes: null,
        contactName: null,
        contactPhone: null,
        notes: null,
      };
      await tx.insert(sites).values({
        id: siteId,
        orgId: ctx.orgId,
        clientId: id,
        createdBy: ctx.userId,
        ...siteValues(siteInputValue),
        ...(geo ? { latitude: geo.lat, longitude: geo.lng, geoSource: "adresse", geoUpdatedAt: new Date() } : {}),
      });
    }
    return { id, siteId };
  });
}

export async function updateClient(ctx: Ctx, id: string, input: ClientInput): Promise<void> {
  assertCan(ctx, "clients.modifier");
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(clients)
      .set(clientValues(input))
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    if (updated.length === 0) throw new NotFoundError("Client introuvable");
  });
}

/** Archive un client et ses sites (suppression douce, réversible par le support). */
export async function archiveClient(ctx: Ctx, id: string): Promise<void> {
  assertCan(ctx, "clients.archiver");
  await withTenant(ctx.orgId, async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(clients)
      .set({ deletedAt: now })
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    if (updated.length === 0) throw new NotFoundError("Client introuvable");
    await tx
      .update(sites)
      .set({ deletedAt: now })
      .where(and(eq(sites.clientId, id), isNull(sites.deletedAt)));
  });
}

// ─── Sites ─────────────────────────────────────────────────────────────────

export async function getSite(ctx: Ctx, id: string): Promise<{ site: Site; client: Client }> {
  assertCan(ctx, "clients.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx
      .select({ site: sites, client: clients })
      .from(sites)
      .innerJoin(clients, eq(clients.id, sites.clientId))
      .where(and(eq(sites.id, id), isNull(sites.deletedAt), isNull(clients.deletedAt)));
    if (!row) throw new NotFoundError("Site introuvable");
    return row;
  });
}

/**
 * Position à enregistrer :
 *  - coordonnées du formulaire (relevées par GPS, collées, ou déjà présentes) → conservées
 *    avec leur origine, sauf si elles venaient de l'ancienne adresse et que l'adresse a changé ;
 *  - sinon (champ vide ou position périmée) → calculée depuis l'adresse ;
 *  - si le calcul échoue → position vide.
 */
async function resolvePosition(
  input: SiteInput,
  previous?: Pick<Site, "addressLine1" | "postalCode" | "city">,
): Promise<
  | { latitude: number; longitude: number; geoSource: string; geoAccuracyM: number | null; geoUpdatedAt: Date }
  | { latitude: null; longitude: null; geoSource: null; geoAccuracyM: null; geoUpdatedAt: null }
> {
  const typed = parseCoordinates(input.coordinates);
  const addressChanged =
    !previous ||
    previous.addressLine1 !== input.addressLine1 ||
    previous.postalCode !== input.postalCode ||
    previous.city !== input.city;
  const stale = input.geoSource === "adresse" && addressChanged;

  if (typed && !stale) {
    const source = input.geoSource ?? "manuel";
    return {
      latitude: typed.lat,
      longitude: typed.lng,
      geoSource: source,
      geoAccuracyM: source === "gps" ? (input.geoAccuracyM ?? null) : null,
      geoUpdatedAt: new Date(),
    };
  }
  const geo = await geocodeAddress(input);
  if (geo) {
    return { latitude: geo.lat, longitude: geo.lng, geoSource: "adresse", geoAccuracyM: null, geoUpdatedAt: new Date() };
  }
  return { latitude: null, longitude: null, geoSource: null, geoAccuracyM: null, geoUpdatedAt: null };
}

export async function createSite(ctx: Ctx, input: SiteInput): Promise<{ id: string }> {
  assertCan(ctx, "clients.modifier");
  const position = await resolvePosition(input);
  return withTenant(ctx.orgId, async (tx) => {
    const [client] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt)));
    if (!client) throw new NotFoundError("Client introuvable");

    const id = input.id ?? crypto.randomUUID();
    await tx
      .insert(sites)
      .values({
        id,
        orgId: ctx.orgId,
        clientId: input.clientId,
        createdBy: ctx.userId,
        ...siteValues(input),
        ...position,
      })
      .onConflictDoNothing({ target: sites.id });
    const [check] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, id));
    if (!check) throw new NotFoundError("Site introuvable");
    return { id };
  });
}

export async function updateSite(ctx: Ctx, id: string, input: SiteInput): Promise<void> {
  assertCan(ctx, "clients.modifier");
  const previous = await withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx
      .select({ addressLine1: sites.addressLine1, postalCode: sites.postalCode, city: sites.city })
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.clientId, input.clientId), isNull(sites.deletedAt)));
    return row;
  });
  if (!previous) throw new NotFoundError("Site introuvable");
  const position = await resolvePosition(input, previous);

  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(sites)
      .set({ ...siteValues(input), ...position })
      .where(and(eq(sites.id, id), eq(sites.clientId, input.clientId), isNull(sites.deletedAt)))
      .returning({ id: sites.id });
    if (updated.length === 0) throw new NotFoundError("Site introuvable");
  });
}

/** Enregistre la position GPS relevée sur place depuis la fiche du site (un seul bouton). */
export async function setSitePosition(
  ctx: Ctx,
  siteId: string,
  pos: { lat: number; lng: number; accuracy?: number | null },
): Promise<void> {
  assertCan(ctx, "clients.modifier");
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(sites)
      .set({
        latitude: Math.round(pos.lat * 1e6) / 1e6,
        longitude: Math.round(pos.lng * 1e6) / 1e6,
        geoSource: "gps",
        geoAccuracyM: pos.accuracy != null ? Math.round(pos.accuracy) : null,
        geoUpdatedAt: new Date(),
      })
      .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)))
      .returning({ id: sites.id });
    if (updated.length === 0) throw new NotFoundError("Site introuvable");
  });
}

export async function archiveSite(ctx: Ctx, id: string): Promise<{ clientId: string }> {
  assertCan(ctx, "clients.archiver");
  return withTenant(ctx.orgId, async (tx) => {
    const [updated] = await tx
      .update(sites)
      .set({ deletedAt: new Date() })
      .where(and(eq(sites.id, id), isNull(sites.deletedAt)))
      .returning({ clientId: sites.clientId });
    if (!updated) throw new NotFoundError("Site introuvable");
    return updated;
  });
}
