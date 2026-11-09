/**
 * TVA : taux par défaut selon la zone de l'entreprise, formats d'affichage.
 * Sources (vérifiées nov. 2026) : impots.gouv.fr (taux des DOM), service-public.gouv.fr,
 * BOFiP (mention remplaçant l'attestation de taux réduit, 22/10/2025).
 * Le propriétaire peut tout modifier ; à faire valider par son expert-comptable.
 */

export type TaxKind = "normal" | "reduit" | "particulier" | "exonere" | "autoliquidation";

export type TaxRateDefault = {
  label: string;
  rateBp: number;
  kind: TaxKind;
  mention: string | null;
  requiresAttestation: boolean;
  isDefault: boolean;
};

/**
 * Mention que le client signe sur le devis ou la facture pour bénéficier d'un taux réduit
 * sur des travaux dans un logement de plus de 2 ans (remplace les attestations CERFA 1300/1301).
 * Texte à vérifier par l'entreprise avec son expert-comptable (modèle BOFiP du 22/10/2025).
 */
export const REDUCED_RATE_ATTESTATION =
  "En qualité de preneur de la prestation, j'atteste que les travaux sont réalisés dans des locaux à usage d'habitation achevés depuis plus de deux ans, qu'ils n'ont pas eu pour effet, sur une période de deux ans au plus, de concourir à la production d'un immeuble neuf ni d'augmenter la surface de plancher de plus de 10 %, et qu'ils remplissent les conditions prévues par le code général des impôts pour l'application du taux réduit.";

const AUTOLIQUIDATION: TaxRateDefault = {
  label: "Autoliquidation (sous-traitance BTP)",
  rateBp: 0,
  kind: "autoliquidation",
  mention: "Autoliquidation : TVA due par le preneur (art. 283-2 nonies du CGI)",
  requiresAttestation: false,
  isDefault: false,
};

const METROPOLE: TaxRateDefault[] = [
  { label: "Taux normal", rateBp: 2000, kind: "normal", mention: null, requiresAttestation: false, isDefault: true },
  {
    label: "Travaux de rénovation (logement de plus de 2 ans)",
    rateBp: 1000,
    kind: "reduit",
    mention: null,
    requiresAttestation: true,
    isDefault: false,
  },
  {
    label: "Travaux d'amélioration énergétique",
    rateBp: 550,
    kind: "reduit",
    mention: null,
    requiresAttestation: true,
    isDefault: false,
  },
  AUTOLIQUIDATION,
];

/** Guadeloupe, Martinique, La Réunion : 8,5 % et 2,1 % (opérations relevant de 5,5 % / 10 % en métropole). */
const DOM_TVA: TaxRateDefault[] = [
  { label: "Taux normal", rateBp: 850, kind: "normal", mention: null, requiresAttestation: false, isDefault: true },
  {
    label: "Taux réduit travaux (logement de plus de 2 ans)",
    rateBp: 210,
    kind: "reduit",
    mention: null,
    requiresAttestation: true,
    isDefault: false,
  },
  AUTOLIQUIDATION,
];

/** Guyane et Mayotte : TVA provisoirement non applicable. */
const DOM_SANS_TVA: TaxRateDefault[] = [
  {
    label: "TVA non applicable",
    rateBp: 0,
    kind: "exonere",
    mention: "TVA non applicable (art. 294-1 du CGI)",
    requiresAttestation: false,
    isDefault: true,
  },
];

export const ZONES: { timezone: string; label: string }[] = [
  { timezone: "Europe/Paris", label: "Métropole" },
  { timezone: "America/Guadeloupe", label: "Guadeloupe" },
  { timezone: "America/Martinique", label: "Martinique" },
  { timezone: "America/Cayenne", label: "Guyane" },
  { timezone: "Indian/Reunion", label: "La Réunion" },
  { timezone: "Indian/Mayotte", label: "Mayotte" },
];

export function zoneLabel(timezone: string): string {
  return ZONES.find((z) => z.timezone === timezone)?.label ?? "Métropole";
}

export function defaultTaxRates(timezone: string): TaxRateDefault[] {
  switch (timezone) {
    case "America/Guadeloupe":
    case "America/Martinique":
    case "Indian/Reunion":
      return DOM_TVA;
    case "America/Cayenne":
    case "Indian/Mayotte":
      return DOM_SANS_TVA;
    default:
      return METROPOLE;
  }
}

export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";
export const DEBITS_MENTION = "Option pour le paiement de la taxe d'après les débits";

/** 850 → « 8,5 % », 2000 → « 20 % ». */
export function formatRate(bp: number): string {
  const value = bp / 100;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/ | /g, " ")} %`;
}

/** « 8,5 » ou « 8.5 » → 850. Renvoie null si invalide. */
export function parseRate(input: string): number | null {
  const v = Number(input.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(v) || v < 0 || v > 100) return null;
  return Math.round(v * 100);
}
