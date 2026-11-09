import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { loadOr404 } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/dates";
import { euros, formatCoef, formatPercent, kindLabel, margin, unitShort, UNITS } from "@/lib/catalog";
import { formatRate } from "@/lib/tax";
import { getItem, itemFormOptions } from "@/server/catalog";
import { ButtonLink, Card, Icon, PageHeader, SectionTitle, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { archiveItemAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/catalogue/[id]">): Promise<Metadata> {
  const session = await requirePermission("catalogue.voir");
  const { id } = await params;
  const { item } = await loadOr404(id, () => getItem(toCtx(session), id));
  return { title: item.name };
}

const SOURCE_LABEL: Record<string, string> = { creation: "Création", manuel: "Modification", import: "Import de grille" };

export default async function ItemPage({ params }: PageProps<"/catalogue/[id]">) {
  const session = await requirePermission("catalogue.voir");
  const ctx = toCtx(session);
  const { id } = await params;
  const [{ item: i, taxRate, history }, options] = await Promise.all([loadOr404(id, () => getItem(ctx, id)), itemFormOptions(ctx)]);
  const showPurchase = can(session, "prix.achat");
  const canEdit = can(session, "catalogue.modifier");
  const rate = taxRate ?? options.taxRates.find((t) => t.isDefault) ?? null;
  const ttc = rate ? Math.round(i.salePriceCents * (1 + rate.rateBp / 10000)) : null;
  const m = margin(i.purchasePriceCents, i.salePriceCents);
  const unit = UNITS.find((u) => u.key === i.unit)?.label ?? i.unit;

  return (
    <>
      <PageHeader
        back="/catalogue"
        title={i.name}
        subtitle={[kindLabel(i.kind), i.reference && `Réf. ${i.reference}`].filter(Boolean).join(", ")}
        action={
          canEdit && (
            <Link href={`/catalogue/${i.id}/modifier`} aria-label="Modifier l'article" className="grid size-11 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50 lg:hidden">
              <Icon name="edit" />
            </Link>
          )
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        <div>
          <Card>
            <p className="text-sm text-slate-500">Prix de vente HT</p>
            <p className="text-3xl font-bold tabular-nums">
              {euros(i.salePriceCents)} <span className="text-base font-medium text-slate-500">/ {unitShort(i.unit)}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {ttc !== null && `${euros(ttc)} TTC`}
              {rate && `, TVA ${formatRate(rate.rateBp)}${taxRate ? "" : " (taux par défaut)"}`}
              {taxRate && !taxRate.active && <span className="font-bold text-amber-700"> (taux désactivé : à changer)</span>}
            </p>
            {showPurchase && (
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 text-center ring-1 ring-slate-200">
                <div className="bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">Achat HT</dt>
                  <dd className="font-bold tabular-nums">{euros(i.purchasePriceCents)}</dd>
                </div>
                <div className="bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">Prix de vente</dt>
                  <dd className="font-bold">{i.pricingMode === "coef" ? `Achat × ${formatCoef(i.coefX1000)}` : "Fixe"}</dd>
                </div>
                <div className="bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">Marge</dt>
                  <dd className={cx("font-bold tabular-nums", m && m.amount < 0 && "text-red-700")}>{m ? euros(m.amount) : "—"}</dd>
                </div>
                <div className="bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">Taux de marque</dt>
                  <dd className={cx("font-bold tabular-nums", m && m.amount < 0 && "text-red-700")}>{formatPercent(m?.rate)}</dd>
                </div>
              </dl>
            )}
          </Card>

          <Card className="mt-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt className="text-slate-500">Unité</dt>
              <dd>{unit}</dd>
              {i.brand && (
                <>
                  <dt className="text-slate-500">Marque</dt>
                  <dd>{i.brand}</dd>
                </>
              )}
              {i.category && (
                <>
                  <dt className="text-slate-500">Famille</dt>
                  <dd>
                    <Link href={`/catalogue?famille=${encodeURIComponent(i.category)}`} className="text-brand-700 hover:underline">
                      {i.category}
                    </Link>
                  </dd>
                </>
              )}
              {showPurchase && (
                <>
                  <dt className="text-slate-500">Fournisseur</dt>
                  <dd>
                    {i.supplierName ? (
                      can(session, "achats.gerer") && !i.supplierArchived ? (
                        <Link href={`/fournisseurs/${i.supplierId}`} className="text-brand-700 hover:underline">
                          {i.supplierName}
                        </Link>
                      ) : (
                        `${i.supplierName}${i.supplierArchived ? " (archivé)" : ""}`
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {i.supplierRef && <span className="block text-sm text-slate-500">Réf. {i.supplierRef}</span>}
                  </dd>
                </>
              )}
              {i.kind === "produit" && (
                <>
                  <dt className="text-slate-500">Suivi</dt>
                  <dd>
                    {[i.trackSerial && "numéros de série", i.trackStock && "stock"].filter(Boolean).join(", ") || <span className="text-slate-400">aucun</span>}
                  </dd>
                </>
              )}
            </dl>
            {i.description && <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-700">{i.description}</p>}
          </Card>

          {i.notes && (
            <Card className="mt-3">
              <p className="mb-1 text-sm font-bold text-slate-500">Notes internes</p>
              <p className="whitespace-pre-wrap text-sm">{i.notes}</p>
            </Card>
          )}

          {canEdit && (
            <div className="mt-6 flex flex-col gap-2">
              <span className="hidden lg:contents">
                <ButtonLink href={`/catalogue/${i.id}/modifier`} variant="secondary">
                  <Icon name="edit" /> Modifier l&apos;article
                </ButtonLink>
              </span>
              <form action={archiveItemAction}>
                <input type="hidden" name="id" value={i.id} />
                <SubmitButton variant="danger" className="w-full" pendingLabel="Archivage…" confirm="Retirer cet article du catalogue ? Les devis et factures déjà faits ne changent pas.">
                  <Icon name="archive" /> Retirer du catalogue
                </SubmitButton>
              </form>
            </div>
          )}
        </div>

        <div className="lg:-mt-6">
          <SectionTitle>Historique des prix</SectionTitle>
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {history.map((h, idx) => {
              const prev = history[idx + 1];
              const up = prev && showPurchase && h.purchasePriceCents !== null && prev.purchasePriceCents !== null ? h.purchasePriceCents - prev.purchasePriceCents : null;
              return (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{SOURCE_LABEL[h.source] ?? h.source}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDateTime(h.at, session.orgTimezone)}
                      {h.by ? `, ${h.by}` : ""}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-bold">Vente {euros(h.salePriceCents)}</span>
                    {showPurchase && (
                      <span className={cx("block", up && up > 0 ? "text-red-700" : up && up < 0 ? "text-emerald-700" : "text-slate-500")}>
                        Achat {euros(h.purchasePriceCents)}
                        {up ? ` (${up > 0 ? "+" : ""}${euros(up)})` : ""}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
}
