"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveSession, toCtx } from "@/lib/session";
import { ForbiddenError } from "@/lib/permissions";
import { catalogSettingsInput, fieldErrors, formToObject, importApplyInput, itemInput } from "@/lib/validation";
import { UNITS, type Unit } from "@/lib/catalog";
import { MAX_IMPORT_ROWS } from "@/lib/catalog-import";
import { NotFoundError } from "@/server/clients";
import { archiveItem, CatalogError, createItem, updateDefaultCoef, updateItem } from "@/server/catalog";
import { abandonImport, applyImport, createImportDraft, ImportError, type ImportSummary } from "@/server/catalog-import";
import { AI_MAX_BYTES, AI_MAX_FILES, AiExtractError, extractPriceGrid } from "@/server/ai-extract";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string>; ok?: string; at?: number };

async function ctx() {
  return toCtx(await requireActiveSession());
}

function known(err: unknown): string | null {
  if (err instanceof NotFoundError || err instanceof ForbiddenError || err instanceof ImportError || err instanceof AiExtractError) {
    return err.message;
  }
  return null;
}

// ─── Articles ──────────────────────────────────────────────────────────────

export async function saveItemAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = itemInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  let id: string;
  try {
    if (values.mode === "update" && parsed.data.id) {
      id = parsed.data.id;
      await updateItem(c, id, parsed.data);
    } else {
      id = (await createItem(c, parsed.data)).id;
    }
  } catch (err) {
    if (err instanceof CatalogError) return { errors: { [err.field ?? "_form"]: err.message }, values };
    const msg = known(err);
    if (msg) return { errors: { _form: msg }, values };
    throw err;
  }
  revalidatePath("/catalogue");
  redirect(`/catalogue/${id}`);
}

export async function archiveItemAction(form: FormData) {
  const c = await ctx();
  await archiveItem(c, String(form.get("id")));
  revalidatePath("/catalogue");
  redirect("/catalogue");
}

export async function saveDefaultCoefAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = catalogSettingsInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  await updateDefaultCoef(c, parsed.data.defaultCoef);
  revalidatePath("/catalogue");
  return { ok: "Coefficient enregistré", at: Date.now() };
}

// ─── Import de grilles ────────────────────────────────────────────────────

const UNIT_KEYS = UNITS.map((u) => u.key) as [Unit, ...Unit[]];

const rawRowsInput = z.object({
  supplierId: z.uuid().nullable(),
  fileName: z.string().max(200).nullable(),
  rows: z
    .array(
      z.object({
        supplierRef: z.string().max(80).nullable(),
        name: z.string().min(1).max(300),
        brand: z.string().max(80).nullable(),
        unit: z.enum(UNIT_KEYS),
        purchasePriceCents: z.number().int().min(0).max(1_000_000_000).nullable(),
        category: z.string().max(80).nullable(),
        sourceLine: z.number().int().optional(),
        warnings: z.array(z.string().max(200)).max(5).optional(),
      }),
    )
    .max(MAX_IMPORT_ROWS, { error: `${MAX_IMPORT_ROWS} lignes maximum par import` }),
});

/** Lignes lues dans un fichier Excel/CSV (dans le navigateur) → brouillon d'import. */
export async function createImportFromFileAction(input: unknown): Promise<{ ok: false; error: string }> {
  const c = await ctx();
  const parsed = rawRowsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Lignes invalides" };
  let id: string;
  try {
    id = (await createImportDraft(c, { ...parsed.data, source: "fichier" })).id;
  } catch (err) {
    const msg = known(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
  redirect(`/catalogue/imports/${id}`);
}

export type AiState = { error?: string };

/** Photos ou PDF d'une grille → lecture par l'IA → brouillon d'import (à relire). */
export async function createImportFromAiAction(_prev: AiState, form: FormData): Promise<AiState> {
  const c = await ctx();
  const supplierId = String(form.get("supplierId") ?? "") || null;
  if (supplierId && !z.uuid().safeParse(supplierId).success) return { error: "Fournisseur invalide" };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Ajoutez au moins une photo ou un PDF de la grille." };
  if (files.length > AI_MAX_FILES) return { error: `${AI_MAX_FILES} fichiers maximum à la fois.` };
  if (files.reduce((s, f) => s + f.size, 0) > AI_MAX_BYTES) return { error: "Fichiers trop lourds (4 Mo maximum au total)." };

  let id: string;
  try {
    const { rows, notes } = await extractPriceGrid(
      await Promise.all(files.map(async (f) => ({ mime: f.type, name: f.name, data: Buffer.from(await f.arrayBuffer()) }))),
    );
    id = (
      await createImportDraft(c, {
        supplierId,
        source: "ia",
        fileName: files.map((f) => f.name).join(", "),
        rows,
        notes,
      })
    ).id;
  } catch (err) {
    const msg = known(err);
    if (msg) return { error: msg };
    throw err;
  }
  redirect(`/catalogue/imports/${id}`);
}

export async function applyImportAction(input: unknown): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const c = await ctx();
  const parsed = importApplyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lignes invalides : vérifiez les prix et les désignations." };
  try {
    const summary = await applyImport(c, parsed.data);
    revalidatePath("/catalogue");
    return { ok: true, summary };
  } catch (err) {
    const msg = known(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function abandonImportAction(form: FormData) {
  const c = await ctx();
  const id = String(form.get("id"));
  try {
    await abandonImport(c, id);
  } catch (err) {
    if (!(err instanceof ImportError)) throw err;
  }
  redirect("/catalogue/importer");
}
