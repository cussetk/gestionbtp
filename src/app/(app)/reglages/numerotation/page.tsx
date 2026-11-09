import type { Metadata } from "next";
import { loadSettingsPage } from "@/lib/settings-page";
import { DOC_TYPES } from "@/lib/numbering";
import { PageHeader } from "@/components/ui";
import { LegalNote } from "@/components/settings-ui";
import { SeriesForm } from "@/components/settings/series-form";

export const metadata: Metadata = { title: "Numérotation" };

export default async function NumberingPage() {
  const { bundle } = await loadSettingsPage();
  return (
    <div className="space-y-4 lg:max-w-3xl">
      <PageHeader title="Numérotation" subtitle="Format des numéros de vos documents" back="/reglages" />
      <LegalNote>
        <p className="font-bold">Ce que la loi impose pour les factures, avoirs et acomptes</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Un numéro unique, dans une suite chronologique et continue : ni trou, ni doublon.</li>
          <li>Plusieurs séries sont possibles (factures, avoirs…), chacune continue.</li>
          <li>Le numéro est attribué au moment de l&apos;émission, jamais au brouillon : un brouillon supprimé ne crée pas de trou.</li>
          <li>Une facture émise ne se modifie ni ne se supprime : on la corrige par un avoir.</li>
        </ul>
        <p className="mt-1">Une fois le premier document numéroté, son format est verrouillé.</p>
      </LegalNote>
      {bundle.series.map((s) => {
        const meta = DOC_TYPES.find((d) => d.key === s.docType)!;
        return (
          <SeriesForm
            key={s.id}
            docType={s.docType}
            label={meta.label}
            pattern={s.pattern}
            padding={s.padding}
            reset={s.reset}
            lastNumber={s.lastNumber}
            lastYear={s.lastYear}
            locked={!!s.lockedAt}
            timeZone={bundle.org.timezone}
          />
        );
      })}
    </div>
  );
}
