/**
 * Comptes et sessions (indépendant de Next.js → testable).
 *
 *  - Mots de passe : scrypt (Node natif) avec sel aléatoire.
 *  - Sessions : jeton aléatoire dans un cookie httpOnly ; seule son empreinte SHA-256 est en base.
 *  - Inscription = création de l'espace de l'entreprise + du compte gérant.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships, organizations, sessions, users } from "@/db/schema";
import type { SignUpInput } from "@/lib/validation";
import { effectivePermissions, type Permission } from "@/lib/permissions";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Empreinte factice : on calcule toujours un scrypt, même si l'e-mail est inconnu,
// pour ne pas révéler par le temps de réponse quels e-mails ont un compte.
let dummyHash: Promise<string> | undefined;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionContext = {
  userId: string;
  orgId: string;
  role: "proprietaire" | "membre";
  title: string | null;
  /** Droits effectifs (tous pour le propriétaire). */
  permissions: Permission[];
  fullName: string;
  email: string;
  orgName: string;
  orgTimezone: string;
  orgStatus: "en_attente" | "active" | "suspendue";
  orgStatusReason: string | null;
  isPlatformAdmin: boolean;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/** Amorçage : e-mails listés dans PLATFORM_ADMIN_EMAILS deviennent gestionnaires de la plateforme. */
function isBootstrapAdmin(email: string): boolean {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function createSession(userId: string, orgId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, orgId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return { token, expiresAt };
}

/**
 * Crée l'espace d'un nouveau climaticien et son compte propriétaire.
 * L'espace reste « en attente » jusqu'à sa validation par le gestionnaire de la plateforme.
 */
export async function signUp(input: SignUpInput) {
  const db = await getDb();
  const passwordHash = await hashPassword(input.password);

  const { userId, orgId } = await db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing.length > 0) throw new AuthError("Un compte existe déjà avec cet e-mail", "email");

    const [org] = await tx
      .insert(organizations)
      .values({ name: input.orgName, timezone: input.timezone, status: "en_attente" })
      .returning({ id: organizations.id });
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        isPlatformAdmin: isBootstrapAdmin(input.email),
      })
      .returning({ id: users.id });
    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "proprietaire" });
    return { userId: user.id, orgId: org.id };
  });

  return createSession(userId, orgId);
}

export async function signIn(email: string, password: string) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));

  if (!user) {
    dummyHash ??= hashPassword("mot-de-passe-factice");
    await verifyPassword(password, await dummyHash);
    throw new AuthError("E-mail ou mot de passe incorrect");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("E-mail ou mot de passe incorrect");
  }
  if (!user.isPlatformAdmin && isBootstrapAdmin(user.email)) {
    await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, user.id));
  }

  // V1 : un utilisateur appartient à une entreprise. (Le choix d'entreprise viendra si besoin.)
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.active, true)))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  if (!membership) {
    throw new AuthError("Ce compte a été désactivé par votre entreprise. Contactez votre responsable.");
  }

  return createSession(user.id, membership.orgId);
}

/** Retrouve la session d'un jeton ; la prolonge si elle est utilisée (session glissante). */
export async function getSessionContext(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null;
  const db = await getDb();
  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      userId: users.id,
      orgId: organizations.id,
      role: memberships.role,
      title: memberships.title,
      granted: memberships.permissions,
      fullName: users.fullName,
      email: users.email,
      isPlatformAdmin: users.isPlatformAdmin,
      orgName: organizations.name,
      orgTimezone: organizations.timezone,
      orgStatus: organizations.status,
      orgStatusReason: organizations.statusReason,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, sessions.orgId))
    .innerJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.orgId, organizations.id), eq(memberships.active, true)),
    )
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));

  if (!row) return null;

  // Prolonge si la moitié de la durée est écoulée (évite une écriture à chaque page).
  if (row.expiresAt.getTime() - now.getTime() < (SESSION_DAYS / 2) * DAY_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  return {
    userId: row.userId,
    orgId: row.orgId,
    role: row.role,
    title: row.title,
    permissions: effectivePermissions(row.role, row.granted),
    fullName: row.fullName,
    email: row.email,
    orgName: row.orgName,
    orgTimezone: row.orgTimezone,
    orgStatus: row.orgStatus,
    orgStatusReason: row.orgStatusReason,
    isPlatformAdmin: row.isPlatformAdmin,
  };
}

export async function signOut(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Déconnecte toutes les sessions d'un utilisateur dans une entreprise (membre désactivé, droits retirés). */
export async function revokeSessions(userId: string, orgId: string) {
  const db = await getDb();
  await db.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.orgId, orgId)));
}

/** Ménage : supprime les sessions expirées (à brancher sur une tâche planifiée plus tard). */
export async function purgeExpiredSessions() {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
