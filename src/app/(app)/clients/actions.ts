"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { clientInput, fieldErrors, formToObject, siteInput } from "@/lib/validation";
import {
  archiveClient,
  archiveSite,
  createClient,
  createSite,
  NotFoundError,
  updateClient,
  updateSite,
  type Ctx,
} from "@/server/clients";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string> };

async function ctx(): Promise<Ctx> {
  const s = await requireSession();
  return { orgId: s.orgId, userId: s.userId };
}

function failure(err: unknown, values: Record<string, string>): FormState {
  if (err instanceof NotFoundError) return { errors: { _form: err.message }, values };
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
