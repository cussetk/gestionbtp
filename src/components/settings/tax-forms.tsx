"use client";

import { useActionState, useState } from "react";
import { saveTaxRateAction, saveTaxSettingsAction, type SettingsState } from "@/app/(app)/reglages/actions";
import { Field, FormError, TextInput, cx } from "../ui";
import { SubmitButton } from "../submit-button";
import { SavedNotice } from "../settings-ui";

export function TaxRegimeForm({ vatRegime, vatOnDebits }: { vatRegime: "reel" | "franchise"; vatOnDebits: boolean }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveTaxSettingsAction, {});
  const [regime, setRegime] = useState(vatRegime);
  return (
    <form action={action} className="space-y-4">
      <SavedNotice text={state.ok} />
      <fieldset className="grid gap-2 lg:grid-cols-2">
        <legend className="sr-only">Régime de TVA</legend>
        {[
          { value: "reel", title: "Je facture la TVA", text: "Cas général d'une société ou d'un artisan au régime réel." },
          { value: "franchise", title: "Franchise en base de TVA", text: "Micro-entreprise sous les seuils : « TVA non applicable, art. 293 B du CGI »." },
        ].map((o) => (
          <label
            key={o.value}
            className={cx(
              "flex cursor-pointer gap-3 rounded-xl p-3 ring-1",
              regime === o.value ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-slate-200",
            )}
          >
            <input
              type="radio"
              name="vatRegime"
              value={o.value}
              checked={regime === o.value}
              onChange={() => setRegime(o.value as "reel" | "franchise")}
              className="mt-1 size-5 accent-brand-600"
            />
            <span>
              <span className="block font-bold">{o.title}</span>
              <span className="block text-sm text-slate-600">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {regime === "reel" && (
        <label className="flex min-h-11 items-start gap-3 text-[15px]">
          <input type="checkbox" name="vatOnDebits" defaultChecked={vatOnDebits} className="mt-0.5 size-5 accent-brand-600" />
          <span>
            J&apos;ai opté pour le paiement de la TVA d&apos;après les débits
            <span className="block text-sm text-slate-500">
              La mention « Option pour le paiement de la taxe d&apos;après les débits » sera ajoutée aux factures. Sans option, la TVA
              sur les prestations est due à l&apos;encaissement.
            </span>
          </span>
        </label>
      )}
      <SubmitButton variant="secondary">Enregistrer le régime</SubmitButton>
    </form>
  );
}

const KINDS = [
  { value: "normal", label: "Taux normal" },
  { value: "reduit", label: "Taux réduit" },
  { value: "particulier", label: "Taux particulier" },
  { value: "exonere", label: "Exonéré / non applicable" },
  { value: "autoliquidation", label: "Autoliquidation" },
];

export function TaxRateForm({
  initial,
  submitLabel,
}: {
  initial?: { id: string; label: string; rate: string; kind: string; mention: string; requiresAttestation: boolean };
  submitLabel: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(saveTaxRateAction, {});
  const e = state.errors ?? {};
  const v = state.values;
  return (
    <form action={action} className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <FormError message={e._form} />
      <SavedNotice text={state.ok} />
      <div className="grid gap-3 lg:grid-cols-[1fr_8rem_12rem]">
        <Field label="Libellé" name={`label-${initial?.id ?? "new"}`} error={e.label}>
          <TextInput id={`label-${initial?.id ?? "new"}`} name="label" defaultValue={v?.label ?? initial?.label} error={e.label} />
        </Field>
        <Field label="Taux (%)" name={`rate-${initial?.id ?? "new"}`} error={e.rate}>
          <TextInput id={`rate-${initial?.id ?? "new"}`} name="rate" inputMode="decimal" defaultValue={v?.rate ?? initial?.rate} error={e.rate} />
        </Field>
        <Field label="Nature" name={`kind-${initial?.id ?? "new"}`}>
          <select id={`kind-${initial?.id ?? "new"}`} name="kind" className="input" defaultValue={v?.kind ?? initial?.kind ?? "normal"}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Mention imprimée sur le document" name={`mention-${initial?.id ?? "new"}`} error={e.mention} hint="Ex. pour l'autoliquidation ou une exonération.">
        <TextInput id={`mention-${initial?.id ?? "new"}`} name="mention" defaultValue={v?.mention ?? initial?.mention} error={e.mention} />
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-[15px]">
        <input type="checkbox" name="requiresAttestation" defaultChecked={initial?.requiresAttestation} className="mt-0.5 size-5 accent-brand-600" />
        <span>
          Le client signe l&apos;attestation de taux réduit
          <span className="block text-sm text-slate-500">Travaux dans un logement de plus de 2 ans : la mention à signer est ajoutée au devis.</span>
        </span>
      </label>
      <SubmitButton variant="secondary">{submitLabel}</SubmitButton>
    </form>
  );
}
