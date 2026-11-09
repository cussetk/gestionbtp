"use client";

import { useActionState } from "react";
import { updateMemberAction, type MemberState } from "@/app/(app)/equipe/actions";
import { Field, FormError, TextInput } from "./ui";
import { SubmitButton } from "./submit-button";
import { PermissionPicker } from "./permission-picker";

export function MemberForm({
  userId,
  title,
  permissions,
  grantable,
}: {
  userId: string;
  title: string | null;
  permissions: string[];
  grantable: string[];
}) {
  const [state, action] = useActionState<MemberState, FormData>(updateMemberAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <FormError message={e._form} />
      {state.saved && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Modifications enregistrées. Elles s&apos;appliquent immédiatement.
        </p>
      )}
      <Field label="Fonction" name="title" error={e.title}>
        <TextInput name="title" defaultValue={title ?? ""} error={e.title} />
      </Field>
      <PermissionPicker initial={permissions} grantable={grantable} />
      <SubmitButton className="w-full">Enregistrer les autorisations</SubmitButton>
    </form>
  );
}
