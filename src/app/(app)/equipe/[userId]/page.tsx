import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission, toCtx } from "@/lib/session";
import { getMember } from "@/server/team";
import { loadOr404 } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/text";
import { ActionRow, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { MemberForm } from "@/components/member-form";
import { setMemberActiveAction } from "../actions";

export const metadata: Metadata = { title: "Membre de l'équipe" };

export default async function MemberPage({ params }: PageProps<"/equipe/[userId]">) {
  const session = await requirePermission("equipe.gerer");
  const { userId } = await params;
  if (userId === session.userId) redirect("/equipe");
  const member = await loadOr404(userId, () => getMember(toCtx(session), userId));
  if (member.role === "proprietaire") redirect("/equipe");

  return (
    <div className="lg:max-w-3xl">
      <PageHeader
        title={member.fullName}
        subtitle={`${member.title ?? "Membre"}${member.active ? "" : " · désactivé"}`}
        back="/equipe"
      />
      <Card className="mb-4 space-y-1">
        <ActionRow href={`mailto:${member.email}`} icon="mail" hint="Identifiant de connexion">
          {member.email}
        </ActionRow>
        {member.phone && (
          <ActionRow href={`tel:${member.phone}`} icon="phone" hint="Appeler">
            {formatPhone(member.phone)}
          </ActionRow>
        )}
        <p className="pt-1 text-xs text-slate-500">Dernière connexion : {formatDateTime(member.lastLoginAt, session.orgTimezone)}</p>
      </Card>

      <MemberForm userId={member.userId} title={member.title} permissions={member.permissions} grantable={session.permissions} />

      <form action={setMemberActiveAction} className="mt-8">
        <input type="hidden" name="userId" value={member.userId} />
        <input type="hidden" name="active" value={member.active ? "false" : "true"} />
        {member.active ? (
          <SubmitButton
            variant="danger"
            className="w-full"
            pendingLabel="…"
            confirm={`Désactiver ${member.fullName} ? Il sera déconnecté immédiatement. Son historique est conservé.`}
          >
            Désactiver ce compte
          </SubmitButton>
        ) : (
          <SubmitButton variant="secondary" className="w-full" pendingLabel="…">
            Réactiver ce compte
          </SubmitButton>
        )}
      </form>
    </div>
  );
}
