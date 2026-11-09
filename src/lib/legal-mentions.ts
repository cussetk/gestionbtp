/**
 * Mentions légales imprimées sur les devis et factures, construites à partir des réglages.
 * Le logiciel les ajoute toujours : l'utilisateur ne peut pas les retirer.
 */
import { formatEuros, isSociety, legalFormLabel } from "./company";
import { DEBITS_MENTION, FRANCHISE_MENTION } from "./tax";

export type MentionsInput = {
  org: {
    name: string;
    siret: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
  };
  settings: {
    legalForm: string | null;
    tradeName: string | null;
    shareCapitalCents: number | null;
    registration: string | null;
    vatNumber: string | null;
    vatRegime: "reel" | "franchise";
    vatOnDebits: boolean;
    insurerName: string | null;
    insurerAddress: string | null;
    insurancePolicy: string | null;
    insuranceCoverage: string | null;
    paymentTermsDays: number;
    latePenaltyText: string | null;
    earlyPaymentDiscountText: string | null;
    website: string | null;
  };
};

export function companyAddress(org: MentionsInput["org"]): string {
  return [org.addressLine1, org.addressLine2, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Ligne d'identité légale : forme, capital, SIREN, immatriculation, TVA. */
export function identityLine({ org, settings: s }: MentionsInput): string {
  const parts: string[] = [];
  const individual = s.legalForm === "EI" || s.legalForm === "MICRO";
  parts.push(individual ? `${org.name}, entrepreneur individuel (EI)` : org.name);
  if (!individual && s.legalForm) {
    parts.push(
      isSociety(s.legalForm) && s.shareCapitalCents != null
        ? `${legalFormLabel(s.legalForm)} au capital de ${formatEuros(s.shareCapitalCents, { decimals: s.shareCapitalCents % 100 !== 0 })}`
        : legalFormLabel(s.legalForm),
    );
  }
  if (org.siret) parts.push(`SIRET ${org.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}`);
  if (s.registration) parts.push(s.registration);
  if (s.vatRegime === "reel" && s.vatNumber) parts.push(`TVA ${s.vatNumber}`);
  const address = companyAddress(org);
  if (address) parts.push(`Siège : ${address}`);
  return parts.join(" – ");
}

export function insuranceLine({ settings: s }: MentionsInput): string | null {
  if (!s.insurerName) return null;
  const parts = [`Assurance décennale : ${s.insurerName}`];
  if (s.insurerAddress) parts.push(s.insurerAddress);
  if (s.insurancePolicy) parts.push(`contrat n° ${s.insurancePolicy}`);
  if (s.insuranceCoverage) parts.push(`couverture géographique : ${s.insuranceCoverage}`);
  return parts.join(", ");
}

/**
 * Mentions de paiement et fiscales.
 * @param kind devis ou facture
 * @param clientIsPro client professionnel (indemnité de 40 €)
 */
export function paymentMentions(
  { settings: s }: MentionsInput,
  kind: "devis" | "facture",
  clientIsPro: boolean,
): string[] {
  const lines: string[] = [];
  if (kind === "facture") {
    lines.push(
      s.paymentTermsDays === 0 ? "Paiement à réception de la facture." : `Paiement à ${s.paymentTermsDays} jours à compter de la date de facture.`,
    );
  }
  if (s.earlyPaymentDiscountText) lines.push(s.earlyPaymentDiscountText);
  if (s.latePenaltyText) lines.push(s.latePenaltyText);
  if (clientIsPro) lines.push("Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. L441-10 du code de commerce).");
  if (s.vatRegime === "franchise") lines.push(FRANCHISE_MENTION);
  if (s.vatRegime === "reel" && s.vatOnDebits) lines.push(DEBITS_MENTION);
  return lines;
}
