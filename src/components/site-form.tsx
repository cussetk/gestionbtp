"use client";

import { useActionState, useState } from "react";
import { saveSiteAction, type FormState } from "@/app/(app)/clients/actions";
import { formatCoordinates, parseCoordinates } from "@/lib/geo";
import { Field, FormError, Icon, TextArea, TextInput, buttonStyles, cx } from "./ui";
import { SubmitButton } from "./submit-button";
import { geoErrorMessage, locateDevice } from "./geolocate";

type Values = Record<string, string | number | null | undefined>;

const SOURCE_LABEL: Record<string, string> = {
  gps: "relevée sur place",
  adresse: "calculée depuis l'adresse",
  manuel: "saisie à la main",
};

export function SiteForm({ mode, initial }: { mode: "create" | "update"; initial: Values }) {
  const [state, action] = useActionState<FormState, FormData>(saveSiteAction, {});
  const v: Values = state.values ?? initial;
  const e = state.errors ?? {};
  const val = (k: string) => (v[k] ?? "").toString();

  const initialCoords = state.values
    ? (state.values.coordinates ?? "")
    : formatCoordinates(initial.latitude as number | null, initial.longitude as number | null);
  const [coords, setCoords] = useState<string>(initialCoords);
  const [source, setSource] = useState<string>(val("geoSource"));
  const [accuracy, setAccuracy] = useState<string>(val("geoAccuracyM"));
  const [status, setStatus] = useState<{ tone: "info" | "ok" | "error"; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  async function locate() {
    setLocating(true);
    setStatus({ tone: "info", text: "Recherche de votre position…" });
    try {
      const fix = await locateDevice();
      setCoords(formatCoordinates(fix.lat, fix.lng));
      setSource("gps");
      setAccuracy(String(Math.round(fix.accuracy)));
      setStatus({ tone: "ok", text: `Position relevée (précision ${Math.round(fix.accuracy)} m). Enregistrez pour la garder.` });
    } catch (err) {
      setStatus({ tone: "error", text: geoErrorMessage(err) });
    } finally {
      setLocating(false);
    }
  }

  const parsed = parseCoordinates(coords);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={val("id")} />
      <input type="hidden" name="clientId" value={val("clientId")} />
      <input type="hidden" name="geoSource" value={source} />
      <input type="hidden" name="geoAccuracyM" value={accuracy} />
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

      <div className="space-y-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-700">Position du site</p>
        <button type="button" onClick={locate} disabled={locating} className={cx(buttonStyles.secondary, "w-full")}>
          <Icon name="locate" />
          {locating ? "Recherche…" : "Je suis sur place : relever ma position"}
        </button>
        {status && (
          <p
            role="status"
            className={cx(
              "rounded-lg px-3 py-2 text-sm",
              status.tone === "error" && "bg-red-50 text-red-700",
              status.tone === "ok" && "bg-emerald-50 text-emerald-800",
              status.tone === "info" && "text-slate-600",
            )}
          >
            {status.text}
          </p>
        )}
        <Field
          label="Coordonnées ou lien Google Maps"
          name="coordinates"
          error={e.coordinates}
          hint={
            parsed
              ? `Position ${SOURCE_LABEL[source] ?? "saisie à la main"} : ${formatCoordinates(parsed.lat, parsed.lng)}`
              : "Laissez vide : la position sera calculée depuis l'adresse. Vous pouvez coller un lien Maps ou une position WhatsApp."
          }
        >
          <TextInput
            name="coordinates"
            value={coords}
            onChange={(ev) => {
              setCoords(ev.target.value);
              setSource("manuel");
              setAccuracy("");
            }}
            placeholder="16.2412, -61.5331"
            inputMode="text"
            autoComplete="off"
            error={e.coordinates}
          />
        </Field>
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
