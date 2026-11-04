/** Utilitaires texte partagés (serveur et navigateur). */

/** Minuscules, sans accents, espaces simplifiés — pour la recherche. */
export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Garde uniquement les chiffres (et un + initial). */
export function cleanPhone(value: string): string {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** 0690123456 → 06 90 12 34 56 ; +590690123456 → +590 690 12 34 56 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  if (/^0\d{9}$/.test(value)) return value.replace(/(\d{2})(?=\d)/g, "$1 ");
  const dom = value.match(/^\+(590|594|596|262|269|33)(\d{9})$/);
  if (dom) {
    const [, code, rest] = dom;
    return `+${code} ${rest.slice(0, 3)} ${rest.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return value;
}

/** Vérifie un SIRET (14 chiffres, clé de Luhn ; exception La Poste). */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  if (siret.startsWith("356000000")) {
    // La Poste : la somme des chiffres doit être un multiple de 5.
    const sum = siret.split("").reduce((s, d) => s + Number(d), 0);
    return sum % 5 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(siret[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Échappe les jokers SQL LIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
