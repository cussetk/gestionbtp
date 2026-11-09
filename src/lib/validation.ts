/**
 * Schémas de validation des formulaires (zod), messages en français.
 * Utilisés côté serveur (vérité) ; réutilisables côté navigateur pour l'affichage.
 */
import { z } from "zod";
import { cleanPhone, isValidSiret } from "./text";
import { parseCoordinates } from "./geo";
import { isPermission } from "./permissions";
import { isValidFrenchVatNumber, isValidIban, LEGAL_FORMS } from "./company";
import { parseRate } from "./tax";

z.config(z.locales.fr());

/** Champ texte facultatif : "" → null. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum` })
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} obligatoire` })
    .trim()
    .min(1, { error: `${label} obligatoire` })
    .max(max, { error: `${max} caractères maximum` });

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, { error: "Adresse e-mail invalide" });

export const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .refine((v) => !v || /^\+?[\d\s.\-()]+$/.test(v), { error: "Numéro de téléphone invalide" })
  .transform((v) => (v ? cleanPhone(v) : null))
  .refine((v) => v === null || /^\+?\d{6,15}$/.test(v), { error: "Numéro de téléphone invalide" });

export const optionalSiret = z
  .string()
  .nullish()
  .transform((v) => (v ? v.replace(/\s/g, "") : null))
  .refine((v) => v === null || isValidSiret(v), { error: "SIRET invalide (14 chiffres)" });

/** Code postal français, y compris DOM (971–976). */
export const postalCode = z
  .string({ error: "Code postal obligatoire" })
  .trim()
  .regex(/^\d{5}$/, { error: "Code postal à 5 chiffres" });

export const optionalPostalCode = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{5}$/.test(v), { error: "Code postal à 5 chiffres" });

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .nullish()
  .transform((v) => v === true || v === "on" || v === "true");

const uuidField = z.uuid({ error: "Identifiant invalide" });

// ─── Clients ────────────────────────────────────────────────────────────────

export const clientInput = z
  .object({
    id: uuidField.optional(),
    type: z.enum(["particulier", "professionnel"], { error: "Type de client invalide" }),
    companyName: optionalText(150),
    firstName: optionalText(100),
    lastName: optionalText(100),
    siret: optionalSiret,
    email: optionalEmail,
    phone: optionalPhone,
    phone2: optionalPhone,
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    postalCode: optionalPostalCode,
    city: optionalText(100),
    notes: optionalText(2000),
    /** À la création : créer aussi un site d'intervention à l'adresse de facturation. */
    createSiteFromAddress: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.type === "professionnel" && !v.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Raison sociale obligatoire" });
    }
    if (v.type === "particulier" && !v.lastName) {
      ctx.addIssue({ code: "custom", path: ["lastName"], message: "Nom obligatoire" });
    }
    // Case cochée par défaut : si aucune adresse n'est saisie, on ne crée simplement pas de site.
    // Si l'adresse est commencée, elle doit être complète.
    const anyAddress = Boolean(v.addressLine1 || v.postalCode || v.city);
    if (v.createSiteFromAddress && anyAddress) {
      if (!v.addressLine1)
        ctx.addIssue({ code: "custom", path: ["addressLine1"], message: "Adresse nécessaire pour créer le site" });
      if (!v.postalCode)
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Code postal nécessaire pour créer le site" });
      if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Ville nécessaire pour créer le site" });
    }
  });
export type ClientInput = z.output<typeof clientInput>;

// ─── Sites d'intervention ──────────────────────────────────────────────────

export const siteInput = z.object({
  id: uuidField.optional(),
  clientId: uuidField,
  label: requiredText("Nom du site", 100),
  addressLine1: requiredText("Adresse", 200),
  addressLine2: optionalText(200),
  postalCode,
  city: requiredText("Ville", 100),
  /** Position : texte « lat, lng » ou lien Maps/WhatsApp ; vide = calculée depuis l'adresse. */
  coordinates: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || parseCoordinates(v) !== null, {
      error: "Position non reconnue : collez « 16.24, -61.53 » ou un lien Google Maps",
    }),
  /** Origine des coordonnées du formulaire : gps (bouton), manuel (collées), adresse (déjà calculées). */
  geoSource: z.enum(["gps", "manuel", "adresse"]).nullish().catch(null),
  geoAccuracyM: z.coerce.number().int().min(0).max(100000).nullish().catch(null),
  accessNotes: optionalText(1000),
  contactName: optionalText(100),
  contactPhone: optionalPhone,
  notes: optionalText(2000),
});
export type SiteInput = z.output<typeof siteInput>;

/** Position relevée sur place depuis la fiche du site. */
export const sitePositionInput = z.object({
  siteId: uuidField,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100000).nullish().catch(null),
});

// ─── Équipe ────────────────────────────────────────────────────────────────

const permissionList = z
  .array(z.string())
  .default([])
  .transform((list) => [...new Set(list.filter(isPermission))]);

export const invitationInput = z.object({
  fullName: requiredText("Nom", 100),
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Adresse e-mail invalide" })),
  title: optionalText(60),
  permissions: permissionList,
});
export type InvitationInput = z.output<typeof invitationInput>;

export const memberUpdateInput = z.object({
  userId: uuidField,
  title: optionalText(60),
  permissions: permissionList,
});
export type MemberUpdateInput = z.output<typeof memberUpdateInput>;

export const acceptInvitationInput = z.object({
  token: z.string().min(20).max(200),
  fullName: requiredText("Votre nom", 100),
  phone: optionalPhone,
  password: z
    .string()
    .min(10, { error: "10 caractères minimum" })
    .max(200, { error: "200 caractères maximum" }),
});

// ─── Comptes ───────────────────────────────────────────────────────────────

export const signUpInput = z.object({
  orgName: requiredText("Nom de l'entreprise", 150),
  fullName: requiredText("Votre nom", 100),
  phone: optionalPhone,
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Adresse e-mail invalide" })),
  password: z
    .string()
    .min(10, { error: "10 caractères minimum" })
    .max(200, { error: "200 caractères maximum" }),
  timezone: z
    .enum(["Europe/Paris", "America/Guadeloupe", "America/Martinique", "America/Cayenne", "Indian/Reunion", "Indian/Mayotte"])
    .default("Europe/Paris"),
});
export type SignUpInput = z.output<typeof signUpInput>;

export const signInInput = z.object({
  email: z.string().trim().toLowerCase().min(1, { error: "E-mail obligatoire" }),
  password: z.string().min(1, { error: "Mot de passe obligatoire" }),
});

export type AcceptInvitationInput = z.output<typeof acceptInvitationInput>;

// ─── Gestionnaire de la plateforme ─────────────────────────────────────────

export const adminStatusInput = z.object({
  orgId: uuidField,
  status: z.enum(["en_attente", "active", "suspendue"]),
  reason: optionalText(500),
});

export const PLANS = ["pilote", "essai", "payant", "gratuit"] as const;
export const adminPlanInput = z.object({ orgId: uuidField, plan: z.enum(PLANS) });
export const adminNoteInput = z.object({ orgId: uuidField, note: requiredText("Note", 2000) });

// ─── Réglages de l'entreprise (lot B) ──────────────────────────────────────

const optionalUpper = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => (v ? v.replace(/\s/g, "").toUpperCase() : null))
    .refine((v) => v === null || v.length <= max, { error: `${max} caractères maximum` });

export const identityInput = z.object({
  name: requiredText("Raison sociale", 150),
  tradeName: optionalText(150),
  legalForm: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || LEGAL_FORMS.some((f) => f.key === v), { error: "Forme juridique inconnue" }),
  siret: optionalSiret,
  shareCapital: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.replace(/\s|€/g, "").replace(",", ".") : null))
    .refine((v) => v === null || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1e10), { error: "Montant invalide (ex. 5000)" }),
  registration: optionalText(120),
  vatNumber: optionalUpper(20).refine((v) => v === null || !v.startsWith("FR") || isValidFrenchVatNumber(v), {
    error: "N° de TVA invalide : FR + 2 chiffres de clé + SIREN",
  }),
  nafCode: optionalUpper(6).refine((v) => v === null || /^\d{2}\.?\d{2}[A-Z]$/.test(v), { error: "Code NAF invalide (ex. 43.22B)" }),
  website: optionalText(200),
  email: optionalEmail,
  phone: optionalPhone,
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  postalCode: optionalPostalCode,
  city: optionalText(100),
  fluidCapacityCertificate: optionalText(100),
  insurerName: optionalText(150),
  insurerAddress: optionalText(300),
  insurancePolicy: optionalText(80),
  insuranceCoverage: optionalText(200),
}).transform(({ shareCapital, ...rest }) => ({
  ...rest,
  shareCapitalCents: shareCapital === null ? null : Math.round(Number(shareCapital) * 100),
}));
export type IdentityInput = z.output<typeof identityInput>;

export const taxSettingsInput = z.object({
  vatRegime: z.enum(["reel", "franchise"]),
  vatOnDebits: checkbox,
});
export type TaxSettingsInput = z.output<typeof taxSettingsInput>;

export const taxRateInput = z
  .object({
    id: uuidField.optional().or(z.literal("").transform(() => undefined)),
    label: requiredText("Libellé", 80),
    rate: z.string({ error: "Taux obligatoire" }).trim().min(1, { error: "Taux obligatoire" }),
    kind: z.enum(["normal", "reduit", "particulier", "exonere", "autoliquidation"]),
    mention: optionalText(300),
    requiresAttestation: checkbox,
  })
  .transform(({ rate, ...rest }, ctx) => {
    const rateBp = parseRate(rate);
    if (rateBp === null) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Taux invalide (ex. 8,5)" });
      return z.NEVER;
    }
    return { ...rest, rateBp };
  });
export type TaxRateInput = z.output<typeof taxRateInput>;

export const seriesInput = z.object({
  docType: z.enum(["devis", "facture", "avoir", "acompte", "commande"]),
  pattern: z.string().trim(),
  padding: z.coerce.number({ error: "Nombre invalide" }).int(),
  reset: z.enum(["annuel", "jamais"]),
});
export type SeriesInput = z.output<typeof seriesInput>;

const PAYMENT_METHODS = ["virement", "cheque", "especes", "carte", "prelevement"] as const;

export const paymentInput = z.object({
  paymentTermsDays: z.coerce
    .number({ error: "Nombre de jours invalide" })
    .int()
    .min(0, { error: "0 jour minimum (paiement à réception)" })
    .max(60, { error: "60 jours maximum à compter de la facture (art. L441-10 du code de commerce)" }),
  latePenaltyText: requiredText("Taux des pénalités de retard", 500),
  earlyPaymentDiscountText: requiredText("Conditions d'escompte", 300),
  quoteValidityDays: z.coerce.number({ error: "Nombre de jours invalide" }).int().min(1).max(365),
  depositPercent: z.coerce.number({ error: "Pourcentage invalide" }).int().min(0).max(100),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  bankName: optionalText(100),
  iban: optionalUpper(34).refine((v) => v === null || isValidIban(v), { error: "IBAN invalide (vérifiez les chiffres)" }),
  bic: optionalUpper(11).refine((v) => v === null || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v), { error: "BIC invalide (8 ou 11 caractères)" }),
  cgv: optionalText(30000),
  quoteFooter: optionalText(1000),
  invoiceFooter: optionalText(1000),
});
export type PaymentInput = z.output<typeof paymentInput>;
export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte bancaire",
  prelevement: "Prélèvement",
};

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, { error: "Couleur invalide" }).transform((v) => v.toLowerCase());

export const brandingInput = z.object({
  primaryColor: hexColor,
  accentColor: hexColor,
  template: z.enum(["classique", "moderne", "epure"]),
  logoPosition: z.enum(["gauche", "centre", "droite"]),
  font: z.enum(["helvetica", "times"]),
});
export type BrandingInput = z.output<typeof brandingInput>;

/** Transforme les erreurs zod en { champ: message } pour les formulaires. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** FormData → objet simple (les champs vides restent des chaînes vides). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Valeurs multiples d'un champ (cases à cocher). */
export function formList(form: FormData, name: string): string[] {
  return form.getAll(name).filter((v): v is string => typeof v === "string");
}
