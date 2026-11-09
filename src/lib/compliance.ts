/**
 * Contrôle des informations obligatoires avant d'émettre des devis et factures.
 * « bloquant » : la facture serait non conforme ; l'émission sera refusée tant que ce n'est pas réglé.
 * « conseil » : recommandé (ou nécessaire pour un module précis).
 */
import { isValidSiret } from "./text";
import { isSociety, isValidFrenchVatNumber, isValidIban } from "./company";

export type ComplianceIssue = {
  key: string;
  label: string;
  why: string;
  level: "bloquant" | "conseil";
  href: string;
};

export type ComplianceInput = {
  org: {
    name: string;
    siret: string | null;
    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    fluidCapacityCertificate: string | null;
  };
  settings: {
    legalForm: string | null;
    shareCapitalCents: number | null;
    registration: string | null;
    vatRegime: "reel" | "franchise";
    vatNumber: string | null;
    insurerName: string | null;
    insurancePolicy: string | null;
    insuranceCoverage: string | null;
    iban: string | null;
    cgv: string | null;
  };
  activeTaxRates: number;
  hasLogo: boolean;
};

export function checkCompliance(input: ComplianceInput): ComplianceIssue[] {
  const { org, settings: s } = input;
  const issues: ComplianceIssue[] = [];
  const add = (issue: ComplianceIssue) => issues.push(issue);
  const ent = "/reglages/entreprise";

  if (!s.legalForm) {
    add({ key: "legalForm", label: "Forme juridique", why: "Obligatoire sur les factures (ex. SARL, SAS, EI).", level: "bloquant", href: ent });
  }
  if (!org.siret || !isValidSiret(org.siret)) {
    add({ key: "siret", label: "SIRET", why: "Le SIREN doit figurer sur chaque facture.", level: "bloquant", href: ent });
  }
  if (!org.addressLine1 || !org.postalCode || !org.city) {
    add({ key: "address", label: "Adresse du siège", why: "Obligatoire sur les devis et factures.", level: "bloquant", href: ent });
  }
  if (isSociety(s.legalForm)) {
    if (s.shareCapitalCents == null) {
      add({ key: "capital", label: "Capital social", why: "Obligatoire pour une société.", level: "bloquant", href: ent });
    }
    if (!s.registration) {
      add({ key: "registration", label: "Immatriculation (RCS ou RM)", why: "Ville du greffe ou n° au répertoire des métiers.", level: "bloquant", href: ent });
    }
  }
  if (s.vatRegime === "reel") {
    if (!s.vatNumber) {
      add({ key: "vatNumber", label: "N° de TVA intracommunautaire", why: "Obligatoire si vous facturez la TVA.", level: "bloquant", href: ent });
    } else if (!isValidFrenchVatNumber(s.vatNumber)) {
      add({ key: "vatNumber", label: "N° de TVA intracommunautaire", why: "Le numéro ne correspond pas au format FR + clé + SIREN.", level: "bloquant", href: ent });
    }
    if (input.activeTaxRates === 0) {
      add({ key: "taxRates", label: "Taux de TVA", why: "Aucun taux actif pour vos lignes de devis.", level: "bloquant", href: "/reglages/tva" });
    }
  }
  if (!s.insurerName || !s.insurancePolicy || !s.insuranceCoverage) {
    add({
      key: "insurance",
      label: "Assurance décennale",
      why: "Assureur, n° de contrat et zone couverte sont obligatoires sur les devis et factures des artisans du bâtiment.",
      level: "bloquant",
      href: ent,
    });
  }

  if (!org.phone && !org.email) {
    add({ key: "contact", label: "Téléphone ou e-mail de l'entreprise", why: "Pour que vos clients vous joignent.", level: "conseil", href: ent });
  }
  if (!s.iban) {
    add({ key: "iban", label: "Coordonnées bancaires", why: "Pour être payé par virement.", level: "conseil", href: "/reglages/paiement" });
  } else if (!isValidIban(s.iban)) {
    add({ key: "iban", label: "IBAN", why: "L'IBAN saisi n'est pas valide (clé incorrecte).", level: "bloquant", href: "/reglages/paiement" });
  }
  if (!s.cgv) {
    add({ key: "cgv", label: "Conditions générales de vente", why: "Recommandées pour les travaux et dépannages.", level: "conseil", href: "/reglages/paiement" });
  }
  if (!input.hasLogo) {
    add({ key: "logo", label: "Logo", why: "Vos devis et factures à votre image.", level: "conseil", href: "/reglages/documents" });
  }
  if (!org.fluidCapacityCertificate) {
    add({
      key: "fluid",
      label: "Attestation de capacité (fluides)",
      why: "Nécessaire pour la fiche d'intervention CERFA 15497.",
      level: "conseil",
      href: ent,
    });
  }
  return issues;
}
