"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, toCtx } from "@/lib/session";
import { ForbiddenError } from "@/lib/permissions";
import { fieldErrors, formList, formToObject, invitationInput, memberUpdateInput } from "@/lib/validation";
import { createInvitation, revokeInvitation, setMemberActive, TeamError, updateMember } from "@/server/team";
import { NotFoundError } from "@/server/clients";

export type InviteState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  permissions?: string[];
  link?: string;
  invitee?: { fullName: string; email: string };
};

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const ctx = toCtx(await requirePermission("equipe.gerer"));
  const values = formToObject(form);
  const permissions = formList(form, "permissions");
  const parsed = invitationInput.safeParse({ ...values, permissions });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values, permissions };
  try {
    const { token } = await createInvitation(ctx, parsed.data);
    revalidatePath("/equipe");
    return {
      link: `${await origin()}/invitation/${token}`,
      invitee: { fullName: parsed.data.fullName, email: parsed.data.email },
    };
  } catch (err) {
    if (err instanceof TeamError) return { errors: { [err.field ?? "_form"]: err.message }, values, permissions };
    if (err instanceof ForbiddenError) return { errors: { _form: err.message }, values, permissions };
    throw err;
  }
}

export type MemberState = { errors?: Record<string, string>; saved?: boolean };

export async function updateMemberAction(_prev: MemberState, form: FormData): Promise<MemberState> {
  const ctx = toCtx(await requirePermission("equipe.gerer"));
  const parsed = memberUpdateInput.safeParse({ ...formToObject(form), permissions: formList(form, "permissions") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await updateMember(ctx, parsed.data);
  } catch (err) {
    if (err instanceof TeamError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { errors: { _form: err.message } };
    }
    throw err;
  }
  revalidatePath("/equipe");
  revalidatePath(`/equipe/${parsed.data.userId}`);
  return { saved: true };
}

export async function setMemberActiveAction(form: FormData) {
  const ctx = toCtx(await requirePermission("equipe.gerer"));
  const userId = String(form.get("userId"));
  await setMemberActive(ctx, userId, form.get("active") === "true");
  revalidatePath("/equipe");
  redirect(`/equipe/${userId}`);
}

export async function revokeInvitationAction(form: FormData) {
  const ctx = toCtx(await requirePermission("equipe.gerer"));
  await revokeInvitation(ctx, String(form.get("id")));
  revalidatePath("/equipe");
  redirect("/equipe");
}
