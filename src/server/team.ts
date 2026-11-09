/**
 * Équipe d'une entreprise : membres, droits, invitations.
 *
 * Règles :
 *  - il faut le droit « equipe.gerer » (le propriétaire l'a toujours) ;
 *  - on ne modifie jamais le propriétaire, ni ses propres droits ;
 *  - on ne peut accorder que des droits que l'on possède soi-même ;
 *  - toutes les requêtes filtrent explicitement sur l'entreprise de l'appelant.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { invitations, memberships, organizations, users } from "@/db/schema";
import { assertCan, type Permission } from "@/lib/permissions";
import type { AcceptInvitationInput, InvitationInput, MemberUpdateInput } from "@/lib/validation";
import { AuthError, createSession, hashPassword, hashToken, revokeSessions } from "./auth";
import { NotFoundError, type Ctx } from "./clients";

const INVITATION_DAYS = 7;

export class TeamError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/** Droits que l'appelant peut effectivement accorder (jamais plus que les siens). */
function grantable(ctx: Ctx, requested: readonly string[]): Permission[] {
  return ctx.permissions.filter((p) => requested.includes(p));
}

export type MemberRow = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "proprietaire" | "membre";
  title: string | null;
  permissions: string[];
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export async function listTeam(ctx: Ctx) {
  assertCan(ctx, "equipe.gerer");
  const db = await getDb();
  const members: MemberRow[] = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: memberships.role,
      title: memberships.title,
      permissions: memberships.permissions,
      active: memberships.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, ctx.orgId))
    .orderBy(asc(memberships.createdAt));

  const pending = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      fullName: invitations.fullName,
      title: invitations.title,
      permissions: invitations.permissions,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.orgId, ctx.orgId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitations.createdAt));

  return { members, pending };
}

export async function getMember(ctx: Ctx, userId: string): Promise<MemberRow> {
  assertCan(ctx, "equipe.gerer");
  const db = await getDb();
  const [row] = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: memberships.role,
      title: memberships.title,
      permissions: memberships.permissions,
      active: memberships.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)));
  if (!row) throw new NotFoundError("Membre introuvable");
  return row;
}

/** Crée une invitation ; renvoie le jeton à mettre dans le lien (affiché une seule fois). */
export async function createInvitation(ctx: Ctx, input: InvitationInput): Promise<{ id: string; token: string }> {
  assertCan(ctx, "equipe.gerer");
  const db = await getDb();

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existingUser) {
    throw new TeamError("Cet e-mail a déjà un compte. Utilisez une autre adresse pour ce membre.", "email");
  }

  const token = randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    // Une seule invitation active par e-mail et par entreprise : la précédente est annulée.
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.orgId, ctx.orgId),
          eq(invitations.email, input.email),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );
    await tx.insert(invitations).values({
      id,
      orgId: ctx.orgId,
      email: input.email,
      fullName: input.fullName,
      title: input.title,
      permissions: grantable(ctx, input.permissions),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
      createdBy: ctx.userId,
    });
  });
  return { id, token };
}

export async function revokeInvitation(ctx: Ctx, invitationId: string): Promise<void> {
  assertCan(ctx, "equipe.gerer");
  const db = await getDb();
  const updated = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, invitationId), eq(invitations.orgId, ctx.orgId), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id });
  if (updated.length === 0) throw new NotFoundError("Invitation introuvable");
}

/** Informations publiques d'une invitation valide (page d'acceptation). */
export async function getInvitationByToken(token: string) {
  if (!token || token.length < 20) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: invitations.id,
      orgId: invitations.orgId,
      email: invitations.email,
      fullName: invitations.fullName,
      title: invitations.title,
      permissions: invitations.permissions,
      orgName: organizations.name,
      inviterName: users.fullName,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .leftJoin(users, eq(users.id, invitations.createdBy))
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/** Crée le compte du membre invité et ouvre sa session. */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const invitation = await getInvitationByToken(input.token);
  if (!invitation) throw new AuthError("Ce lien d'invitation n'est plus valable. Demandez-en un nouveau.");

  const db = await getDb();
  const passwordHash = await hashPassword(input.password);
  const userId = await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, invitation.email));
    if (taken) throw new AuthError("Un compte existe déjà avec cet e-mail. Connectez-vous.");

    // Marque l'invitation comme utilisée (garde-fou contre un double clic).
    const used = await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitations.id, invitation.id), isNull(invitations.acceptedAt)))
      .returning({ id: invitations.id });
    if (used.length === 0) throw new AuthError("Ce lien d'invitation a déjà été utilisé.");

    const [user] = await tx
      .insert(users)
      .values({ email: invitation.email, passwordHash, fullName: input.fullName, phone: input.phone })
      .returning({ id: users.id });
    await tx.insert(memberships).values({
      orgId: invitation.orgId,
      userId: user.id,
      role: "membre",
      title: invitation.title,
      permissions: invitation.permissions,
    });
    return user.id;
  });
  return createSession(userId, invitation.orgId);
}

async function editableMember(ctx: Ctx, userId: string) {
  if (userId === ctx.userId) throw new TeamError("Vous ne pouvez pas modifier vos propres droits.");
  const member = await getMember(ctx, userId);
  if (member.role === "proprietaire") throw new TeamError("Le compte propriétaire ne peut pas être modifié.");
  return member;
}

export async function updateMember(ctx: Ctx, input: MemberUpdateInput): Promise<void> {
  assertCan(ctx, "equipe.gerer");
  const member = await editableMember(ctx, input.userId);
  // Les droits que l'appelant ne possède pas sont laissés tels quels.
  const outsideMyScope = member.permissions.filter((p) => !ctx.permissions.includes(p as Permission));
  const next = [...new Set([...outsideMyScope, ...grantable(ctx, input.permissions)])];
  const db = await getDb();
  await db
    .update(memberships)
    .set({ title: input.title, permissions: next })
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, input.userId)));
}

export async function setMemberActive(ctx: Ctx, userId: string, active: boolean): Promise<void> {
  assertCan(ctx, "equipe.gerer");
  await editableMember(ctx, userId);
  const db = await getDb();
  await db
    .update(memberships)
    .set({ active })
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)));
  if (!active) await revokeSessions(userId, ctx.orgId);
}
