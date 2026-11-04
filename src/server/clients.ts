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

export type Ctx = { orgId: string; userId: string };

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
    latitude: input.latitude,
    longitude: input.longitude,
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
  return withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx.select({ n: count() }).from(clients).where(isNull(clients.deletedAt));
    return row.n;
  });
}

export async function getClient(ctx: Ctx, id: string): Promise<{ client: Client; sites: Site[] }> {
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
        latitude: null,
        longitude: null,
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
      });
    }
    return { id, siteId };
  });
}

export async function updateClient(ctx: Ctx, id: string, input: ClientInput): Promise<void> {
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

export async function createSite(ctx: Ctx, input: SiteInput): Promise<{ id: string }> {
  return withTenant(ctx.orgId, async (tx) => {
    const [client] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt)));
    if (!client) throw new NotFoundError("Client introuvable");

    const id = input.id ?? crypto.randomUUID();
    await tx
      .insert(sites)
      .values({ id, orgId: ctx.orgId, clientId: input.clientId, createdBy: ctx.userId, ...siteValues(input) })
      .onConflictDoNothing({ target: sites.id });
    const [check] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, id));
    if (!check) throw new NotFoundError("Site introuvable");
    return { id };
  });
}

export async function updateSite(ctx: Ctx, id: string, input: SiteInput): Promise<void> {
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(sites)
      .set(siteValues(input))
      .where(and(eq(sites.id, id), eq(sites.clientId, input.clientId), isNull(sites.deletedAt)))
      .returning({ id: sites.id });
    if (updated.length === 0) throw new NotFoundError("Site introuvable");
  });
}

export async function archiveSite(ctx: Ctx, id: string): Promise<{ clientId: string }> {
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
