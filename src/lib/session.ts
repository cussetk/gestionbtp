/**
 * Session côté Next.js : lecture/écriture du cookie et garde des pages.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext, SESSION_DAYS, type SessionContext } from "@/server/auth";

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

/** Exige une session ; sinon renvoie vers la connexion. */
export async function requireSession(): Promise<SessionContext> {
  const session = await currentSession();
  if (!session) redirect("/connexion");
  return session;
}

export { SESSION_DAYS };
