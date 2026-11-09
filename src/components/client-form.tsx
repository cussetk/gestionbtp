"use client";

import { useActionState, useState } from "react";
import { saveClientAction, type FormState } from "@/app/(app)/clients/actions";
import { Field, FormError, TextArea, TextInput, cx } from "./ui";
import { SubmitButton } from "./submit-button";

type Values = Record<string, string | null | undefined>;

export function ClientForm({ mode, initial }: { mode: "create" | "update"; initial: Values }) {
  const [state, action] = useActionState<FormState, FormData>(saveClientAction, {});
  const v: Values = state.values ?? initial;
  const e = state.errors ?? {};
  const [type, setType] = useState<string>((v.type as string) ?? "particulier");
  const val = (k: string) => v[k] ?? "";

  return (
    <form action={action} className="space-y-4 lg:max-w-2xl" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={val("id")} />
      {/* Le type est porté par un champ caché : la remise à zéro automatique du formulaire
          après une erreur ne doit pas le perdre. */}
      <input type="hidden" name="type" value={type} />
      <FormError message={e._form} />

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-slate-700">Type de client</legend>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-200/70 p-1">
          {[
            ["particulier", "Particulier"],
            ["professionnel", "Professionnel"],
          ].map(([value, label]) => (
            <label
              key={value}
              className={cx(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-bold",
                type === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-600",
              )}
            >
              <input
                type="radio"
                name="type-choice"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {type === "professionnel" && (
        <>
          <Field label="Raison sociale *" name="companyName" error={e.companyName}>
            <TextInput name="companyName" autoComplete="organization" defaultValue={val("companyName")} error={e.companyName} />
          </Field>
          <Field label="SIRET" name="siret" error={e.siret}>
            <TextInput name="siret" inputMode="numeric" defaultValue={val("siret")} error={e.siret} />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "professionnel" ? "Nom du contact" : "Nom *"} name="lastName" error={e.lastName}>
          <TextInput name="lastName" autoComplete="family-name" defaultValue={val("lastName")} error={e.lastName} />
        </Field>
        <Field label="Prénom" name="firstName" error={e.firstName}>
          <TextInput name="firstName" autoComplete="given-name" defaultValue={val("firstName")} error={e.firstName} />
        </Field>
      </div>

      <Field label="Téléphone" name="phone" error={e.phone}>
        <TextInput name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={val("phone")} error={e.phone} />
      </Field>
      <Field label="Autre téléphone" name="phone2" error={e.phone2}>
        <TextInput name="phone2" type="tel" inputMode="tel" defaultValue={val("phone2")} error={e.phone2} />
      </Field>
      <Field label="E-mail" name="email" error={e.email} hint="Pour l'envoi des rapports, devis et factures.">
        <TextInput name="email" type="email" autoComplete="email" inputMode="email" defaultValue={val("email")} error={e.email} />
      </Field>

      <div className="space-y-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-sm font-bold text-slate-700">Adresse de facturation</p>
        <Field label="Adresse" name="addressLine1" error={e.addressLine1}>
          <TextInput name="addressLine1" autoComplete="address-line1" defaultValue={val("addressLine1")} error={e.addressLine1} />
        </Field>
        <Field label="Complément" name="addressLine2" error={e.addressLine2}>
          <TextInput name="addressLine2" autoComplete="address-line2" defaultValue={val("addressLine2")} error={e.addressLine2} />
        </Field>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Code postal" name="postalCode" error={e.postalCode}>
            <TextInput name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} defaultValue={val("postalCode")} error={e.postalCode} />
          </Field>
          <Field label="Ville" name="city" error={e.city}>
            <TextInput name="city" autoComplete="address-level2" defaultValue={val("city")} error={e.city} />
          </Field>
        </div>
        {mode === "create" && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="createSiteFromAddress"
              defaultChecked={state.values ? state.values.createSiteFromAddress === "on" : true}
              className="size-5 accent-brand-600"
            />
            Les interventions ont lieu à cette adresse (créer le site)
          </label>
        )}
      </div>

      <Field label="Notes internes" name="notes" error={e.notes} hint="Visibles uniquement par votre entreprise. Pas d'informations de santé ni de données sensibles.">
        <TextArea name="notes" defaultValue={val("notes")} error={e.notes} />
      </Field>

      <SubmitButton className="w-full">{mode === "create" ? "Créer le client" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
