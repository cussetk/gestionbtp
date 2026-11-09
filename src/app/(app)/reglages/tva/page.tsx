import type { Metadata } from "next";
import { loadSettingsPage } from "@/lib/settings-page";
import { formatRate, zoneLabel } from "@/lib/tax";
import { PageHeader, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { LegalNote, SettingsBlock } from "@/components/settings-ui";
import { TaxRateForm, TaxRegimeForm } from "@/components/settings/tax-forms";
import { taxRateCommandAction } from "../actions";

export const metadata: Metadata = { title: "TVA" };

const KIND_LABEL: Record<string, string> = {
  normal: "Normal",
  reduit: "Réduit",
  particulier: "Particulier",
  exonere: "Non applicable",
  autoliquidation: "Autoliquidation",
};

function Command({ id, command, label, variant = "secondary", confirm }: { id?: string; command: string; label: string; variant?: "secondary" | "danger" | "ghost"; confirm?: string }) {
  return (
    <form action={taxRateCommandAction}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="command" value={command} />
      <SubmitButton variant={variant} pendingLabel="…" confirm={confirm} className="min-h-10 px-3 text-sm">
        {label}
      </SubmitButton>
    </form>
  );
}

export default async function TaxSettingsPage() {
  const { bundle } = await loadSettingsPage();
  const { settings: s, taxRates, org } = bundle;
  const active = taxRates.filter((r) => r.active);
  const inactive = taxRates.filter((r) => !r.active);
  const franchise = s.vatRegime === "franchise";

  return (
    <div className="space-y-4 lg:max-w-3xl">
      <PageHeader title="TVA" subtitle={`Zone : ${zoneLabel(org.timezone)}`} back="/reglages" />

      <SettingsBlock title="Régime de TVA">
        <TaxRegimeForm vatRegime={s.vatRegime} vatOnDebits={s.vatOnDebits} />
      </SettingsBlock>

      <SettingsBlock
        title="Taux proposés sur les lignes"
        description={
          franchise
            ? "En franchise, vos documents sont émis sans TVA : ces taux ne sont pas utilisés."
            : "Le taux par défaut est appliqué aux nouvelles lignes ; chaque article pourra avoir son propre taux."
        }
      >
        <ul className={cx("divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200", franchise && "opacity-60")}>
          {active.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-16 text-lg font-bold tabular-nums">{formatRate(r.rateBp)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{r.label}</span>
                  <span className="flex flex-wrap gap-1.5 pt-0.5 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{KIND_LABEL[r.kind]}</span>
                    {r.isDefault && <span className="rounded bg-brand-600 px-1.5 py-0.5 font-bold text-white">Par défaut</span>}
                    {r.requiresAttestation && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Attestation du client</span>}
                  </span>
                  {r.mention && <span className="mt-1 block text-sm text-slate-500">Mention : {r.mention}</span>}
                </span>
                <span className="flex gap-2">
                  {!r.isDefault && <Command id={r.id} command="default" label="Par défaut" />}
                  {!r.isDefault && <Command id={r.id} command="deactivate" label="Retirer" variant="ghost" />}
                </span>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-bold text-brand-700">Modifier</summary>
                <div className="mt-2">
                  <TaxRateForm
                    submitLabel="Enregistrer le taux"
                    initial={{
                      id: r.id,
                      label: r.label,
                      rate: String(r.rateBp / 100).replace(".", ","),
                      kind: r.kind,
                      mention: r.mention ?? "",
                      requiresAttestation: r.requiresAttestation,
                    }}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer font-bold text-brand-700">Ajouter un taux</summary>
          <div className="mt-2">
            <TaxRateForm submitLabel="Ajouter le taux" />
          </div>
        </details>
        {inactive.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-slate-500">Taux retirés ({inactive.length})</summary>
            <ul className="mt-2 space-y-2">
              {inactive.map((r) => (
                <li key={r.id} className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="w-14 tabular-nums">{formatRate(r.rateBp)}</span>
                  <span className="flex-1">{r.label}</span>
                  <Command id={r.id} command="activate" label="Rétablir" variant="ghost" />
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="border-t border-slate-100 pt-3">
          <Command
            command="reset"
            label={`Revenir aux taux de ${zoneLabel(org.timezone)}`}
            variant="ghost"
            confirm="Remplacer les taux actuels par ceux de votre zone ? Les anciens taux restent dans l'historique."
          />
        </div>
      </SettingsBlock>

      <LegalNote>
        Guadeloupe, Martinique et La Réunion : 8,5 % et 2,1 %. Guyane et Mayotte : TVA non applicable. Métropole : 20 %, 10 % et
        5,5 %. Depuis 2025, l&apos;attestation CERFA des taux réduits est remplacée par une mention signée par le client sur le
        devis ou la facture. Faites valider vos taux par votre expert-comptable.
      </LegalNote>
    </div>
  );
}
