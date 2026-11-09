/**
 * Session côté Next.js : cookie, gardes des pages et contexte d'appel des services.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext, SESSION_DAYS, type SessionContext } from "@/server/auth";
import { can, type Permission } from "@/lib/permissions";
import type { Ctx } from "@/server/clients";

export const SESSION_COOKIE = "session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Session courante (dédupliquée sur la requête), ou null. */
export const currentSession = cache(async (): Promise<SessionContext | null> => {
  return getSessionContext(await readSessionToken());
});

/** Exige une session (quel que soit le statut de l'espace). */
export async function requireSession(): Promise<SessionContext> {
  const session = await currentSession();
  if (!session) redirect("/connexion");
  return session;
}

/** Exige une session sur un espace validé par le gestionnaire. */
export async function requireActiveSession(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.orgStatus !== "active") redirect("/en-attente");
  return session;
}

/** Exige un droit ; sinon page « accès refusé ». */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireActiveSession();
  if (!can(session, permission)) redirect(`/acces-refuse?droit=${encodeURIComponent(permission)}`);
  return session;
}

/** Exige le statut de gestionnaire de la plateforme. */
export async function requirePlatformAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) redirect("/acces-refuse");
  return session;
}

/** Contexte d'appel des services métier. */
export function toCtx(session: SessionContext): Ctx {
  return { orgId: session.orgId, userId: session.userId, permissions: session.permissions };
}

export { SESSION_DAYS };
