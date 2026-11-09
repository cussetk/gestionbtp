/**
 * Lot C — Catalogue d'articles (produits, main-d'œuvre, prestations).
 *
 * Les prix d'achat, coefficients et marges ne sortent de ce module que pour les comptes
 * ayant le droit « prix.achat » : un technicien voit les prix de vente, jamais les marges.
 */
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { getDb, withTenant, type Tx } from "@/db";
import {
  catalogItems,
  companySettings,
  itemPriceHistory,
  memberships,
  organizations,
  suppliers,
  taxRates,
  users,
  type CatalogItem,
} from "@/db/schema";
import { assertCan, can } from "@/lib/permissions";
import { escapeLike, normalizeSearch } from "@/lib/text";
import type { ItemKind } from "@/lib/catalog";
import type { ItemInput } from "@/lib/validation";
import { NotFoundError, type Ctx } from "./clients";
import { ensureDefaults } from "./settings";

export class CatalogError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

type PrivateField = "purchasePriceCents" | "coefX1000" | "supplierId" | "supplierRef";

/** Retire les informations d'achat pour les comptes sans le droit « prix.achat ». */
function redact<T extends Partial<Pick<CatalogItem, PrivateField>> & { supplierName?: string | null }>(
  ctx: Ctx,
  item: T,
): T {
  if (can(ctx, "prix.achat")) return item;
  return { ...item, purchasePriceCents: null, coefX1000: null, supplierId: null, supplierRef: null, supplierName: null };
}

function searchText(i: Pick<ItemInput, "reference" | "name" | "brand" | "category" | "supplierRef" | "description">): string {
  return normalizeSearch([i.reference, i.name, i.brand, i.category, i.supplierRef].filter(Boolean).join(" "));
}

// ─── Lecture ───────────────────────────────────────────────────────────────

export type ItemListRow = Pick<
  CatalogItem,
  | "id"
  | "kind"
  | "reference"
  | "name"
  | "brand"
  | "category"
  | "unit"
  | "purchasePriceCents"
  | "pricingMode"
  | "coefX1000"
  | "salePriceCents"
  | "supplierId"
  | "supplierRef"
  | "trackStock"
  | "trackSerial"
> & { supplierName: string | null; taxRateBp: number | null };

export async function listItems(
  ctx: Ctx,
  opts: { q?: string; kind?: ItemKind; category?: string; supplierId?: string; limit?: number; offset?: number } = {},
): Promise<ItemListRow[]> {
  assertCan(ctx, "catalogue.voir");
  const conditions: SQL[] = [isNull(catalogItems.deletedAt)];
  for (const term of normalizeSearch(opts.q).split(" ").filter(Boolean).slice(0, 6)) {
    const p = `%${escapeLike(term)}%`;
    conditions.push(sql`(${catalogItems.searchText} like ${p} or replace(${catalogItems.searchText}, ' ', '') like ${p})`);
  }
  if (opts.kind) conditions.push(eq(catalogItems.kind, opts.kind));
  if (opts.category) conditions.push(eq(catalogItems.category, opts.category));
  if (opts.supplierId && can(ctx, "prix.achat")) conditions.push(eq(catalogItems.supplierId, opts.supplierId));

  const rows = await withTenant(ctx.orgId, (tx) =>
    tx
      .select({
        id: catalogItems.id,
        kind: catalogItems.kind,
        reference: catalogItems.reference,
        name: catalogItems.name,
        brand: catalogItems.brand,
        category: catalogItems.category,
        unit: catalogItems.unit,
        purchasePriceCents: catalogItems.purchasePriceCents,
        pricingMode: catalogItems.pricingMode,
        coefX1000: catalogItems.coefX1000,
        salePriceCents: catalogItems.salePriceCents,
        supplierId: catalogItems.supplierId,
        supplierRef: catalogItems.supplierRef,
        trackStock: catalogItems.trackStock,
        trackSerial: catalogItems.trackSerial,
        supplierName: suppliers.name,
        taxRateBp: taxRates.rateBp,
      })
      .from(catalogItems)
      .leftJoin(suppliers, eq(suppliers.id, catalogItems.supplierId))
      .leftJoin(taxRates, eq(taxRates.id, catalogItems.taxRateId))
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${catalogItems.name})`), asc(catalogItems.id))
      .limit(Math.min(opts.limit ?? 100, 500))
      .offset(opts.offset ?? 0),
  );
  return rows.map((r) => redact(ctx, r));
}

export async function catalogStats(ctx: Ctx): Promise<{ total: number; byKind: Record<string, number>; categories: string[] }> {
  assertCan(ctx, "catalogue.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const kinds = await tx
      .select({ kind: catalogItems.kind, n: sql<number>`count(*)::int` })
      .from(catalogItems)
      .where(isNull(catalogItems.deletedAt))
      .groupBy(catalogItems.kind);
    const categories = await listCategoriesTx(tx);
    const byKind = Object.fromEntries(kinds.map((k) => [k.kind, k.n]));
    return { total: kinds.reduce((s, k) => s + k.n, 0), byKind, categories };
  });
}

async function listCategoriesTx(tx: Tx): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ category: catalogItems.category })
    .from(catalogItems)
    .where(and(isNull(catalogItems.deletedAt), sql`${catalogItems.category} is not null`))
    .orderBy(asc(catalogItems.category))
    .limit(200);
  return rows.map((r) => r.category!).filter(Boolean);
}

export type ItemDetail = {
  item: CatalogItem & { supplierName: string | null; supplierArchived: boolean };
  taxRate: { id: string; label: string; rateBp: number; active: boolean } | null;
  history: { id: string; at: Date; purchasePriceCents: number | null; salePriceCents: number; source: string; by: string | null }[];
};

export async function getItem(ctx: Ctx, id: string): Promise<ItemDetail> {
  assertCan(ctx, "catalogue.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx
      .select({ item: catalogItems, supplierName: suppliers.name, supplierDeletedAt: suppliers.deletedAt })
      .from(catalogItems)
      .leftJoin(suppliers, eq(suppliers.id, catalogItems.supplierId))
      .where(and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)));
    if (!row) throw new NotFoundError("Article introuvable");
    const [taxRate] = row.item.taxRateId
      ? await tx
          .select({ id: taxRates.id, label: taxRates.label, rateBp: taxRates.rateBp, active: taxRates.active })
          .from(taxRates)
          .where(eq(taxRates.id, row.item.taxRateId))
      : [];
    const history = await tx
      .select({
        id: itemPriceHistory.id,
        at: itemPriceHistory.createdAt,
        purchasePriceCents: itemPriceHistory.purchasePriceCents,
        salePriceCents: itemPriceHistory.salePriceCents,
        source: itemPriceHistory.source,
        changedBy: itemPriceHistory.changedBy,
      })
      .from(itemPriceHistory)
      .where(eq(itemPriceHistory.itemId, id))
      .orderBy(desc(itemPriceHistory.createdAt))
      .limit(50);
    return { row, taxRate, history };
  }).then(async ({ row, taxRate, history }) => {
    const names = await memberNames(ctx.orgId, history.map((h) => h.changedBy));
    const showPurchase = can(ctx, "prix.achat");
    return {
      item: redact(ctx, { ...row.item, supplierName: row.supplierName, supplierArchived: row.supplierDeletedAt != null }),
      taxRate: taxRate ?? null,
      history: history.map(({ changedBy, ...h }) => ({
        ...h,
        by: changedBy ? (names.get(changedBy) ?? null) : null,
        purchasePriceCents: showPurchase ? h.purchasePriceCents : null,
      })),
    };
  });
}

/** Noms des membres de l'entreprise (la table des comptes n'est pas lisible sous le rôle restreint). */
async function memberNames(orgId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.fullName })
    .from(users)
    .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.orgId, orgId)))
    .where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Données des formulaires article : taux de TVA, fournisseurs, familles, coefficient par défaut. */
export async function itemFormOptions(ctx: Ctx) {
  assertCan(ctx, "catalogue.voir");
  return withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org?.timezone ?? "Europe/Paris");
    const rates = await tx
      .select({ id: taxRates.id, label: taxRates.label, rateBp: taxRates.rateBp, isDefault: taxRates.isDefault, active: taxRates.active })
      .from(taxRates)
      .orderBy(asc(taxRates.position));
    const [settings] = await tx.select({ defaultCoefX1000: companySettings.defaultCoefX1000 }).from(companySettings);
    const supplierList = can(ctx, "prix.achat")
      ? await tx
          .select({ id: suppliers.id, name: suppliers.name })
          .from(suppliers)
          .where(isNull(suppliers.deletedAt))
          .orderBy(asc(sql`lower(${suppliers.name})`))
      : [];
    return {
      taxRates: rates,
      suppliers: supplierList,
      categories: await listCategoriesTx(tx),
      defaultCoefX1000: settings?.defaultCoefX1000 ?? 1400,
    };
  });
}

export async function updateDefaultCoef(ctx: Ctx, coefX1000: number): Promise<void> {
  assertCan(ctx, "catalogue.modifier");
  assertCan(ctx, "prix.achat");
  await withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org?.timezone ?? "Europe/Paris");
    await tx.update(companySettings).set({ defaultCoefX1000: coefX1000 }).where(eq(companySettings.orgId, ctx.orgId));
  });
}

// ─── Écriture ──────────────────────────────────────────────────────────────

async function checkRefs(tx: Tx, input: Pick<ItemInput, "taxRateId" | "supplierId">) {
  if (input.taxRateId) {
    const [r] = await tx.select({ id: taxRates.id }).from(taxRates).where(eq(taxRates.id, input.taxRateId));
    if (!r) throw new CatalogError("Taux de TVA inconnu", "taxRateId");
  }
  if (input.supplierId) {
    const [s] = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), isNull(suppliers.deletedAt)));
    if (!s) throw new CatalogError("Fournisseur inconnu", "supplierId");
  }
}

function descriptiveValues(input: ItemInput) {
  return {
    kind: input.kind,
    reference: input.reference,
    name: input.name,
    description: input.description,
    brand: input.brand,
    category: input.category,
    unit: input.unit,
    taxRateId: input.taxRateId,
    trackStock: input.kind === "produit" ? input.trackStock : false,
    trackSerial: input.kind === "produit" ? input.trackSerial : false,
    notes: input.notes,
  };
}

export async function createItem(ctx: Ctx, input: ItemInput): Promise<{ id: string }> {
  assertCan(ctx, "catalogue.modifier");
  const full = can(ctx, "prix.achat");
  return withTenant(ctx.orgId, async (tx) => {
    await checkRefs(tx, full ? input : { taxRateId: input.taxRateId, supplierId: null });
    const id = input.id ?? crypto.randomUUID();
    const pricing = full
      ? {
          purchasePriceCents: input.purchasePriceCents,
          pricingMode: input.pricingMode,
          coefX1000: input.coefX1000,
          salePriceCents: input.salePriceCents,
          supplierId: input.supplierId,
          supplierRef: input.supplierRef,
        }
      : { purchasePriceCents: null, pricingMode: "fixe" as const, coefX1000: null, salePriceCents: input.salePriceCents, supplierId: null, supplierRef: null };
    const inserted = await tx
      .insert(catalogItems)
      .values({
        id,
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        ...descriptiveValues(input),
        ...pricing,
        searchText: searchText({ ...input, supplierRef: pricing.supplierRef }),
      })
      .onConflictDoNothing({ target: catalogItems.id })
      .returning({ id: catalogItems.id });
    if (inserted.length === 0) {
      const [existing] = await tx.select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.id, id));
      if (!existing) throw new NotFoundError("Article introuvable");
      return { id };
    }
    await tx.insert(itemPriceHistory).values({
      orgId: ctx.orgId,
      itemId: id,
      purchasePriceCents: pricing.purchasePriceCents,
      salePriceCents: pricing.salePriceCents,
      source: "creation",
      changedBy: ctx.userId,
    });
    return { id };
  });
}

export async function updateItem(ctx: Ctx, id: string, input: ItemInput): Promise<void> {
  assertCan(ctx, "catalogue.modifier");
  const full = can(ctx, "prix.achat");
  await withTenant(ctx.orgId, async (tx) => {
    const [current] = await tx
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)))
      .for("update");
    if (!current) throw new NotFoundError("Article introuvable");
    await checkRefs(tx, full ? input : { taxRateId: input.taxRateId, supplierId: null });

    let pricing: Pick<CatalogItem, "purchasePriceCents" | "pricingMode" | "coefX1000" | "salePriceCents" | "supplierId" | "supplierRef">;
    if (full) {
      pricing = {
        purchasePriceCents: input.purchasePriceCents,
        pricingMode: input.pricingMode,
        coefX1000: input.coefX1000,
        salePriceCents: input.salePriceCents,
        supplierId: input.supplierId,
        supplierRef: input.supplierRef,
      };
    } else {
      // Sans accès aux prix d'achat : seules les infos visibles changent.
      // Un nouveau prix de vente saisi à la main fige le prix (le coefficient ne s'applique plus).
      const changed = input.salePriceCents !== current.salePriceCents;
      pricing = {
        purchasePriceCents: current.purchasePriceCents,
        pricingMode: changed ? "fixe" : current.pricingMode,
        coefX1000: changed ? null : current.coefX1000,
        salePriceCents: input.salePriceCents,
        supplierId: current.supplierId,
        supplierRef: current.supplierRef,
      };
    }

    await tx
      .update(catalogItems)
      .set({ ...descriptiveValues(input), ...pricing, searchText: searchText({ ...input, supplierRef: pricing.supplierRef }) })
      .where(eq(catalogItems.id, id));

    if (pricing.purchasePriceCents !== current.purchasePriceCents || pricing.salePriceCents !== current.salePriceCents) {
      await tx.insert(itemPriceHistory).values({
        orgId: ctx.orgId,
        itemId: id,
        purchasePriceCents: pricing.purchasePriceCents,
        salePriceCents: pricing.salePriceCents,
        source: "manuel",
        changedBy: ctx.userId,
      });
    }
  });
}

export async function archiveItem(ctx: Ctx, id: string): Promise<void> {
  assertCan(ctx, "catalogue.modifier");
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(catalogItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)))
      .returning({ id: catalogItems.id });
    if (updated.length === 0) throw new NotFoundError("Article introuvable");
  });
}
