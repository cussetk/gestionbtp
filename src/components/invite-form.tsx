"use client";

import { useActionState } from "react";
import Link from "next/link";
import { inviteAction, type InviteState } from "@/app/(app)/equipe/actions";
import { Field, FormError, TextInput, buttonStyles } from "./ui";
import { SubmitButton } from "./submit-button";
import { PermissionPicker } from "./permission-picker";
import { ShareLink } from "./share-link";

export function InviteForm({ grantable, orgName }: { grantable: string[]; orgName: string }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};

  if (state.link && state.invitee) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Invitation créée pour <strong>{state.invitee.fullName}</strong>. Envoyez-lui ce lien : il choisira son mot de passe.
          Le lien est valable 7 jours et ne sert qu&apos;une fois.
        </p>
        <ShareLink
          link={state.link}
          email={state.invitee.email}
          subject={`Invitation à rejoindre ${orgName}`}
          message={`Bonjour ${state.invitee.fullName}, je vous invite à rejoindre ${orgName} sur notre logiciel. Créez votre accès ici :`}
        />
        <Link href="/equipe" className={`${buttonStyles.ghost} w-full`}>
          Retour à l&apos;équipe
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={e._form} />
      <Field label="Nom et prénom *" name="fullName" error={e.fullName}>
        <TextInput name="fullName" autoComplete="off" defaultValue={v.fullName} error={e.fullName} />
      </Field>
      <Field label="E-mail *" name="email" error={e.email} hint="Ce sera son identifiant de connexion.">
        <TextInput name="email" type="email" inputMode="email" autoComplete="off" defaultValue={v.email} error={e.email} />
      </Field>
      <Field label="Fonction" name="title" error={e.title} hint="Ex. Technicien, Secrétaire, Comptable">
        <TextInput name="title" defaultValue={v.title} error={e.title} />
      </Field>
      <PermissionPicker initial={state.permissions ?? []} grantable={grantable} />
      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer le lien d&apos;invitation
      </SubmitButton>
    </form>
  );
}
