import type { Metadata } from "next";
import { getInvitationByToken } from "@/server/team";
import { AcceptInvitationForm } from "./form";

export const metadata: Metadata = { title: "Rejoindre l'équipe", robots: { index: false } };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-lg font-bold">Lien d&apos;invitation expiré</h1>
        <p className="text-sm text-slate-600">
          Ce lien n&apos;est plus valable (déjà utilisé, annulé ou plus de 7 jours). Demandez un nouveau lien à votre responsable.
        </p>
      </div>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-lg font-bold">Rejoindre {invitation.orgName}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {invitation.inviterName ? `${invitation.inviterName} vous invite` : "Vous êtes invité"} à rejoindre l&apos;équipe
        {invitation.title ? ` en tant que ${invitation.title}` : ""}. Choisissez votre mot de passe.
      </p>
      <AcceptInvitationForm token={token} email={invitation.email} fullName={invitation.fullName} />
    </>
  );
}
