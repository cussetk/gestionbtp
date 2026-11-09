"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { lookupSupplierAction, saveSupplierAction, type FormState } from "@/app/(app)/fournisseurs/actions";
import { Field, FormError, Icon, TextArea, TextInput, buttonStyles, cx } from "./ui";
import { SubmitButton } from "./submit-button";

type Values = Record<string, string | null | undefined>;

export function SupplierForm({ mode, initial }: { mode: "create" | "update"; initial: Values }) {
  const [state, action] = useActionState<FormState, FormData>(saveSupplierAction, {});
  const v: Values = state.values ?? initial;
  const e = state.errors ?? {};
  const val = (k: string) => v[k] ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  const [lookup, setLookup] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function setField(name: string, value: string | null) {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (el && value) el.value = value;
  }

  function fillFromSiret() {
    const siret = (formRef.current?.elements.namedItem("siret") as HTMLInputElement | null)?.value ?? "";
    setLookup(null);
    start(async () => {
      const res = await lookupSupplierAction(siret);
      if (!res.ok) return setLookup({ ok: false, text: res.error });
      const d = res.data;
      setField("name", d.name);
      setField("siret", d.siret);
      setField("vatNumber", d.vatNumber);
      setField("addressLine1", d.addressLine1);
      setField("postalCode", d.postalCode);
      setField("city", d.city);
      setLookup({ ok: !d.closed, text: d.closed ? "L'annuaire indique cet établissement comme fermé." : "Informations récupérées depuis l'annuaire officiel." });
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={val("id")} />
      <FormError message={e._form} />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <Field label="SIRET" name="siret" error={e.siret} hint="Facultatif : remplit le nom et l'adresse automatiquement.">
          <TextInput name="siret" inputMode="numeric" defaultValue={val("siret")} error={e.siret} />
        </Field>
        <button type="button" onClick={fillFromSiret} disabled={pending} className={cx(buttonStyles.secondary, "lg:mb-5")}>
          <Icon name="search" /> {pending ? "Recherche…" : "Remplir depuis le SIRET"}
        </button>
      </div>
      {lookup && (
        <p role="status" className={cx("rounded-lg px-3 py-2 text-sm", lookup.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
          {lookup.text}
        </p>
      )}

      <Field label="Nom du fournisseur *" name="name" error={e.name}>
        <TextInput name="name" autoComplete="organization" defaultValue={val("name")} error={e.name} />
      </Field>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Interlocuteur" name="contactName" error={e.contactName} hint="Votre commercial ou le comptoir.">
          <TextInput name="contactName" defaultValue={val("contactName")} error={e.contactName} />
        </Field>
        <Field label="Téléphone" name="phone" error={e.phone}>
          <TextInput name="phone" type="tel" inputMode="tel" defaultValue={val("phone")} error={e.phone} />
        </Field>
        <Field label="E-mail de commande" name="email" error={e.email} hint="Destinataire des bons de commande.">
          <TextInput name="email" type="email" inputMode="email" defaultValue={val("email")} error={e.email} />
        </Field>
        <Field label="Site internet" name="website" error={e.website}>
          <TextInput name="website" inputMode="url" defaultValue={val("website")} error={e.website} />
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-sm font-bold text-slate-700">Adresse (comptoir ou siège)</p>
        <Field label="Adresse" name="addressLine1" error={e.addressLine1}>
          <TextInput name="addressLine1" defaultValue={val("addressLine1")} error={e.addressLine1} />
        </Field>
        <Field label="Complément" name="addressLine2" error={e.addressLine2}>
          <TextInput name="addressLine2" defaultValue={val("addressLine2")} error={e.addressLine2} />
        </Field>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Code postal" name="postalCode" error={e.postalCode}>
            <TextInput name="postalCode" inputMode="numeric" maxLength={5} defaultValue={val("postalCode")} error={e.postalCode} />
          </Field>
          <Field label="Ville" name="city" error={e.city}>
            <TextInput name="city" defaultValue={val("city")} error={e.city} />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="N° de compte client" name="customerAccount" error={e.customerAccount} hint="Votre n° chez ce fournisseur.">
          <TextInput name="customerAccount" defaultValue={val("customerAccount")} error={e.customerAccount} />
        </Field>
        <Field label="Délai de paiement (jours)" name="paymentTermsDays" error={e.paymentTermsDays}>
          <TextInput name="paymentTermsDays" inputMode="numeric" defaultValue={val("paymentTermsDays")} error={e.paymentTermsDays} />
        </Field>
        <Field label="N° de TVA" name="vatNumber" error={e.vatNumber}>
          <TextInput name="vatNumber" defaultValue={val("vatNumber")} error={e.vatNumber} />
        </Field>
      </div>

      <Field label="Notes internes" name="notes" error={e.notes} hint="Conditions négociées, franco de port, horaires du comptoir…">
        <TextArea name="notes" defaultValue={val("notes")} error={e.notes} />
      </Field>

      <SubmitButton className="w-full lg:w-auto">{mode === "create" ? "Créer le fournisseur" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
