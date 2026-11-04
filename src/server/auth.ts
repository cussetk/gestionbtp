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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionContext = {
  userId: string;
  orgId: string;
  role: "gerant" | "technicien";
  fullName: string;
  email: string;
  orgName: string;
  orgTimezone: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

async function createSession(userId: string, orgId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, orgId, expiresAt });
  return { token, expiresAt };
}

/** Crée l'espace d'un nouveau climaticien et son compte gérant. */
export async function signUp(input: SignUpInput) {
  const db = await getDb();
  const passwordHash = await hashPassword(input.password);

  const { userId, orgId } = await db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing.length > 0) throw new AuthError("Un compte existe déjà avec cet e-mail", "email");

    const [org] = await tx
      .insert(organizations)
      .values({ name: input.orgName, timezone: input.timezone })
      .returning({ id: organizations.id });
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, passwordHash, fullName: input.fullName })
      .returning({ id: users.id });
    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "gerant" });
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

  // V1 : un utilisateur appartient à une entreprise. (Le choix d'entreprise viendra si besoin.)
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  if (!membership) throw new AuthError("Ce compte n'est rattaché à aucune entreprise");

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
      fullName: users.fullName,
      email: users.email,
      orgName: organizations.name,
      orgTimezone: organizations.timezone,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, sessions.orgId))
    .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.orgId, organizations.id)))
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
    fullName: row.fullName,
    email: row.email,
    orgName: row.orgName,
    orgTimezone: row.orgTimezone,
  };
}

export async function signOut(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Ménage : supprime les sessions expirées (à brancher sur une tâche planifiée plus tard). */
export async function purgeExpiredSessions() {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
