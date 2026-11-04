"use client";

import { useActionState, useRef, useState } from "react";
import { saveSiteAction, type FormState } from "@/app/(app)/clients/actions";
import { Field, FormError, Icon, TextArea, TextInput, buttonStyles, cx } from "./ui";
import { SubmitButton } from "./submit-button";

type Values = Record<string, string | number | null | undefined>;

export function SiteForm({ mode, initial }: { mode: "create" | "update"; initial: Values }) {
  const [state, action] = useActionState<FormState, FormData>(saveSiteAction, {});
  const v: Values = state.values ?? initial;
  const e = state.errors ?? {};
  const val = (k: string) => (v[k] ?? "").toString();
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState<string | null>(v.latitude ? "Position enregistrée" : null);

  function locate() {
    if (!navigator.geolocation) return setGeo("Localisation indisponible sur cet appareil");
    setGeo("Recherche de la position…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (lat.current) lat.current.value = pos.coords.latitude.toFixed(6);
        if (lng.current) lng.current.value = pos.coords.longitude.toFixed(6);
        setGeo(`Position relevée (précision ${Math.round(pos.coords.accuracy)} m)`);
      },
      () => setGeo("Position refusée ou indisponible"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={val("id")} />
      <input type="hidden" name="clientId" value={val("clientId")} />
      <FormError message={e._form ?? e.clientId} />

      <Field label="Nom du site *" name="label" error={e.label} hint="Ex. Domicile, Magasin Jarry, Bureaux 2e étage">
        <TextInput name="label" defaultValue={val("label")} error={e.label} />
      </Field>
      <Field label="Adresse *" name="addressLine1" error={e.addressLine1}>
        <TextInput name="addressLine1" autoComplete="address-line1" defaultValue={val("addressLine1")} error={e.addressLine1} />
      </Field>
      <Field label="Complément" name="addressLine2" error={e.addressLine2}>
        <TextInput name="addressLine2" autoComplete="address-line2" defaultValue={val("addressLine2")} error={e.addressLine2} />
      </Field>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Field label="Code postal *" name="postalCode" error={e.postalCode}>
          <TextInput name="postalCode" inputMode="numeric" maxLength={5} defaultValue={val("postalCode")} error={e.postalCode} />
        </Field>
        <Field label="Ville *" name="city" error={e.city}>
          <TextInput name="city" defaultValue={val("city")} error={e.city} />
        </Field>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <button type="button" onClick={locate} className={cx(buttonStyles.secondary, "w-full")}>
          <Icon name="locate" />
          Je suis sur place : relever la position GPS
        </button>
        {geo && <p className="mt-2 text-center text-xs text-slate-600">{geo}</p>}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Latitude" name="latitude" error={e.latitude}>
            <TextInput ref={lat} name="latitude" inputMode="decimal" defaultValue={val("latitude")} error={e.latitude} />
          </Field>
          <Field label="Longitude" name="longitude" error={e.longitude}>
            <TextInput ref={lng} name="longitude" inputMode="decimal" defaultValue={val("longitude")} error={e.longitude} />
          </Field>
        </div>
      </div>

      <Field label="Accès" name="accessNotes" error={e.accessNotes} hint="Code portail, étage, emplacement des groupes extérieurs, animaux…">
        <TextArea name="accessNotes" defaultValue={val("accessNotes")} error={e.accessNotes} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact sur place" name="contactName" error={e.contactName}>
          <TextInput name="contactName" defaultValue={val("contactName")} error={e.contactName} />
        </Field>
        <Field label="Tél. du contact" name="contactPhone" error={e.contactPhone}>
          <TextInput name="contactPhone" type="tel" inputMode="tel" defaultValue={val("contactPhone")} error={e.contactPhone} />
        </Field>
      </div>
      <Field label="Notes" name="notes" error={e.notes}>
        <TextArea name="notes" defaultValue={val("notes")} error={e.notes} />
      </Field>

      <SubmitButton className="w-full">{mode === "create" ? "Ajouter le site" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
