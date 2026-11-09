"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveSession, toCtx } from "@/lib/session";
import { ForbiddenError } from "@/lib/permissions";
import { clientInput, fieldErrors, formToObject, siteInput, sitePositionInput } from "@/lib/validation";
import {
  archiveClient,
  archiveSite,
  createClient,
  createSite,
  NotFoundError,
  setSitePosition,
  updateClient,
  updateSite,
  type Ctx,
} from "@/server/clients";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string> };

async function ctx(): Promise<Ctx> {
  return toCtx(await requireActiveSession());
}

function failure(err: unknown, values: Record<string, string>): FormState {
  if (err instanceof NotFoundError || err instanceof ForbiddenError) return { errors: { _form: err.message }, values };
  throw err;
}

export async function saveClientAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = clientInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  let id: string;
  try {
    if (values.mode === "update" && parsed.data.id) {
      id = parsed.data.id;
      await updateClient(c, id, parsed.data);
    } else {
      id = (await createClient(c, parsed.data)).id;
    }
  } catch (err) {
    return failure(err, values);
  }
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function archiveClientAction(form: FormData) {
  const c = await ctx();
  await archiveClient(c, String(form.get("id")));
  revalidatePath("/clients");
  redirect("/clients");
}

export async function saveSiteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const values = formToObject(form);
  const parsed = siteInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  let id: string;
  try {
    if (values.mode === "update" && parsed.data.id) {
      id = parsed.data.id;
      await updateSite(c, id, parsed.data);
    } else {
      id = (await createSite(c, parsed.data)).id;
    }
  } catch (err) {
    return failure(err, values);
  }
  revalidatePath(`/clients/${parsed.data.clientId}`);
  redirect(`/sites/${id}`);
}

export async function archiveSiteAction(form: FormData) {
  const c = await ctx();
  const { clientId } = await archiveSite(c, String(form.get("id")));
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function saveSitePositionAction(input: {
  siteId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await ctx();
  const parsed = sitePositionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Position invalide" };
  try {
    await setSitePosition(c, parsed.data.siteId, parsed.data);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/sites/${parsed.data.siteId}`);
  return { ok: true };
}
