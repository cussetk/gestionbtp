import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { InviteForm } from "@/components/invite-form";

export const metadata: Metadata = { title: "Inviter un membre" };

export default async function InvitePage() {
  const session = await requirePermission("equipe.gerer");
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Inviter un membre" subtitle="Il recevra un lien pour créer son accès" back="/equipe" />
      <InviteForm grantable={session.permissions} orgName={session.orgName} />
    </div>
  );
}
