"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveSession, toCtx } from "@/lib/session";
import { assertCan, ForbiddenError } from "@/lib/permissions";
import { fieldErrors, formToObject, supplierInput } from "@/lib/validation";
import { NotFoundError } from "@/server/clients";
import { archiveSupplier, createSupplier, updateSupplier } from "@/server/suppliers";
import { lookupCompany, type CompanyLookup } from "@/server/siret-lookup";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string> };

async function ctx() {
  return toCtx(await requireActiveSession());
}

export async function saveSupplierAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = supplierInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  let id: string;
  try {
    if (values.mode === "update" && parsed.data.id) {
      id = parsed.data.id;
      await updateSupplier(c, id, parsed.data);
    } else {
      id = (await createSupplier(c, parsed.data)).id;
    }
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) return { errors: { _form: err.message }, values };
    throw err;
  }
  revalidatePath("/fournisseurs");
  redirect(`/fournisseurs/${id}`);
}

export async function archiveSupplierAction(form: FormData) {
  const c = await ctx();
  await archiveSupplier(c, String(form.get("id")));
  revalidatePath("/fournisseurs");
  redirect("/fournisseurs");
}

export async function lookupSupplierAction(siret: string): Promise<{ ok: true; data: CompanyLookup } | { ok: false; error: string }> {
  const c = await ctx();
  assertCan(c, "achats.gerer");
  const data = await lookupCompany(siret);
  if (!data) return { ok: false, error: "Entreprise introuvable dans l'annuaire officiel. Vérifiez le SIRET ou remplissez à la main." };
  return { ok: true, data };
}
