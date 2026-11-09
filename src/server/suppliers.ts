/**
 * Lot C — Fournisseurs.
 */
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { withTenant } from "@/db";
import { catalogImports, catalogItems, suppliers, type CatalogImport, type Supplier } from "@/db/schema";
import { assertCan, can, ForbiddenError } from "@/lib/permissions";
import { escapeLike, normalizeSearch } from "@/lib/text";
import type { SupplierInput } from "@/lib/validation";
import { NotFoundError, type Ctx } from "./clients";

function searchText(s: SupplierInput): string {
  return normalizeSearch([s.name, s.contactName, s.email, s.phone, s.city, s.customerAccount, s.siret].filter(Boolean).join(" "));
}

function values(input: SupplierInput) {
  const rest: Omit<SupplierInput, "id"> & { id?: string } = { ...input };
  delete rest.id;
  return { ...rest, searchText: searchText(input) };
}

export type SupplierListItem = Pick<Supplier, "id" | "name" | "contactName" | "phone" | "email" | "city"> & { itemCount: number };

export async function listSuppliers(ctx: Ctx, opts: { q?: string } = {}): Promise<SupplierListItem[]> {
  assertCan(ctx, "achats.gerer");
  const conditions: SQL[] = [isNull(suppliers.deletedAt)];
  for (const term of normalizeSearch(opts.q).split(" ").filter(Boolean).slice(0, 6)) {
    conditions.push(sql`${suppliers.searchText} like ${`%${escapeLike(term)}%`}`);
  }
  return withTenant(ctx.orgId, (tx) =>
    tx
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contactName: suppliers.contactName,
        phone: suppliers.phone,
        email: suppliers.email,
        city: suppliers.city,
        itemCount: sql<number>`(select count(*)::int from ${catalogItems} i where i.supplier_id = "suppliers"."id" and i.deleted_at is null)`,
      })
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${suppliers.name})`))
      .limit(300),
  );
}

/** Liste courte pour les menus déroulants (fiche article, import). */
export async function supplierOptions(ctx: Ctx): Promise<{ id: string; name: string }[]> {
  if (!can(ctx, "achats.gerer") && !can(ctx, "prix.achat")) throw new ForbiddenError("prix.achat");
  return withTenant(ctx.orgId, (tx) =>
    tx
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(isNull(suppliers.deletedAt))
      .orderBy(asc(sql`lower(${suppliers.name})`)),
  );
}

export async function getSupplier(
  ctx: Ctx,
  id: string,
): Promise<{ supplier: Supplier; itemCount: number; imports: Pick<CatalogImport, "id" | "status" | "source" | "fileName" | "createdAt" | "summary">[] }> {
  assertCan(ctx, "achats.gerer");
  return withTenant(ctx.orgId, async (tx) => {
    const [supplier] = await tx
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)));
    if (!supplier) throw new NotFoundError("Fournisseur introuvable");
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(catalogItems)
      .where(and(eq(catalogItems.supplierId, id), isNull(catalogItems.deletedAt)));
    const imports = await tx
      .select({
        id: catalogImports.id,
        status: catalogImports.status,
        source: catalogImports.source,
        fileName: catalogImports.fileName,
        createdAt: catalogImports.createdAt,
        summary: catalogImports.summary,
      })
      .from(catalogImports)
      .where(and(eq(catalogImports.supplierId, id), isNull(catalogImports.deletedAt)))
      .orderBy(desc(catalogImports.createdAt))
      .limit(10);
    return { supplier, itemCount: n, imports };
  });
}

/** Crée un fournisseur ; idempotent sur l'id (renvoi hors-ligne). */
export async function createSupplier(ctx: Ctx, input: SupplierInput): Promise<{ id: string }> {
  assertCan(ctx, "achats.gerer");
  return withTenant(ctx.orgId, async (tx) => {
    const id = input.id ?? crypto.randomUUID();
    await tx
      .insert(suppliers)
      .values({ id, orgId: ctx.orgId, createdBy: ctx.userId, ...values(input) })
      .onConflictDoNothing({ target: suppliers.id });
    const [row] = await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id));
    if (!row) throw new NotFoundError("Fournisseur introuvable");
    return { id };
  });
}

export async function updateSupplier(ctx: Ctx, id: string, input: SupplierInput): Promise<void> {
  assertCan(ctx, "achats.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(suppliers)
      .set(values(input))
      .where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    if (updated.length === 0) throw new NotFoundError("Fournisseur introuvable");
  });
}

/** Archive le fournisseur ; ses articles restent au catalogue (sans fournisseur actif). */
export async function archiveSupplier(ctx: Ctx, id: string): Promise<void> {
  assertCan(ctx, "achats.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(suppliers)
      .set({ deletedAt: new Date() })
      .where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    if (updated.length === 0) throw new NotFoundError("Fournisseur introuvable");
  });
}
