/**
 * Espace gestionnaire de la plateforme : validation et suivi des entreprises clientes.
 *
 * RGPD : le gestionnaire voit l'identité des entreprises, de leurs comptes et des
 * volumes (nombre de clients…), jamais le contenu métier (fiches clients, devis…).
 * Chaque action est inscrite au journal.
 */
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { adminEvents, memberships, organizations, users } from "@/db/schema";
import { escapeLike } from "@/lib/text";
import { NotFoundError } from "./clients";

export type AdminCtx = { userId: string; isPlatformAdmin: boolean };

export class AdminForbiddenError extends Error {
  constructor() {
    super("Réservé au gestionnaire de la plateforme");
  }
}

function assertAdmin(ctx: AdminCtx) {
  if (!ctx.isPlatformAdmin) throw new AdminForbiddenError();
}

export type OrgStatus = "en_attente" | "active" | "suspendue";

const ownerName = sql<string | null>`(
  select u.full_name from memberships m join users u on u.id = m.user_id
  where m.org_id = "organizations"."id" and m.role = 'proprietaire' order by m.created_at limit 1)`;
const ownerEmail = sql<string | null>`(
  select u.email from memberships m join users u on u.id = m.user_id
  where m.org_id = "organizations"."id" and m.role = 'proprietaire' order by m.created_at limit 1)`;
const ownerPhone = sql<string | null>`(
  select u.phone from memberships m join users u on u.id = m.user_id
  where m.org_id = "organizations"."id" and m.role = 'proprietaire' order by m.created_at limit 1)`;
const memberCount = sql<number>`(select count(*)::int from memberships m where m.org_id = "organizations"."id" and m.active)`;
const clientCount = sql<number>`(select count(*)::int from clients c where c.org_id = "organizations"."id" and c.deleted_at is null)`;
const lastActivity = sql<Date | null>`(
  select max(u.last_login_at) from memberships m join users u on u.id = m.user_id where m.org_id = "organizations"."id")`;

export async function adminStats(ctx: AdminCtx) {
  assertAdmin(ctx);
  const db = await getDb();
  const rows = await db
    .select({ status: organizations.status, n: sql<number>`count(*)::int` })
    .from(organizations)
    .groupBy(organizations.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrgStatus, number>>;
  const [{ users: userCount }] = await db.select({ users: sql<number>`count(*)::int` }).from(users);
  return { enAttente: by.en_attente ?? 0, actives: by.active ?? 0, suspendues: by.suspendue ?? 0, utilisateurs: userCount };
}

export async function listOrganizations(ctx: AdminCtx, opts: { status?: OrgStatus; q?: string } = {}) {
  assertAdmin(ctx);
  const db = await getDb();
  const conditions: SQL[] = [];
  if (opts.status) conditions.push(eq(organizations.status, opts.status));
  const q = opts.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      or(
        ilike(organizations.name, pattern),
        ilike(organizations.siret, pattern),
        sql`exists (select 1 from memberships m join users u on u.id = m.user_id
                    where m.org_id = "organizations"."id" and (u.email ilike ${pattern} or u.full_name ilike ${pattern}))`,
      )!,
    );
  }
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      status: organizations.status,
      plan: organizations.plan,
      timezone: organizations.timezone,
      createdAt: organizations.createdAt,
      ownerName,
      ownerEmail,
      ownerPhone,
      memberCount,
      clientCount,
      lastActivity,
    })
    .from(organizations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`case ${organizations.status} when 'en_attente' then 0 when 'active' then 1 else 2 end`, desc(organizations.createdAt))
    .limit(200);
}

export async function getOrganizationForAdmin(ctx: AdminCtx, orgId: string) {
  assertAdmin(ctx);
  const db = await getDb();
  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      siret: organizations.siret,
      email: organizations.email,
      phone: organizations.phone,
      city: organizations.city,
      postalCode: organizations.postalCode,
      timezone: organizations.timezone,
      status: organizations.status,
      statusReason: organizations.statusReason,
      statusChangedAt: organizations.statusChangedAt,
      plan: organizations.plan,
      createdAt: organizations.createdAt,
      clientCount,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!org) throw new NotFoundError("Entreprise introuvable");

  const members = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: memberships.role,
      title: memberships.title,
      active: memberships.active,
      lastLoginAt: users.lastLoginAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(memberships.createdAt);

  const events = await db
    .select({
      id: adminEvents.id,
      action: adminEvents.action,
      detail: adminEvents.detail,
      createdAt: adminEvents.createdAt,
      adminName: users.fullName,
    })
    .from(adminEvents)
    .leftJoin(users, eq(users.id, adminEvents.adminUserId))
    .where(eq(adminEvents.orgId, orgId))
    .orderBy(desc(adminEvents.createdAt))
    .limit(100);

  return { org, members, events };
}

const STATUS_ACTION: Record<OrgStatus, string> = {
  active: "validation",
  suspendue: "suspension",
  en_attente: "remise en attente",
};

export async function setOrganizationStatus(ctx: AdminCtx, orgId: string, status: OrgStatus, reason?: string | null) {
  assertAdmin(ctx);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(organizations)
      .set({ status, statusReason: status === "suspendue" ? (reason ?? null) : null, statusChangedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning({ id: organizations.id });
    if (updated.length === 0) throw new NotFoundError("Entreprise introuvable");
    await tx.insert(adminEvents).values({ orgId, adminUserId: ctx.userId, action: STATUS_ACTION[status], detail: reason ?? null });
  });
}

export async function setOrganizationPlan(ctx: AdminCtx, orgId: string, plan: string) {
  assertAdmin(ctx);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(organizations)
      .set({ plan })
      .where(eq(organizations.id, orgId))
      .returning({ id: organizations.id });
    if (updated.length === 0) throw new NotFoundError("Entreprise introuvable");
    await tx.insert(adminEvents).values({ orgId, adminUserId: ctx.userId, action: "formule", detail: plan });
  });
}

export async function addAdminNote(ctx: AdminCtx, orgId: string, note: string) {
  assertAdmin(ctx);
  const db = await getDb();
  await db.insert(adminEvents).values({ orgId, adminUserId: ctx.userId, action: "note", detail: note });
}
