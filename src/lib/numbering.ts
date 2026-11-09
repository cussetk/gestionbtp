/**
 * Numérotation des documents (règles légales : séquence chronologique et continue, sans trou ni doublon).
 * Partagé serveur / navigateur (aperçu en direct).
 */

export type DocType = "devis" | "facture" | "avoir" | "acompte" | "commande";
export type NumberReset = "annuel" | "jamais";

export const DOC_TYPES: { key: DocType; label: string; plural: string; legal: boolean }[] = [
  { key: "devis", label: "Devis", plural: "devis", legal: false },
  { key: "facture", label: "Facture", plural: "factures", legal: true },
  { key: "acompte", label: "Facture d'acompte", plural: "factures d'acompte", legal: true },
  { key: "avoir", label: "Avoir", plural: "avoirs", legal: true },
  { key: "commande", label: "Bon de commande", plural: "bons de commande", legal: false },
];

export const DEFAULT_SERIES: Record<DocType, { pattern: string; padding: number; reset: NumberReset }> = {
  devis: { pattern: "DEV-{AAAA}-{N}", padding: 4, reset: "annuel" },
  facture: { pattern: "FAC-{AAAA}-{N}", padding: 4, reset: "annuel" },
  acompte: { pattern: "ACP-{AAAA}-{N}", padding: 4, reset: "annuel" },
  avoir: { pattern: "AV-{AAAA}-{N}", padding: 4, reset: "annuel" },
  commande: { pattern: "BC-{AAAA}-{N}", padding: 4, reset: "annuel" },
};

const TOKEN = /\{(AAAA|AA|MM|N)\}/g;
const ALLOWED_LITERAL = /^[A-Za-z0-9\-_/.]*$/;

/** Date « locale » de l'entreprise (année et mois dans son fuseau). */
export function localYearMonth(date: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

export function formatDocNumber(
  pattern: string,
  n: number,
  opts: { padding: number; date: Date; timeZone: string },
): string {
  const { year, month } = localYearMonth(opts.date, opts.timeZone);
  return pattern.replace(TOKEN, (_, token: string) => {
    switch (token) {
      case "AAAA":
        return String(year);
      case "AA":
        return String(year).slice(-2);
      case "MM":
        return String(month).padStart(2, "0");
      default:
        return String(n).padStart(opts.padding, "0");
    }
  });
}

/** Vérifie un format ; renvoie le message d'erreur ou null. */
export function validatePattern(pattern: string, padding: number, reset: NumberReset): string | null {
  if (!pattern.trim()) return "Indiquez un format";
  const counters = pattern.match(/\{N\}/g)?.length ?? 0;
  if (counters !== 1) return "Le format doit contenir le compteur {N} une seule fois";
  const literal = pattern.replace(TOKEN, "");
  if (/[{}]/.test(literal)) return "Jetons reconnus : {AAAA}, {AA}, {MM} et {N}";
  if (!ALLOWED_LITERAL.test(literal)) return "Lettres, chiffres et - _ / . uniquement (pas d'espace ni d'accent)";
  if (reset === "annuel" && !/\{(AAAA|AA)\}/.test(pattern)) {
    return "Avec une remise à zéro chaque année, l'année ({AAAA}) doit figurer dans le numéro, sinon les numéros se répéteraient";
  }
  if (padding < 1 || padding > 8) return "Nombre de chiffres du compteur : entre 1 et 8";
  if (pattern.length > 30) return "30 caractères maximum";
  return null;
}

/**
 * Numéro suivant d'une série (sans l'attribuer).
 * Remise à zéro annuelle : le compteur repart à 1 au changement d'année.
 */
export function nextCounter(
  series: { lastNumber: number; lastYear: number | null; reset: NumberReset },
  year: number,
): number {
  if (series.reset === "annuel" && series.lastYear !== null && series.lastYear !== year) return 1;
  return series.lastNumber + 1;
}
