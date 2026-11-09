"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, TextInput } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { signInAction, signUpAction, type AuthState } from "./actions";

export function SignInForm() {
  const [state, action] = useActionState<AuthState, FormData>(signInAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormError message={e._form} />
      <Field label="E-mail" name="email" error={e.email}>
        <TextInput name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={e.email} />
      </Field>
      <Field label="Mot de passe" name="password" error={e.password}>
        <TextInput name="password" type="password" autoComplete="current-password" required error={e.password} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Connexion…">Se connecter</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-brand-700 underline">
          Créer mon espace
        </Link>
      </p>
    </form>
  );
}

const ZONES = [
  ["Europe/Paris", "Métropole"],
  ["America/Guadeloupe", "Guadeloupe"],
  ["America/Martinique", "Martinique"],
  ["America/Cayenne", "Guyane"],
  ["Indian/Reunion", "La Réunion"],
  ["Indian/Mayotte", "Mayotte"],
] as const;

export function SignUpForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUpAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormError message={e._form} />
      <Field label="Nom de l'entreprise" name="orgName" error={e.orgName}>
        <TextInput name="orgName" autoComplete="organization" required defaultValue={v.orgName} error={e.orgName} />
      </Field>
      <Field label="Votre nom" name="fullName" error={e.fullName}>
        <TextInput name="fullName" autoComplete="name" required defaultValue={v.fullName} error={e.fullName} />
      </Field>
      <Field label="Zone" name="timezone" hint="Pour l'heure du planning et des signatures.">
        <select id="timezone" name="timezone" className="input" defaultValue={v.timezone ?? "Europe/Paris"}>
          {ZONES.map(([tz, label]) => (
            <option key={tz} value={tz}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Téléphone" name="phone" error={e.phone} hint="Pour vous contacter lors de la validation de votre espace.">
        <TextInput name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={v.phone} error={e.phone} />
      </Field>
      <Field label="E-mail" name="email" error={e.email}>
        <TextInput name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={v.email} error={e.email} />
      </Field>
      <Field label="Mot de passe" name="password" error={e.password} hint="10 caractères minimum.">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={10} required error={e.password} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Création…">Créer mon espace</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Vos données sont hébergées dans l&apos;Union européenne et ne sont jamais revendues.
      </p>
      <p className="text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-700 underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
