"use client";

import { useActionState } from "react";
import { savePaymentAction, type SettingsState } from "@/app/(app)/reglages/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { Field, FormError, TextArea, TextInput } from "../ui";
import { SubmitButton } from "../submit-button";
import { LegalNote, SavedNotice, SettingsBlock } from "../settings-ui";

type Values = Record<string, string>;

export function PaymentForm({ initial, methods }: { initial: Values; methods: string[] }) {
  const [state, action] = useActionState<SettingsState, FormData>(savePaymentAction, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={e._form} />
      <SavedNotice text={state.ok} />

      <SettingsBlock title="Devis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durée de validité (jours)" name="quoteValidityDays" error={e.quoteValidityDays}>
            <TextInput name="quoteValidityDays" inputMode="numeric" defaultValue={v.quoteValidityDays} error={e.quoteValidityDays} />
          </Field>
          <Field label="Acompte à la signature (%)" name="depositPercent" error={e.depositPercent} hint="0 si vous ne demandez pas d'acompte.">
            <TextInput name="depositPercent" inputMode="numeric" defaultValue={v.depositPercent} error={e.depositPercent} />
          </Field>
        </div>
        <Field label="Texte en bas des devis" name="quoteFooter" error={e.quoteFooter} hint="Ex. délai d'intervention, garantie constructeur.">
          <TextArea name="quoteFooter" defaultValue={v.quoteFooter} error={e.quoteFooter} />
        </Field>
      </SettingsBlock>

      <SettingsBlock title="Factures et règlements">
        <Field
          label="Délai de paiement (jours)"
          name="paymentTermsDays"
          error={e.paymentTermsDays}
          hint="0 = paiement à réception. 60 jours maximum à compter de la facture."
        >
          <TextInput name="paymentTermsDays" inputMode="numeric" defaultValue={v.paymentTermsDays} error={e.paymentTermsDays} />
        </Field>
        <Field label="Pénalités de retard *" name="latePenaltyText" error={e.latePenaltyText} hint="Le taux ne peut pas être inférieur à trois fois le taux d'intérêt légal.">
          <TextArea name="latePenaltyText" rows={2} defaultValue={v.latePenaltyText} error={e.latePenaltyText} />
        </Field>
        <Field label="Escompte pour paiement anticipé *" name="earlyPaymentDiscountText" error={e.earlyPaymentDiscountText}>
          <TextInput name="earlyPaymentDiscountText" defaultValue={v.earlyPaymentDiscountText} error={e.earlyPaymentDiscountText} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-bold text-slate-700">Moyens de paiement acceptés</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200">
                <input type="checkbox" name="paymentMethods" value={key} defaultChecked={methods.includes(key)} className="size-5 accent-brand-600" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Texte en bas des factures" name="invoiceFooter" error={e.invoiceFooter}>
          <TextArea name="invoiceFooter" defaultValue={v.invoiceFooter} error={e.invoiceFooter} />
        </Field>
        <LegalNote>
          L&apos;indemnité forfaitaire de 40 € pour frais de recouvrement est ajoutée automatiquement sur les factures adressées à
          des professionnels.
        </LegalNote>
      </SettingsBlock>

      <SettingsBlock title="Coordonnées bancaires" description="Imprimées sur vos factures pour le paiement par virement.">
        <Field label="Banque" name="bankName" error={e.bankName}>
          <TextInput name="bankName" defaultValue={v.bankName} error={e.bankName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="IBAN" name="iban" error={e.iban}>
            <TextInput name="iban" className="input font-mono" defaultValue={v.iban} error={e.iban} autoComplete="off" />
          </Field>
          <Field label="BIC" name="bic" error={e.bic}>
            <TextInput name="bic" className="input font-mono" defaultValue={v.bic} error={e.bic} autoComplete="off" />
          </Field>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Conditions générales de vente" description="Ajoutées en dernière page de vos devis et factures.">
        <Field label="Texte des CGV" name="cgv" error={e.cgv} hint="Copiez-collez vos CGV (issues d'un Word ou d'un PDF).">
          <TextArea name="cgv" rows={10} defaultValue={v.cgv} error={e.cgv} />
        </Field>
      </SettingsBlock>

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <SubmitButton className="w-full shadow-lg lg:w-auto">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
