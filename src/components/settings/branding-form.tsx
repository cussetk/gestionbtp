"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deleteLogoAction, saveBrandingAction, uploadLogoAction, type SettingsState } from "@/app/(app)/reglages/actions";
import { FormError, Icon, buttonStyles, cx } from "../ui";
import { SubmitButton } from "../submit-button";
import { SavedNotice, SettingsBlock } from "../settings-ui";

type Branding = {
  primaryColor: string;
  accentColor: string;
  template: "classique" | "moderne" | "epure";
  logoPosition: "gauche" | "centre" | "droite";
  font: "helvetica" | "times";
};

const TEMPLATES: { key: Branding["template"]; label: string; text: string }[] = [
  { key: "moderne", label: "Moderne", text: "Bandeau et tableau en couleur" },
  { key: "classique", label: "Classique", text: "Cadres fins, sobre" },
  { key: "epure", label: "Épuré", text: "Minimum de couleur" },
];

/** Couleurs proposées : celles du métier et des logos courants (modifiables librement). */
const SWATCHES = ["#0b74a8", "#1f6f50", "#b5651d", "#b42318", "#6941c6", "#475467", "#13202b"];

/** Mini-représentation du modèle, pour choisir d'un coup d'œil. */
function TemplateThumb({ template, color }: { template: Branding["template"]; color: string }) {
  return (
    <svg viewBox="0 0 60 78" className="h-20 w-auto rounded bg-white shadow-sm ring-1 ring-slate-200" aria-hidden>
      {template === "moderne" && <rect x="0" y="0" width="60" height="3" fill={color} />}
      <rect x="6" y="8" width="12" height="7" rx="1" fill="#cbd5e1" />
      <rect x="36" y="8" width="18" height="2" fill={template === "epure" ? "#334155" : color} />
      <rect x="36" y="12" width="14" height="1.5" fill="#cbd5e1" />
      <rect x="6" y="20" width="16" height="3" fill={template === "epure" ? "#334155" : color} />
      {template === "classique" && <rect x="6" y="26" width="48" height="0.7" fill="#334155" />}
      <rect x="6" y="29" width="22" height="8" fill={template === "moderne" ? "#eef2f6" : "none"} stroke={template === "classique" ? "#cbd5e1" : "none"} strokeWidth="0.5" />
      <rect x="32" y="29" width="22" height="8" fill={template === "moderne" ? "#eef2f6" : "none"} stroke={template === "classique" ? "#cbd5e1" : "none"} strokeWidth="0.5" />
      <rect x="6" y="41" width="48" height="3" fill={template === "moderne" ? color : "none"} />
      <rect x="6" y="44" width="48" height="0.5" fill="#334155" />
      {[48, 52, 56].map((y) => (
        <rect key={y} x="6" y={y} width="48" height="1.2" fill="#e2e8f0" />
      ))}
      <rect x="34" y="62" width="20" height="4" fill={template === "epure" ? "none" : color} stroke={template === "epure" ? "#334155" : "none"} strokeWidth="0.5" />
    </svg>
  );
}

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-bold text-slate-700">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`${label} : ${c}`}
            aria-pressed={value === c}
            className={cx("size-9 rounded-full ring-offset-2", value === c ? "ring-2 ring-ink" : "ring-1 ring-slate-300")}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="flex h-9 items-center gap-2 rounded-full bg-slate-100 pl-1 pr-3 text-sm">
          <input type="color" name={name} value={value} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
          <span className="font-mono">{value}</span>
        </label>
      </div>
    </fieldset>
  );
}

function Segmented<T extends string>({ name, value, options, onChange, label }: { name: string; value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-bold text-slate-700">{label}</legend>
      <div className="inline-grid grid-flow-col gap-1 rounded-xl bg-slate-100 p-1">
        {options.map((o) => (
          <label key={o.key} className={cx("flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-bold", value === o.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600")}>
            <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Redimensionne l'image dans le navigateur (≤ 800 × 400) avant l'envoi : rapide et léger. */
async function prepareLogo(file: File): Promise<{ base64: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image illisible"));
      i.src = url;
    });
    const scale = Math.min(1, 800 / img.naturalWidth, 400 / img.naturalHeight);
    const width = Math.max(16, Math.round(img.naturalWidth * scale));
    const height = Math.max(16, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    let dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > 520_000) {
      // Photo lourde : JPEG sur fond blanc.
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    }
    return { base64: dataUrl.split(",")[1], width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BrandingForm({ initial, logo }: { initial: Branding; logo: { sha256: string } | null }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveBrandingAction, {});
  const [b, setB] = useState<Branding>(initial);
  const [logoMsg, setLogoMsg] = useState<SettingsState | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  // Clé de l'aperçu : change après chaque enregistrement, ce qui recharge le PDF.
  const previewKey = `${logo?.sha256.slice(0, 8) ?? "sans-logo"}-${state.at ?? 0}-${logoMsg?.at ?? 0}`;

  function onFile(file: File | undefined) {
    if (!file) return;
    setLogoMsg(null);
    startUpload(async () => {
      try {
        const prepared = await prepareLogo(file);
        setLogoMsg(await uploadLogoAction(prepared));
      } catch {
        setLogoMsg({ errors: { logo: "Image illisible. Utilisez un fichier PNG, JPEG ou SVG." } });
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const set = <K extends keyof Branding>(k: K) => (v: Branding[K]) => setB((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <SettingsBlock title="Logo" description="PNG, JPEG ou SVG. Il est redimensionné automatiquement.">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-40 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
              {logo || logoMsg?.ok === "Logo enregistré" ? (
                // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'application
                <img src={`/reglages/documents/logo?v=${previewKey}`} alt="Logo actuel" className="max-h-16 max-w-36 object-contain" />
              ) : (
                <span className="text-sm text-slate-400">Aucun logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className={cx(buttonStyles.secondary, "cursor-pointer")}>
                <Icon name="plus" /> {uploading ? "Envoi…" : logo ? "Changer le logo" : "Ajouter un logo"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  data-testid="logo-input"
                />
              </label>
              {(logo || logoMsg?.ok === "Logo enregistré") && logoMsg?.ok !== "Logo supprimé" && (
                <button
                  type="button"
                  className="text-left text-sm font-bold text-red-700"
                  onClick={() => startUpload(async () => setLogoMsg(await deleteLogoAction()))}
                >
                  Retirer le logo
                </button>
              )}
            </div>
          </div>
          <SavedNotice text={logoMsg?.ok} />
          <FormError message={logoMsg?.errors?.logo ?? logoMsg?.errors?._form} />
        </SettingsBlock>

        <form action={action} className="space-y-4">
          <SettingsBlock title="Modèle et couleurs">
            <SavedNotice text={state.ok} />
            <FormError message={state.errors?._form} />
            <fieldset>
              <legend className="mb-1.5 block text-sm font-bold text-slate-700">Modèle</legend>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <label
                    key={t.key}
                    className={cx(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3 text-center",
                      b.template === t.key ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-1 ring-slate-200",
                    )}
                  >
                    <input type="radio" name="template" value={t.key} checked={b.template === t.key} onChange={() => set("template")(t.key)} className="sr-only" />
                    <TemplateThumb template={t.key} color={b.primaryColor} />
                    <span>
                      <span className="block text-sm font-bold">{t.label}</span>
                      <span className="hidden text-xs text-slate-500 sm:block">{t.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <ColorField name="primaryColor" label="Couleur principale" value={b.primaryColor} onChange={set("primaryColor")} />
            <ColorField name="accentColor" label="Couleur du texte" value={b.accentColor} onChange={set("accentColor")} />
            <Segmented
              name="logoPosition"
              label="Position du logo"
              value={b.logoPosition}
              onChange={set("logoPosition")}
              options={[
                { key: "gauche", label: "Gauche" },
                { key: "centre", label: "Centre" },
                { key: "droite", label: "Droite" },
              ]}
            />
            <Segmented
              name="font"
              label="Police"
              value={b.font}
              onChange={set("font")}
              options={[
                { key: "helvetica", label: "Sans empattement" },
                { key: "times", label: "Avec empattement" },
              ]}
            />
          </SettingsBlock>
          <SubmitButton className="w-full lg:w-auto">Enregistrer et voir l&apos;aperçu</SubmitButton>
        </form>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-700">Aperçu d&apos;un devis</h2>
          <a href={`/reglages/documents/apercu?v=${previewKey}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-700 underline">
            Ouvrir le PDF
          </a>
        </div>
        <iframe
          key={previewKey}
          src={`/reglages/documents/apercu?v=${previewKey}#toolbar=0&view=FitH`}
          title="Aperçu PDF d'un devis"
          className="hidden h-[78vh] w-full rounded-xl bg-white ring-1 ring-slate-200 lg:block"
        />
        <p className="text-sm text-slate-500 lg:hidden">
          Sur téléphone, ouvrez le PDF pour voir le rendu exact. Les vraies informations de votre entreprise y figurent ; le client et
          les lignes sont des exemples.
        </p>
      </div>
    </div>
  );
}
