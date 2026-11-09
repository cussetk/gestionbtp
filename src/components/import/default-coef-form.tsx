"use client";

import { useActionState } from "react";
import { saveDefaultCoefAction, type FormState } from "@/app/(app)/catalogue/actions";
import { formatCoef } from "@/lib/catalog";
import { Field, TextInput } from "../ui";
import { SubmitButton } from "../submit-button";
import { SavedNotice } from "../settings-ui";

/** Coefficient de marge proposé par défaut pour les nouveaux articles. */
export function DefaultCoefForm({ initial }: { initial: number }) {
  const [state, action] = useActionState<FormState, FormData>(saveDefaultCoefAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200" noValidate>
      <Field label="Coefficient par défaut" name="defaultCoef" error={e.defaultCoef} hint="Ex. 1,4 : un article acheté 100 € est vendu 140 € HT.">
        <TextInput name="defaultCoef" inputMode="decimal" defaultValue={state.values?.defaultCoef ?? formatCoef(initial)} error={e.defaultCoef} />
      </Field>
      <SavedNotice key={state.at} text={state.ok} />
      <SubmitButton variant="secondary" className="w-full">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
