import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { loadOr404 } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/dates";
import { euros, unitShort } from "@/lib/catalog";
import { getImport } from "@/server/catalog-import";
import { Card, Icon, PageHeader, buttonStyles, cx } from "@/components/ui";
import { ImportStatusBadge } from "@/components/catalog-ui";
import { ImportReview } from "@/components/import/import-review";

export const metadata: Metadata = { title: "Relecture de l'import" };

const ACTION_LABEL = { creer: "Créé", maj: "Prix mis à jour", ignorer: "Ignoré" } as const;

export default async function ImportReviewPage({ params }: PageProps<"/catalogue/imports/[id]">) {
  const session = await requirePermission("catalogue.modifier");
  if (!can(session, "prix.achat")) redirect("/acces-refuse?droit=prix.achat");
  const { id } = await params;
  const { import: imp, supplierName, taxRates, defaultCoefX1000 } = await loadOr404(id, () => getImport(toCtx(session), id));
  const draft = imp.status === "brouillon";

  return (
    <div className="lg:max-w-6xl">
      <PageHeader
        back={draft ? "/catalogue/importer" : "/catalogue"}
        title={draft ? "Relisez avant d'importer" : "Import de grille"}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {supplierName ?? "Sans fournisseur"}, {imp.fileName ?? (imp.source === "ia" ? "photo" : "fichier")}, {formatDateTime(imp.createdAt, session.orgTimezone)}
            </span>
            <ImportStatusBadge status={imp.status} />
          </span>
        }
      />

      {draft && imp.source === "ia" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-[15px] text-amber-950 ring-1 ring-amber-200">
          <span className="font-bold">Lu par l&apos;IA à partir de votre document.</span> Comparez chaque prix avec la grille avant de valider : une
          erreur de lecture reste possible.
          {imp.notes && <span className="mt-1 block">Remarque de lecture : {imp.notes}</span>}
        </p>
      )}

      {draft ? (
        <ImportReview importId={imp.id} source={imp.source} rows={imp.rows} taxRates={taxRates} defaultCoefX1000={defaultCoefX1000} />
      ) : (
        <>
          {imp.status === "applique" && imp.summary && (
            <section className="mb-4 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200" role="status">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
                <Icon name="check" /> Import validé
              </h2>
              <p className="mt-1 text-[15px] text-emerald-950">
                {imp.summary.created} article{imp.summary.created > 1 ? "s" : ""} créé{imp.summary.created > 1 ? "s" : ""}, {imp.summary.updated} prix mis à jour
                {imp.summary.unchanged > 0 ? `, ${imp.summary.unchanged} sans changement` : ""}, {imp.summary.ignored} ligne{imp.summary.ignored > 1 ? "s" : ""} ignorée
                {imp.summary.ignored > 1 ? "s" : ""}.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/catalogue" className={buttonStyles.primary}>
                  Voir le catalogue
                </Link>
                <Link href="/catalogue/importer" className={buttonStyles.secondary}>
                  Importer une autre grille
                </Link>
              </div>
            </section>
          )}
          {imp.status === "abandonne" && (
            <Card className="mb-4">
              <p className="text-[15px]">Import abandonné : le catalogue n&apos;a pas été modifié.</p>
            </Card>
          )}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {imp.rows.map((r) => (
              <li key={r.key} className={cx("flex items-center gap-3 px-4 py-2.5", r.action === "ignorer" && "text-slate-400")}>
                <span className="min-w-0 flex-1">
                  {r.matchItemId && r.action !== "ignorer" ? (
                    <Link href={`/catalogue/${r.matchItemId}`} className="font-medium text-ink hover:text-brand-700">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.name}</span>
                  )}
                  <span className="block text-xs">{[r.supplierRef && `Réf. ${r.supplierRef}`, ACTION_LABEL[r.action]].filter(Boolean).join(", ")}</span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  {euros(r.purchasePriceCents)} <span className="text-slate-400">/ {unitShort(r.unit)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
