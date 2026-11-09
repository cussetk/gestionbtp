/**
 * Lot C — Import des grilles de prix fournisseurs.
 *
 * 1. Les lignes lues (fichier Excel/CSV, ou photo/PDF lu par l'IA) sont rapprochées du catalogue
 *    et enregistrées en BROUILLON : rien n'est modifié dans le catalogue.
 * 2. L'utilisateur relit, corrige, coche/décoche, puis valide.
 * 3. Seulement alors les articles sont créés ou leurs prix mis à jour (avec historique).
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { withTenant } from "@/db";
import { catalogImports, catalogItems, companySettings, itemPriceHistory, suppliers, taxRates, type CatalogImport } from "@/db/schema";
import { assertCan } from "@/lib/permissions";
import { normalizeSearch } from "@/lib/text";
import { salePriceFromCoef } from "@/lib/catalog";
import {
  MAX_IMPORT_ROWS,
  markDuplicates,
  normalizeName,
  normalizeRef,
  type ImportRow,
  type RawRow,
} from "@/lib/catalog-import";
import type { ImportApplyInput } from "@/lib/validation";
import { NotFoundError, type Ctx } from "./clients";

export class ImportError extends Error {}

export type ImportSummary = { created: number; updated: number; unchanged: number; ignored: number };

function assertImportRights(ctx: Ctx) {
  assertCan(ctx, "catalogue.modifier");
  assertCan(ctx, "prix.achat");
}

type MatchCandidate = {
  id: string;
  name: string;
  reference: string | null;
  supplierId: string | null;
  supplierRef: string | null;
  purchasePriceCents: number | null;
  salePriceCents: number;
  pricingMode: "coef" | "fixe";
  coefX1000: number | null;
};

/**
 * Rapproche chaque ligne d'un article existant :
 *  1. même fournisseur et même référence fournisseur ;
 *  2. sinon, référence identique (référence interne ou fournisseur) sur un article sans autre fournisseur ;
 *  3. sinon, désignation identique (même fournisseur ou sans fournisseur).
 */
export function matchRows(rows: RawRow[], items: MatchCandidate[], supplierId: string | null): ImportRow[] {
  const bySupplierRef = new Map<string, MatchCandidate>();
  const byRef = new Map<string, MatchCandidate>();
  const byName = new Map<string, MatchCandidate>();
  for (const it of items) {
    const sameOrNone = !it.supplierId || it.supplierId === supplierId;
    if (supplierId && it.supplierId === supplierId && it.supplierRef) bySupplierRef.set(normalizeRef(it.supplierRef), it);
    if (sameOrNone) {
      if (it.reference) byRef.set(normalizeRef(it.reference), it);
      if (it.supplierRef && !byRef.has(normalizeRef(it.supplierRef))) byRef.set(normalizeRef(it.supplierRef), it);
      byName.set(normalizeName(it.name), it);
    }
  }

  const used = new Set<string>();
  const out: ImportRow[] = rows.slice(0, MAX_IMPORT_ROWS).map((r, i) => {
    const ref = normalizeRef(r.supplierRef);
    let match = (ref && bySupplierRef.get(ref)) || (ref && byRef.get(ref)) || byName.get(normalizeName(r.name)) || null;
    const warnings = [...(r.warnings ?? [])];
    if (match && used.has(match.id)) {
      warnings.push("Un autre article de la grille correspond déjà au même article du catalogue");
      match = null;
    }
    if (match) used.add(match.id);

    let action: ImportRow["action"];
    if (r.purchasePriceCents === null) action = "ignorer";
    else if (match) action = match.purchasePriceCents === r.purchasePriceCents ? "ignorer" : "maj";
    else action = "creer";

    return {
      ...r,
      key: `r${i}`,
      kind: "produit",
      action,
      warnings,
      matchItemId: match?.id ?? null,
      match: match
        ? {
            name: match.name,
            purchasePriceCents: match.purchasePriceCents,
            salePriceCents: match.salePriceCents,
            pricingMode: match.pricingMode,
            coefX1000: match.coefX1000,
          }
        : null,
    };
  });
  return markDuplicates(out);
}

export async function createImportDraft(
  ctx: Ctx,
  input: { supplierId: string | null; source: "fichier" | "ia"; fileName: string | null; rows: RawRow[]; notes?: string | null },
): Promise<{ id: string }> {
  assertImportRights(ctx);
  if (input.rows.length === 0) throw new ImportError("Aucune ligne de prix n'a été trouvée dans ce document.");
  if (input.rows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(`Grille trop longue (${input.rows.length} lignes) : ${MAX_IMPORT_ROWS} lignes maximum par import.`);
  }
  return withTenant(ctx.orgId, async (tx) => {
    if (input.supplierId) {
      const [s] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(and(eq(suppliers.id, input.supplierId), isNull(suppliers.deletedAt)));
      if (!s) throw new NotFoundError("Fournisseur introuvable");
    }
    const items = await tx
      .select({
        id: catalogItems.id,
        name: catalogItems.name,
        reference: catalogItems.reference,
        supplierId: catalogItems.supplierId,
        supplierRef: catalogItems.supplierRef,
        purchasePriceCents: catalogItems.purchasePriceCents,
        salePriceCents: catalogItems.salePriceCents,
        pricingMode: catalogItems.pricingMode,
        coefX1000: catalogItems.coefX1000,
      })
      .from(catalogItems)
      .where(isNull(catalogItems.deletedAt));
    const rows = matchRows(input.rows, items, input.supplierId);
    const [created] = await tx
      .insert(catalogImports)
      .values({
        orgId: ctx.orgId,
        supplierId: input.supplierId,
        source: input.source,
        fileName: input.fileName?.slice(0, 200) ?? null,
        notes: input.notes?.slice(0, 1000) ?? null,
        rows,
        createdBy: ctx.userId,
      })
      .returning({ id: catalogImports.id });
    return created;
  });
}

export type ImportDetail = {
  import: CatalogImport & { rows: ImportRow[]; summary: ImportSummary | null };
  supplierName: string | null;
  taxRates: { id: string; label: string; rateBp: number; isDefault: boolean }[];
  defaultCoefX1000: number;
};

export async function getImport(ctx: Ctx, id: string): Promise<ImportDetail> {
  assertImportRights(ctx);
  return withTenant(ctx.orgId, async (tx) => {
    const [row] = await tx
      .select({ imp: catalogImports, supplierName: suppliers.name })
      .from(catalogImports)
      .leftJoin(suppliers, eq(suppliers.id, catalogImports.supplierId))
      .where(and(eq(catalogImports.id, id), isNull(catalogImports.deletedAt)));
    if (!row) throw new NotFoundError("Import introuvable");
    const rates = await tx
      .select({ id: taxRates.id, label: taxRates.label, rateBp: taxRates.rateBp, isDefault: taxRates.isDefault })
      .from(taxRates)
      .where(eq(taxRates.active, true))
      .orderBy(taxRates.position);
    const [settings] = await tx.select({ coef: companySettings.defaultCoefX1000 }).from(companySettings);
    return {
      import: row.imp as ImportDetail["import"],
      supplierName: row.supplierName,
      taxRates: rates,
      defaultCoefX1000: settings?.coef ?? 1400,
    };
  });
}

export async function listImports(ctx: Ctx, limit = 20) {
  assertImportRights(ctx);
  return withTenant(ctx.orgId, (tx) =>
    tx
      .select({
        id: catalogImports.id,
        status: catalogImports.status,
        source: catalogImports.source,
        fileName: catalogImports.fileName,
        createdAt: catalogImports.createdAt,
        summary: catalogImports.summary,
        supplierName: suppliers.name,
      })
      .from(catalogImports)
      .leftJoin(suppliers, eq(suppliers.id, catalogImports.supplierId))
      .where(isNull(catalogImports.deletedAt))
      .orderBy(desc(catalogImports.createdAt))
      .limit(limit),
  );
}

/** Applique les lignes validées par l'utilisateur. Une seule fois par import. */
export async function applyImport(ctx: Ctx, input: ImportApplyInput): Promise<ImportSummary> {
  assertImportRights(ctx);
  return withTenant(ctx.orgId, async (tx) => {
    const [imp] = await tx
      .select()
      .from(catalogImports)
      .where(and(eq(catalogImports.id, input.importId), isNull(catalogImports.deletedAt)))
      .for("update");
    if (!imp) throw new NotFoundError("Import introuvable");
    if (imp.status !== "brouillon") throw new ImportError("Cet import a déjà été validé ou abandonné.");
    if (input.taxRateId) {
      const [r] = await tx.select({ id: taxRates.id }).from(taxRates).where(eq(taxRates.id, input.taxRateId));
      if (!r) throw new ImportError("Taux de TVA inconnu");
    }

    // Le rapprochement fait foi côté serveur : l'écran ne peut pas viser un autre article.
    const stored = new Map((imp.rows as ImportRow[]).map((r) => [r.key, r]));
    const summary: ImportSummary = { created: 0, updated: 0, unchanged: 0, ignored: 0 };
    const finalRows: ImportRow[] = [];

    const targetIds = input.rows
      .filter((r) => r.action === "maj")
      .map((r) => stored.get(r.key)?.matchItemId)
      .filter((v): v is string => !!v);
    const targets = new Map(
      targetIds.length
        ? (
            await tx
              .select()
              .from(catalogItems)
              .where(and(inArray(catalogItems.id, targetIds), isNull(catalogItems.deletedAt)))
              .for("update")
          ).map((it) => [it.id, it])
        : [],
    );

    const newItems: (typeof catalogItems.$inferInsert)[] = [];
    const history: (typeof itemPriceHistory.$inferInsert)[] = [];

    for (const row of input.rows) {
      const base = stored.get(row.key);
      if (!base) continue;
      const merged: ImportRow = { ...base, ...row };
      finalRows.push(merged);

      if (row.action === "ignorer" || row.purchasePriceCents === null || !row.name) {
        summary.ignored++;
        merged.action = "ignorer";
        continue;
      }

      if (row.action === "maj" && base.matchItemId) {
        const item = targets.get(base.matchItemId);
        if (!item) {
          summary.ignored++;
          merged.action = "ignorer";
          merged.warnings = [...merged.warnings, "Article supprimé entre-temps"];
          continue;
        }
        targets.delete(item.id); // une seule mise à jour par article
        const purchase = row.purchasePriceCents;
        const sale = item.pricingMode === "coef" && item.coefX1000 ? salePriceFromCoef(purchase, item.coefX1000) : item.salePriceCents;
        // On complète les informations manquantes, sans écraser celles déjà saisies.
        const patch = {
          purchasePriceCents: purchase,
          salePriceCents: sale,
          supplierId: item.supplierId ?? imp.supplierId,
          supplierRef: item.supplierRef ?? row.supplierRef,
          brand: item.brand ?? row.brand,
          category: item.category ?? row.category,
        };
        if (purchase === item.purchasePriceCents && sale === item.salePriceCents) {
          summary.unchanged++;
        } else {
          summary.updated++;
          history.push({
            orgId: ctx.orgId,
            itemId: item.id,
            purchasePriceCents: purchase,
            salePriceCents: sale,
            source: "import",
            importId: imp.id,
            changedBy: ctx.userId,
          });
        }
        await tx
          .update(catalogItems)
          .set({
            ...patch,
            searchText: normalizeSearch(
              [item.reference, item.name, patch.brand, patch.category, patch.supplierRef].filter(Boolean).join(" "),
            ),
          })
          .where(eq(catalogItems.id, item.id));
        continue;
      }

      // Création (ligne nouvelle, ou « maj » sans article rapproché).
      const id = crypto.randomUUID();
      const sale = salePriceFromCoef(row.purchasePriceCents, input.coefX1000);
      newItems.push({
        id,
        orgId: ctx.orgId,
        kind: row.kind,
        name: row.name,
        brand: row.brand,
        category: row.category,
        unit: row.unit,
        purchasePriceCents: row.purchasePriceCents,
        pricingMode: "coef",
        coefX1000: input.coefX1000,
        salePriceCents: sale,
        taxRateId: input.taxRateId,
        supplierId: imp.supplierId,
        supplierRef: row.supplierRef,
        searchText: normalizeSearch([row.name, row.brand, row.category, row.supplierRef].filter(Boolean).join(" ")),
        createdBy: ctx.userId,
      });
      history.push({
        orgId: ctx.orgId,
        itemId: id,
        purchasePriceCents: row.purchasePriceCents,
        salePriceCents: sale,
        source: "import",
        importId: imp.id,
        changedBy: ctx.userId,
      });
      merged.action = "creer";
      merged.matchItemId = id;
      summary.created++;
    }

    for (let i = 0; i < newItems.length; i += 500) await tx.insert(catalogItems).values(newItems.slice(i, i + 500));
    for (let i = 0; i < history.length; i += 500) await tx.insert(itemPriceHistory).values(history.slice(i, i + 500));

    await tx
      .update(catalogImports)
      .set({ status: "applique", summary, rows: finalRows, appliedAt: new Date(), appliedBy: ctx.userId })
      .where(eq(catalogImports.id, imp.id));
    return summary;
  });
}

export async function abandonImport(ctx: Ctx, id: string): Promise<void> {
  assertImportRights(ctx);
  await withTenant(ctx.orgId, async (tx) => {
    const updated = await tx
      .update(catalogImports)
      .set({ status: "abandonne" })
      .where(and(eq(catalogImports.id, id), eq(catalogImports.status, "brouillon")))
      .returning({ id: catalogImports.id });
    if (updated.length === 0) throw new ImportError("Cet import n'est plus un brouillon.");
  });
}
