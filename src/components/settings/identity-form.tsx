"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { lookupSiretAction, saveIdentityAction, type SettingsState } from "@/app/(app)/reglages/actions";
import { LEGAL_FORMS, isSociety, vatNumberFromSiren } from "@/lib/company";
import { Field, FormError, Icon, TextInput, buttonStyles, cx } from "../ui";
import { SubmitButton } from "../submit-button";
import { LegalNote, SavedNotice, SettingsBlock } from "../settings-ui";

type Values = Record<string, string>;

export function IdentityForm({ initial }: { initial: Values }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveIdentityAction, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [legalForm, setLegalForm] = useState(v.legalForm ?? "");
  const [lookup, setLookup] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function setField(name: string, value: string | null) {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el && value != null) el.value = value;
  }

  function fillFromSiret() {
    const siret = (formRef.current?.elements.namedItem("siret") as HTMLInputElement | null)?.value ?? "";
    setLookup(null);
    start(async () => {
      const res = await lookupSiretAction(siret);
      if (!res.ok) {
        setLookup({ ok: false, text: res.error });
        return;
      }
      const d = res.data;
      setField("name", d.name);
      setField("siret", d.siret);
      setField("vatNumber", d.vatNumber);
      setField("nafCode", d.nafCode);
      setField("addressLine1", d.addressLine1);
      setField("postalCode", d.postalCode);
      setField("city", d.city);
      if (d.legalForm) setLegalForm(d.legalForm);
      setLookup({
        ok: !d.closed,
        text: d.closed
          ? "Attention : l'annuaire indique cet établissement comme fermé. Vérifiez le SIRET."
          : "Informations récupérées depuis l'annuaire officiel. Relisez-les, complétez le capital et l'immatriculation, puis enregistrez.",
      });
    });
  }

  function computeVat() {
    const siret = (formRef.current?.elements.namedItem("siret") as HTMLInputElement | null)?.value.replace(/\s/g, "") ?? "";
    const vat = vatNumberFromSiren(siret.slice(0, 9));
    if (vat) setField("vatNumber", vat);
  }

  const society = isSociety(legalForm);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormError message={e._form} />
      <SavedNotice text={state.ok} />

      <SettingsBlock title="Identité légale" description="Imprimée en pied de page de chaque devis et facture.">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="SIRET" name="siret" error={e.siret}>
            <TextInput name="siret" inputMode="numeric" defaultValue={v.siret} error={e.siret} />
          </Field>
          <button type="button" onClick={fillFromSiret} disabled={pending} className={buttonStyles.secondary}>
            <Icon name="search" /> {pending ? "Recherche…" : "Remplir depuis le SIRET"}
          </button>
        </div>
        {lookup && (
          <p role="status" className={cx("rounded-lg px-3 py-2 text-sm", lookup.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
            {lookup.text}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Raison sociale *" name="name" error={e.name}>
            <TextInput name="name" defaultValue={v.name} error={e.name} />
          </Field>
          <Field label="Nom commercial" name="tradeName" error={e.tradeName} hint="S'il diffère de la raison sociale.">
            <TextInput name="tradeName" defaultValue={v.tradeName} error={e.tradeName} />
          </Field>
          <Field label="Forme juridique *" name="legalForm" error={e.legalForm}>
            <select id="legalForm" name="legalForm" className="input" value={legalForm} onChange={(ev) => setLegalForm(ev.target.value)}>
              <option value="">Choisir…</option>
              {LEGAL_FORMS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={society ? "Capital social (€) *" : "Capital social (€)"} name="shareCapital" error={e.shareCapital} hint={society ? undefined : "Uniquement pour une société."}>
            <TextInput name="shareCapital" inputMode="decimal" defaultValue={v.shareCapital} error={e.shareCapital} />
          </Field>
          <Field
            label={society ? "Immatriculation *" : "Immatriculation"}
            name="registration"
            error={e.registration}
            hint="Ex. RCS Pointe-à-Pitre 732 829 320, ou RM 971 732 829 320 pour un artisan."
          >
            <TextInput name="registration" defaultValue={v.registration} error={e.registration} />
          </Field>
          <Field label="Code NAF / APE" name="nafCode" error={e.nafCode} hint="Ex. 43.22B pour l'installation de climatisation.">
            <TextInput name="nafCode" defaultValue={v.nafCode} error={e.nafCode} />
          </Field>
          <Field label="N° de TVA intracommunautaire" name="vatNumber" error={e.vatNumber}>
            <div className="flex gap-2">
              <TextInput name="vatNumber" defaultValue={v.vatNumber} error={e.vatNumber} />
              <button type="button" onClick={computeVat} className={cx(buttonStyles.secondary, "shrink-0 px-3")} title="Calculer depuis le SIREN">
                Calculer
              </button>
            </div>
          </Field>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Siège et coordonnées">
        <Field label="Adresse du siège *" name="addressLine1" error={e.addressLine1}>
          <TextInput name="addressLine1" autoComplete="address-line1" defaultValue={v.addressLine1} error={e.addressLine1} />
        </Field>
        <Field label="Complément" name="addressLine2" error={e.addressLine2}>
          <TextInput name="addressLine2" defaultValue={v.addressLine2} error={e.addressLine2} />
        </Field>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Code postal *" name="postalCode" error={e.postalCode}>
            <TextInput name="postalCode" inputMode="numeric" maxLength={5} defaultValue={v.postalCode} error={e.postalCode} />
          </Field>
          <Field label="Ville *" name="city" error={e.city}>
            <TextInput name="city" defaultValue={v.city} error={e.city} />
          </Field>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Téléphone" name="phone" error={e.phone}>
            <TextInput name="phone" type="tel" inputMode="tel" defaultValue={v.phone} error={e.phone} />
          </Field>
          <Field label="E-mail" name="email" error={e.email}>
            <TextInput name="email" type="email" inputMode="email" defaultValue={v.email} error={e.email} />
          </Field>
          <Field label="Site internet" name="website" error={e.website}>
            <TextInput name="website" inputMode="url" defaultValue={v.website} error={e.website} />
          </Field>
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Assurance décennale"
        description="Mention obligatoire sur les devis et factures des artisans du bâtiment : assureur, contrat, zone couverte."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Assureur *" name="insurerName" error={e.insurerName}>
            <TextInput name="insurerName" defaultValue={v.insurerName} error={e.insurerName} />
          </Field>
          <Field label="N° de contrat *" name="insurancePolicy" error={e.insurancePolicy}>
            <TextInput name="insurancePolicy" defaultValue={v.insurancePolicy} error={e.insurancePolicy} />
          </Field>
        </div>
        <Field label="Adresse de l'assureur" name="insurerAddress" error={e.insurerAddress}>
          <TextInput name="insurerAddress" defaultValue={v.insurerAddress} error={e.insurerAddress} />
        </Field>
        <Field label="Couverture géographique *" name="insuranceCoverage" error={e.insuranceCoverage} hint="Ex. Guadeloupe et îles du Nord, ou France métropolitaine.">
          <TextInput name="insuranceCoverage" defaultValue={v.insuranceCoverage} error={e.insuranceCoverage} />
        </Field>
      </SettingsBlock>

      <SettingsBlock title="Fluides frigorigènes">
        <Field
          label="N° d'attestation de capacité"
          name="fluidCapacityCertificate"
          error={e.fluidCapacityCertificate}
          hint="Imprimé sur la fiche d'intervention CERFA 15497."
        >
          <TextInput name="fluidCapacityCertificate" defaultValue={v.fluidCapacityCertificate} error={e.fluidCapacityCertificate} />
        </Field>
      </SettingsBlock>

      <LegalNote>
        Reprenez ces informations de vos documents officiels (Kbis ou extrait du répertoire des métiers, attestation
        d&apos;assurance). En cas de doute, demandez à votre expert-comptable.
      </LegalNote>

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <SubmitButton className="w-full shadow-lg lg:w-auto">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
