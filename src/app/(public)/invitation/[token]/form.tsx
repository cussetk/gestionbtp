"use client";

import { useActionState } from "react";
import { Field, FormError, TextInput } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { acceptInvitationAction, type AuthState } from "../../actions";

export function AcceptInvitationForm({ token, email, fullName }: { token: string; email: string; fullName: string }) {
  const [state, action] = useActionState<AuthState, FormData>(acceptInvitationAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={e._form} />
      <Field label="E-mail (identifiant)" name="email">
        <TextInput name="email" value={email} readOnly disabled />
      </Field>
      <Field label="Votre nom" name="fullName" error={e.fullName}>
        <TextInput name="fullName" autoComplete="name" defaultValue={v.fullName ?? fullName} error={e.fullName} />
      </Field>
      <Field label="Téléphone" name="phone" error={e.phone}>
        <TextInput name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
      </Field>
      <Field label="Mot de passe" name="password" error={e.password} hint="10 caractères minimum.">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={10} required error={e.password} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer mon accès
      </SubmitButton>
    </form>
  );
}
