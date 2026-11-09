/**
 * Schémas de validation des formulaires (zod), messages en français.
 * Utilisés côté serveur (vérité) ; réutilisables côté navigateur pour l'affichage.
 */
import { z } from "zod";
import { cleanPhone, isValidSiret } from "./text";
import { parseCoordinates } from "./geo";
import { isPermission } from "./permissions";

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
