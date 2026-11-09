/**
 * Catalogue : unités, natures d'article, prix et marges (fonctions pures, navigateur et serveur).
 * Montants en centimes HT ; coefficient ×1000 (1400 = × 1,4).
 */

export const ITEM_KINDS = [
  { key: "produit", label: "Produit", plural: "Produits", hint: "Matériel et fournitures (biens)" },
  { key: "main_oeuvre", label: "Main-d'œuvre", plural: "Main-d'œuvre", hint: "Taux horaire, journée de pose" },
  { key: "prestation", label: "Prestation", plural: "Prestations", hint: "Forfait pose, entretien, déplacement" },
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number]["key"];

export function kindLabel(kind: string): string {
  return ITEM_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export const UNITS = [
  { key: "u", label: "unité", short: "u" },
  { key: "h", label: "heure", short: "h" },
  { key: "j", label: "jour", short: "j" },
  { key: "forfait", label: "forfait", short: "forfait" },
  { key: "m", label: "mètre", short: "m" },
  { key: "m2", label: "mètre carré", short: "m²" },
  { key: "m3", label: "mètre cube", short: "m³" },
  { key: "kg", label: "kilogramme", short: "kg" },
  { key: "l", label: "litre", short: "l" },
  { key: "lot", label: "lot", short: "lot" },
  { key: "ens", label: "ensemble", short: "ens." },
] as const;
export type Unit = (typeof UNITS)[number]["key"];

export function unitShort(unit: string): string {
  return UNITS.find((u) => u.key === unit)?.short ?? unit;
}

/** Reconnaît une unité écrite librement dans une grille fournisseur (« Pièce », « ML », « m² »…). */
export function guessUnit(raw: string | null | undefined): Unit | null {
  if (!raw) return null;
  const v = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\s]/g, "");
  if (!v) return null;
  if (["u", "un", "unite", "unites", "pce", "pc", "pcs", "piece", "pieces", "p", "ex", "ea", "unit"].includes(v)) return "u";
  if (["m", "ml", "metre", "metres", "mlineaire", "metrelineaire"].includes(v)) return "m";
  if (["m2", "m²", "metrecarre"].includes(v)) return "m2";
  if (["m3", "m³"].includes(v)) return "m3";
  if (["kg", "kilo", "kilos"].includes(v)) return "kg";
  if (["l", "litre", "litres"].includes(v)) return "l";
  if (["h", "heure", "heures", "hr"].includes(v)) return "h";
  if (["j", "jour", "jours"].includes(v)) return "j";
  if (["forfait", "fft", "ft", "forf"].includes(v)) return "forfait";
  if (["lot", "lots"].includes(v)) return "lot";
  if (["ens", "ensemble", "kit", "set"].includes(v)) return "ens";
  return null;
}

/**
 * « 1 234,56 € », « 1234.56 », « 1.234,56 » → centimes. Renvoie null si illisible ou négatif.
 */
export function parseEuros(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  let v = raw.replace(/[\s  €]|EUR|HT/gi, "");
  if (!v) return null;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le séparateur décimal, l'autre sert aux milliers.
    v = lastComma > lastDot ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  } else if (lastComma > -1) {
    v = v.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n > 10_000_000) return null;
  return Math.round(n * 100);
}

/** 125050 → « 1 250,50 » (sans symbole, pour les champs de saisie). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** « 1,4 », « 1.40 », « x1,35 » → 1400. Coefficient entre 0,1 et 20. */
export function parseCoef(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const v = Number(raw.replace(/[x×\s]/gi, "").replace(",", "."));
  if (!Number.isFinite(v) || v < 0.1 || v > 20) return null;
  return Math.round(v * 1000);
}

/** 1400 → « 1,4 », 1350 → « 1,35 ». */
export function formatCoef(x1000: number | null | undefined): string {
  if (!x1000) return "";
  return (x1000 / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

/** Prix de vente = prix d'achat × coefficient, arrondi au centime. */
export function salePriceFromCoef(purchaseCents: number, coefX1000: number): number {
  return Math.round((purchaseCents * coefX1000) / 1000);
}

/** Marge brute en centimes et en % du prix de vente (taux de marque). */
export function margin(purchaseCents: number | null | undefined, saleCents: number) {
  if (purchaseCents === null || purchaseCents === undefined) return null;
  const amount = saleCents - purchaseCents;
  const rate = saleCents > 0 ? amount / saleCents : null;
  return { amount, rate };
}

/** Variation d'un prix en % (arrondie à 0,1). */
export function priceChangePercent(before: number | null | undefined, after: number | null | undefined): number | null {
  if (!before || after === null || after === undefined) return null;
  return Math.round(((after - before) / before) * 1000) / 10;
}

export function formatPercent(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`.replace(/ /g, " ");
}

/** Montant affiché : « 1 250,50 € » (espaces ordinaires, compatibles PDF). */
export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`.replace(
    /[  ]/g,
    " ",
  );
}
