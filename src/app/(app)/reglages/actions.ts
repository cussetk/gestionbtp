"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toCtx } from "@/lib/session";
import { ForbiddenError } from "@/lib/permissions";
import {
  brandingInput,
  fieldErrors,
  formList,
  formToObject,
  identityInput,
  paymentInput,
  seriesInput,
  taxRateInput,
  taxSettingsInput,
} from "@/lib/validation";
import {
  deleteLogo,
  resetTaxRates,
  saveLogo,
  saveTaxRate,
  setDefaultTaxRate,
  setTaxRateActive,
  SettingsError,
  updateBranding,
  updateIdentity,
  updatePayment,
  updateSeries,
  updateTaxSettings,
} from "@/server/settings";
import { lookupCompany, type CompanyLookup } from "@/server/siret-lookup";
import { NotFoundError } from "@/server/clients";

export type SettingsState = { errors?: Record<string, string>; values?: Record<string, string>; ok?: string; at?: number };

async function ctx() {
  return toCtx(await requirePermission("reglages.gerer"));
}

function done(message: string): SettingsState {
  revalidatePath("/reglages", "layout");
  return { ok: message, at: Date.now() };
}

function failed(err: unknown, values?: Record<string, string>): SettingsState {
  if (err instanceof SettingsError) return { errors: { [err.field ?? "_form"]: err.message }, values };
  if (err instanceof NotFoundError || err instanceof ForbiddenError) return { errors: { _form: err.message }, values };
  throw err;
}

export async function saveIdentityAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = identityInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await updateIdentity(c, parsed.data);
  } catch (err) {
    return failed(err, values);
  }
  return done("Informations de l'entreprise enregistrées");
}

export async function lookupSiretAction(siret: string): Promise<{ ok: true; data: CompanyLookup } | { ok: false; error: string }> {
  await ctx();
  const data = await lookupCompany(siret);
  if (!data) return { ok: false, error: "Entreprise introuvable dans l'annuaire officiel. Vérifiez le SIRET ou remplissez à la main." };
  return { ok: true, data };
}

export async function saveTaxSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const parsed = taxSettingsInput.safeParse(formToObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await updateTaxSettings(c, parsed.data);
  return done("Régime de TVA enregistré");
}

export async function saveTaxRateAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = taxRateInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await saveTaxRate(c, parsed.data);
  } catch (err) {
    return failed(err, values);
  }
  return done(parsed.data.id ? "Taux modifié" : "Taux ajouté");
}

export async function taxRateCommandAction(form: FormData) {
  const c = await ctx();
  const id = String(form.get("id") ?? "");
  const command = String(form.get("command"));
  try {
    if (command === "default") await setDefaultTaxRate(c, id);
    if (command === "activate") await setTaxRateActive(c, id, true);
    if (command === "deactivate") await setTaxRateActive(c, id, false);
    if (command === "reset") await resetTaxRates(c);
  } catch (err) {
    if (!(err instanceof SettingsError)) throw err;
  }
  revalidatePath("/reglages", "layout");
}

export async function saveSeriesAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const values = formToObject(form);
  // Le champ s'appelle « resetPolicy » : un champ « reset » masquerait form.reset() dans le navigateur.
  const parsed = seriesInput.safeParse({ ...values, reset: values.resetPolicy });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await updateSeries(c, parsed.data);
  } catch (err) {
    return failed(err, values);
  }
  return done("Format enregistré");
}

export async function savePaymentAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = paymentInput.safeParse({ ...values, paymentMethods: formList(form, "paymentMethods") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  await updatePayment(c, parsed.data);
  return done("Conditions de paiement enregistrées");
}

export async function saveBrandingAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = brandingInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  await updateBranding(c, parsed.data);
  return done("Mise en page enregistrée");
}

/** Logo déjà redimensionné dans le navigateur (PNG ou JPEG en base64). */
export async function uploadLogoAction(input: { base64: string; width: number; height: number }): Promise<SettingsState> {
  const c = await ctx();
  try {
    const data = Buffer.from(input.base64, "base64");
    await saveLogo(c, { data, width: Math.round(input.width), height: Math.round(input.height) });
  } catch (err) {
    return failed(err);
  }
  return done("Logo enregistré");
}

export async function deleteLogoAction(): Promise<SettingsState> {
  const c = await ctx();
  await deleteLogo(c);
  return done("Logo supprimé");
}
