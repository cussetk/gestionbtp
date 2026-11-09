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

/**
 * Numéro au format international sans « + » (pour les liens WhatsApp wa.me).
 * Gère les DOM : 0690/0691 et 0590 → 590 (Guadeloupe, St-Martin, St-Barth), 0696/0697 et 0596 → 596 (Martinique),
 * 0694 et 0594 → 594 (Guyane), 0692/0693, 0262/0263 → 262 (La Réunion), 0639/0269 → 262 (Mayotte).
 * Autres numéros commençant par 0 → 33 (métropole).
 */
export function toInternational(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const p = cleanPhone(phone);
  if (p.startsWith("+")) return p.slice(1);
  if (p.startsWith("00")) return p.slice(2);
  if (!/^0\d{9}$/.test(p)) return null;
  const national = p.slice(1);
  const dom: [RegExp, string][] = [
    [/^(690|691|590)/, "590"],
    [/^(696|697|596)/, "596"],
    [/^(694|594)/, "594"],
    [/^(692|693|262|263|639|269)/, "262"],
  ];
  for (const [re, code] of dom) if (re.test(national)) return code + national;
  return "33" + national;
}

/** Lien WhatsApp vers un numéro, avec message pré-rempli. */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const intl = toInternational(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
