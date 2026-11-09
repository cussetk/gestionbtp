/** Rubriques des réglages (partagé entre le menu et la page d'accueil). */
import type { IconName } from "@/components/ui";

export const SETTINGS_SECTIONS: { href: string; label: string; hint: string; icon: IconName }[] = [
  { href: "/reglages", label: "Vue d'ensemble", hint: "Ce qui manque pour des documents conformes", icon: "check" },
  { href: "/reglages/entreprise", label: "Entreprise", hint: "Identité légale, siège, assurance décennale", icon: "building" },
  { href: "/reglages/tva", label: "TVA", hint: "Régime et taux proposés sur les lignes", icon: "receipt" },
  { href: "/reglages/numerotation", label: "Numérotation", hint: "Format des numéros de devis et factures", icon: "doc" },
  { href: "/reglages/documents", label: "Mise en page", hint: "Logo, couleurs, modèle des documents", icon: "edit" },
  { href: "/reglages/paiement", label: "Paiement et CGV", hint: "Échéances, pénalités, IBAN, conditions de vente", icon: "key" },
];
