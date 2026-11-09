/** Identité légale des entreprises (partagé serveur / navigateur). */

export const LEGAL_FORMS: { key: string; label: string; society: boolean }[] = [
  { key: "EI", label: "Entreprise individuelle (EI)", society: false },
  { key: "MICRO", label: "Micro-entreprise (EI)", society: false },
  { key: "EURL", label: "EURL", society: true },
  { key: "SARL", label: "SARL", society: true },
  { key: "SASU", label: "SASU", society: true },
  { key: "SAS", label: "SAS", society: true },
  { key: "SA", label: "SA", society: true },
  { key: "SCOP", label: "SCOP", society: true },
  { key: "AUTRE", label: "Autre", society: true },
];

export function legalFormLabel(key: string | null | undefined): string {
  return LEGAL_FORMS.find((f) => f.key === key)?.label ?? "";
}

/** Forme sociale (capital et immatriculation obligatoires sur les factures). */
export function isSociety(key: string | null | undefined): boolean {
  return LEGAL_FORMS.find((f) => f.key === key)?.society ?? false;
}

/** Code « nature juridique » INSEE → forme juridique de l'application. */
export function legalFormFromInsee(code: string | null | undefined, individual?: boolean): string | null {
  if (!code) return individual ? "EI" : null;
  if (code === "1000" || individual) return "EI";
  if (code === "5498") return "EURL";
  if (code.startsWith("54")) return code === "5458" ? "SCOP" : "SARL";
  if (code === "5720") return "SASU";
  if (code === "5710") return "SAS";
  if (code.startsWith("55") || code.startsWith("56")) return "SA";
  return "AUTRE";
}

/** N° de TVA intracommunautaire français calculé à partir du SIREN : FR + clé + SIREN. */
export function vatNumberFromSiren(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

export function isValidFrenchVatNumber(vat: string): boolean {
  const v = vat.replace(/\s/g, "").toUpperCase();
  const m = v.match(/^FR(\d{2})(\d{9})$/);
  if (!m) return false;
  return vatNumberFromSiren(m[2]) === v;
}

/** IBAN : contrôle du format et de la clé (ISO 13616, modulo 97). */
export function isValidIban(iban: string): boolean {
  const v = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

export function formatIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

/** 1500000 centimes → « 15 000 € » (espaces ordinaires, compatibles avec les PDF). */
export function formatEuros(cents: number, opts: { decimals?: boolean } = {}): string {
  const value = cents / 100;
  const s = value.toLocaleString("fr-FR", {
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  });
  return `${s.replace(/ | /g, " ")} €`;
}
