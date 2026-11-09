"use server";

import { redirect } from "next/navigation";
import { AuthError, signIn, signOut, signUp } from "@/server/auth";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/lib/session";
import { acceptInvitationInput, fieldErrors, formToObject, signInInput, signUpInput } from "@/lib/validation";
import { acceptInvitation } from "@/server/team";

export type AuthState = { errors?: Record<string, string>; values?: Record<string, string> };

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = formToObject(form);
  const parsed = signUpInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { ...values, password: "" } };
  try {
    const { token, expiresAt } = await signUp(parsed.data);
    await setSessionCookie(token, expiresAt);
  } catch (err) {
    if (err instanceof AuthError) return { errors: { [err.field ?? "_form"]: err.message }, values: { ...values, password: "" } };
    throw err;
  }
  redirect("/en-attente");
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = formToObject(form);
  const parsed = signInInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: values.email ?? "" } };
  try {
    const { token, expiresAt } = await signIn(parsed.data.email, parsed.data.password);
    await setSessionCookie(token, expiresAt);
  } catch (err) {
    if (err instanceof AuthError) return { errors: { _form: err.message }, values: { email: values.email ?? "" } };
    throw err;
  }
  redirect("/");
}

export async function acceptInvitationAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = formToObject(form);
  const parsed = acceptInvitationInput.safeParse(values);
  const keep = { fullName: values.fullName ?? "", phone: values.phone ?? "" };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep };
  try {
    const { token, expiresAt } = await acceptInvitation(parsed.data);
    await setSessionCookie(token, expiresAt);
  } catch (err) {
    if (err instanceof AuthError) return { errors: { _form: err.message }, values: keep };
    throw err;
  }
  redirect("/");
}

export async function signOutAction() {
  await signOut(await readSessionToken());
  await clearSessionCookie();
  redirect("/connexion");
}
