/**
 * Import de grilles de prix fournisseurs : lecture d'un tableau (CSV, Excel ou lignes lues par l'IA),
 * reconnaissance des colonnes et préparation des lignes à valider.
 * Fonctions pures, utilisées dans le navigateur (lecture du fichier) et sur le serveur (contrôle).
 */
import { guessUnit, parseEuros, type ItemKind, type Unit } from "./catalog";

/** Ligne brute lue dans la grille, avant rapprochement avec le catalogue. */
export type RawRow = {
  supplierRef: string | null;
  name: string;
  brand: string | null;
  unit: Unit;
  purchasePriceCents: number | null;
  category: string | null;
  /** Ligne d'origine dans le fichier ou n° de page (aide à la relecture). */
  sourceLine?: number;
  warnings?: string[];
};

export type ImportAction = "creer" | "maj" | "ignorer";

/** Ligne du brouillon d'import, enrichie du rapprochement avec le catalogue. */
export type ImportRow = RawRow & {
  key: string;
  kind: ItemKind;
  action: ImportAction;
  warnings: string[];
  matchItemId: string | null;
  match: null | {
    name: string;
    purchasePriceCents: number | null;
    salePriceCents: number;
    pricingMode: "coef" | "fixe";
    coefX1000: number | null;
  };
};

export const MAX_IMPORT_ROWS = 3000;

// ─── Colonnes ──────────────────────────────────────────────────────────────

export type ColumnField = "supplierRef" | "name" | "brand" | "unit" | "price" | "category";

export const COLUMN_FIELDS: { key: ColumnField; label: string; required?: boolean; patterns: RegExp[] }[] = [
  { key: "supplierRef", label: "Référence fournisseur", patterns: [/^r[ée]f/, /r[ée]f[ée]rence/, /^code/, /code article/, /^article$/, /sku/, /^ean/] },
  { key: "name", label: "Désignation", required: true, patterns: [/d[ée]signation/, /libell/, /description/, /^produit/, /^nom/, /^article/] },
  { key: "brand", label: "Marque", patterns: [/marque/, /fabricant/, /constructeur/, /brand/] },
  { key: "unit", label: "Unité", patterns: [/^unit/, /^u\.?v\.?$/, /^uv/, /cond/] },
  { key: "price", label: "Prix d'achat HT", required: true, patterns: [/net/, /prix/, /tarif/, /^p\.?u/, /montant/, /price/] },
  { key: "category", label: "Famille", patterns: [/famille/, /cat[ée]gorie/, /gamme/, /rayon/] },
];

export type ColumnMapping = Partial<Record<ColumnField, number>>;

function norm(cell: unknown): string {
  return String(cell ?? "")
    .trim()
    .toLowerCase();
}

function fieldFor(header: string): ColumnField | null {
  const h = norm(header);
  if (!h) return null;
  for (const f of COLUMN_FIELDS) if (f.patterns.some((p) => p.test(h))) return f.key;
  return null;
}

/** Trouve la ligne d'en-tête parmi les 20 premières (celle qui nomme le plus de colonnes connues). */
export function detectHeaderRow(rows: unknown[][]): number {
  let best = -1;
  let bestScore = 1;
  rows.slice(0, 20).forEach((row, i) => {
    const fields = new Set(row.map((c) => fieldFor(String(c ?? ""))).filter(Boolean));
    if (fields.size > bestScore) {
      best = i;
      bestScore = fields.size;
    }
  });
  return best;
}

/**
 * Associe chaque information à une colonne d'après les intitulés.
 * Pour le prix, une colonne « net » est préférée à « public » ou « brut ».
 */
export function guessMapping(header: unknown[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  header.forEach((cell, i) => {
    const f = fieldFor(String(cell ?? ""));
    if (f && mapping[f] === undefined) mapping[f] = i;
  });
  const priceCols = header
    .map((c, i) => ({ h: norm(c), i }))
    .filter(({ h }) => /prix|tarif|net|^p\.?u|montant|price/.test(h));
  const net = priceCols.find(({ h }) => /net|achat|remis/.test(h));
  if (net) mapping.price = net.i;
  return mapping;
}

/** Transforme le tableau en lignes brutes. `discountPercent` : remise à appliquer si les prix sont des prix publics. */
export function rowsFromTable(
  rows: unknown[][],
  headerIndex: number,
  mapping: ColumnMapping,
  discountPercent = 0,
): RawRow[] {
  const get = (row: unknown[], f: ColumnField) => {
    const i = mapping[f];
    if (i === undefined || i < 0) return null;
    const v = row[i];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s : null;
  };
  const factor = 1 - Math.min(Math.max(discountPercent, 0), 100) / 100;
  const out: RawRow[] = [];
  rows.forEach((row, idx) => {
    if (idx <= headerIndex) return;
    const name = get(row, "name");
    if (!name) return;
    const rawPrice = mapping.price !== undefined ? row[mapping.price] : null;
    const price = typeof rawPrice === "number" ? parseEuros(rawPrice) : parseEuros(rawPrice == null ? null : String(rawPrice));
    const warnings: string[] = [];
    if (price === null) warnings.push("Prix illisible ou absent");
    const unitRaw = get(row, "unit");
    const unit = guessUnit(unitRaw);
    if (unitRaw && !unit) warnings.push(`Unité « ${unitRaw} » non reconnue : « unité » par défaut`);
    out.push({
      supplierRef: get(row, "supplierRef")?.slice(0, 80) ?? null,
      name: name.slice(0, 300),
      brand: get(row, "brand")?.slice(0, 80) ?? null,
      unit: unit ?? "u",
      purchasePriceCents: price === null ? null : Math.round(price * factor),
      category: get(row, "category")?.slice(0, 80) ?? null,
      sourceLine: idx + 1,
      warnings,
    });
  });
  return out;
}

// ─── CSV ───────────────────────────────────────────────────────────────────

/** Lit un CSV (séparateur ; , ou tabulation détecté, guillemets gérés). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? undefined : clean.indexOf("\n"));
  const counts = [";", ",", "\t"].map((d) => ({ d, n: firstLine.split(d).length }));
  const delim = counts.sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ─── Rapprochement ────────────────────────────────────────────────────────

export function normalizeRef(ref: string | null | undefined): string {
  return (ref ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Signale les références présentes plusieurs fois dans la grille (seule la première est retenue). */
export function markDuplicates<T extends { supplierRef: string | null; warnings?: string[]; action?: ImportAction }>(rows: T[]): T[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = normalizeRef(r.supplierRef);
    if (!k) continue;
    if (seen.has(k)) {
      r.warnings = [...(r.warnings ?? []), "Référence en double dans la grille : ligne ignorée"];
      if ("action" in r) r.action = "ignorer";
    }
    seen.add(k);
  }
  return rows;
}
