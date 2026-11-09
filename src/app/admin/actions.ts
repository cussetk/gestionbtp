"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/session";
import { adminNoteInput, adminPlanInput, adminStatusInput, fieldErrors, formToObject } from "@/lib/validation";
import { addAdminNote, setOrganizationPlan, setOrganizationStatus } from "@/server/admin";

export type AdminFormState = { errors?: Record<string, string>; ok?: string; status?: "en_attente" | "active" | "suspendue" };

async function adminCtx() {
  const s = await requirePlatformAdmin();
  return { userId: s.userId, isPlatformAdmin: s.isPlatformAdmin };
}

export async function setStatusAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const ctx = await adminCtx();
  const parsed = adminStatusInput.safeParse(formToObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.status === "suspendue" && !parsed.data.reason) {
    return { errors: { reason: "Indiquez le motif : il sera affiché au client." } };
  }
  await setOrganizationStatus(ctx, parsed.data.orgId, parsed.data.status, parsed.data.reason);
  revalidatePath("/admin");
  revalidatePath(`/admin/${parsed.data.orgId}`);
  const labels = { active: "Espace validé", suspendue: "Espace suspendu", en_attente: "Espace remis en attente" };
  return { ok: labels[parsed.data.status], status: parsed.data.status };
}

export async function setPlanAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const ctx = await adminCtx();
  const parsed = adminPlanInput.safeParse(formToObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await setOrganizationPlan(ctx, parsed.data.orgId, parsed.data.plan);
  revalidatePath(`/admin/${parsed.data.orgId}`);
  return { ok: "Formule mise à jour" };
}

export async function addNoteAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const ctx = await adminCtx();
  const parsed = adminNoteInput.safeParse(formToObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await addAdminNote(ctx, parsed.data.orgId, parsed.data.note);
  revalidatePath(`/admin/${parsed.data.orgId}`);
  return { ok: "Note ajoutée" };
}
