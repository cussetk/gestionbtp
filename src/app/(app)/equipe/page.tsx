import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { listTeam } from "@/server/team";
import { permissionLabel } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { Card, EmptyState, Fab, Icon, PageHeader, SectionTitle, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { revokeInvitationAction } from "./actions";

export const metadata: Metadata = { title: "Mon équipe" };

export default async function TeamPage() {
  const session = await requirePermission("equipe.gerer");
  const { members, pending } = await listTeam(toCtx(session));
  const tz = session.orgTimezone;

  return (
    <div className="lg:max-w-3xl">
      <PageHeader
        title="Mon équipe"
        subtitle={`${members.filter((m) => m.active).length} compte(s) actif(s)`}
        back="/plus"
        primary={{ href: "/equipe/inviter", label: "Inviter un membre" }}
      />

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        {members.map((m) => {
          const isOwner = m.role === "proprietaire";
          const isMe = m.userId === session.userId;
          const summary = isOwner
            ? "Tous les droits"
            : m.permissions.length === 0
              ? "Aucune autorisation"
              : `${m.permissions.length} autorisation(s) : ${m.permissions.slice(0, 2).map(permissionLabel).join(", ")}${m.permissions.length > 2 ? "…" : ""}`;
          const body = (
            <>
              <span className={cx("grid size-10 shrink-0 place-items-center rounded-full", m.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400")}>
                <Icon name={isOwner ? "shield" : "user"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.fullName}
                  {isMe && <span className="ml-1 text-sm font-normal text-slate-500">(vous)</span>}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {isOwner ? "Propriétaire" : (m.title ?? "Membre")}
                  {!m.active && " · désactivé"}
                </span>
                <span className="block truncate text-xs text-slate-400">{summary}</span>
              </span>
            </>
          );
          return (
            <li key={m.userId}>
              {isOwner || isMe ? (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">{body}</div>
              ) : (
                <Link href={`/equipe/${m.userId}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-slate-50">
                  {body}
                  <Icon name="chevron" className="size-5 text-slate-400" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <SectionTitle>Invitations en attente ({pending.length})</SectionTitle>
      {pending.length === 0 ? (
        <EmptyState title="Aucune invitation en attente">Invitez un technicien, une secrétaire ou votre comptable.</EmptyState>
      ) : (
        <div className="space-y-2">
          {pending.map((inv) => (
            <Card key={inv.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{inv.fullName}</p>
                <p className="truncate text-sm text-slate-500">{inv.email}</p>
                <p className="text-xs text-slate-400">Expire le {formatDate(inv.expiresAt, tz)}</p>
              </div>
              <form action={revokeInvitationAction}>
                <input type="hidden" name="id" value={inv.id} />
                <SubmitButton variant="danger" pendingLabel="…" confirm={`Annuler l'invitation de ${inv.fullName} ?`}>
                  Annuler
                </SubmitButton>
              </form>
            </Card>
          ))}
          <p className="px-1 text-xs text-slate-500">Lien perdu ? Recréez l&apos;invitation : l&apos;ancien lien sera annulé.</p>
        </div>
      )}

      <Fab href="/equipe/inviter" label="Inviter" />
    </div>
  );
}
