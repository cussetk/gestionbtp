import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { ITEM_KINDS, euros, formatCoef, unitShort, type ItemKind } from "@/lib/catalog";
import { formatRate } from "@/lib/tax";
import { catalogStats, listItems } from "@/server/catalog";
import { supplierOptions } from "@/server/suppliers";
import { ButtonLink, EmptyState, Fab, Icon, PageHeader, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Catalogue" };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function CatalogPage({ searchParams }: PageProps<"/catalogue">) {
  const session = await requirePermission("catalogue.voir");
  const ctx = toCtx(session);
  const sp = await searchParams;
  const q = one(sp.q);
  const kindParam = one(sp.nature);
  const kind = ITEM_KINDS.some((k) => k.key === kindParam) ? (kindParam as ItemKind) : undefined;
  const category = one(sp.famille) || undefined;
  const showPurchase = can(session, "prix.achat");
  const supplierId = showPurchase ? one(sp.fournisseur) || undefined : undefined;

  const [items, stats, suppliers] = await Promise.all([
    listItems(ctx, { q, kind, category, supplierId, limit: 300 }),
    catalogStats(ctx),
    showPurchase ? supplierOptions(ctx) : Promise.resolve([]),
  ]);
  const supplierName = supplierId ? suppliers.find((s) => s.id === supplierId)?.name : undefined;
  const canCreate = can(session, "catalogue.modifier");
  const canImport = canCreate && showPurchase;
  const filtered = Boolean(q || kind || category || supplierId);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, nature: kind, famille: category, fournisseur: supplierId, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/catalogue?${s}` : "/catalogue";
  };

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle={stats.total === 0 ? "Aucun article" : `${stats.total} article${stats.total > 1 ? "s" : ""}`}
        action={
          canImport && (
            <span className="hidden lg:block">
              <ButtonLink href="/catalogue/importer" variant="secondary">
                <Icon name="upload" /> Importer une grille
              </ButtonLink>
            </span>
          )
        }
        primary={canCreate ? { href: "/catalogue/nouveau", label: "Nouvel article" } : undefined}
      />

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Form action="/catalogue" className="relative lg:w-96">
          {kind && <input type="hidden" name="nature" value={kind} />}
          {category && <input type="hidden" name="famille" value={category} />}
          {supplierId && <input type="hidden" name="fournisseur" value={supplierId} />}
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input type="search" name="q" defaultValue={q} placeholder="Désignation, marque, référence…" aria-label="Rechercher un article" className="input pl-11" enterKeyHint="search" />
        </Form>
        {stats.categories.length > 0 && (
          <Form action="/catalogue" className="flex gap-2 lg:w-72">
            {q && <input type="hidden" name="q" value={q} />}
            {kind && <input type="hidden" name="nature" value={kind} />}
            {supplierId && <input type="hidden" name="fournisseur" value={supplierId} />}
            <select name="famille" defaultValue={category ?? ""} aria-label="Famille" className="input">
              <option value="">Toutes les familles</option>
              {stats.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl px-3 font-bold text-brand-700 ring-1 ring-slate-300">
              OK
            </button>
          </Form>
        )}
      </div>

      <nav aria-label="Nature des articles" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {[{ key: undefined, label: "Tout", n: stats.total }, ...ITEM_KINDS.map((k) => ({ key: k.key as string | undefined, label: k.plural, n: stats.byKind[k.key] ?? 0 }))].map((t) => (
          <Link
            key={t.label}
            href={href({ nature: t.key })}
            aria-current={kind === t.key ? "page" : undefined}
            className={cx(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold",
              kind === t.key ? "bg-glacier-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {t.label} <span className={cx("tabular-nums", kind === t.key ? "text-glacier-300" : "text-slate-400")}>{t.n}</span>
          </Link>
        ))}
        {supplierName && (
          <Link href={href({ fournisseur: undefined })} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-800 ring-1 ring-brand-200">
            {supplierName} <span aria-hidden>✕</span>
            <span className="sr-only">Retirer le filtre fournisseur</span>
          </Link>
        )}
        {category && (
          <Link href={href({ famille: undefined })} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-800 ring-1 ring-brand-200">
            {category} <span aria-hidden>✕</span>
            <span className="sr-only">Retirer le filtre famille</span>
          </Link>
        )}
      </nav>

      {items.length === 0 ? (
        filtered ? (
          <EmptyState title="Aucun article ne correspond">
            <Link href="/catalogue" className="font-bold text-brand-700 underline">
              Voir tout le catalogue
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="Votre catalogue est vide">
            {canCreate ? (
              <>
                Ajoutez vos climatiseurs, fournitures, taux horaires et forfaits.
                {canImport && (
                  <>
                    {" "}
                    Le plus rapide :{" "}
                    <Link href="/catalogue/importer" className="font-bold text-brand-700 underline">
                      importer la grille de prix d&apos;un fournisseur
                    </Link>
                    .
                  </>
                )}
              </>
            ) : (
              "Les articles ajoutés par votre entreprise apparaîtront ici."
            )}
          </EmptyState>
        )
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:hidden">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/catalogue/${i.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{i.name}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {[i.brand, i.reference ?? i.supplierRef, i.category].filter(Boolean).join(", ") || ITEM_KINDS.find((k) => k.key === i.kind)?.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums">{euros(i.salePriceCents)}</span>
                    <span className="block text-xs text-slate-500">HT / {unitShort(i.unit)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold">Désignation</th>
                  <th scope="col" className="px-5 py-3 font-bold">Famille</th>
                  {showPurchase && <th scope="col" className="px-5 py-3 font-bold">Fournisseur</th>}
                  {showPurchase && <th scope="col" className="px-5 py-3 text-right font-bold">Achat HT</th>}
                  {showPurchase && <th scope="col" className="px-5 py-3 text-right font-bold">Coef.</th>}
                  <th scope="col" className="px-5 py-3 text-right font-bold">Vente HT</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">TVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((i) => (
                  <tr key={i.id} className="group hover:bg-brand-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/catalogue/${i.id}`} className="font-bold text-ink group-hover:text-brand-700">
                        {i.name}
                      </Link>
                      <span className="block text-sm text-slate-500">
                        {[i.brand, i.reference && `Réf. ${i.reference}`, i.supplierRef && `Réf. fournisseur ${i.supplierRef}`].filter(Boolean).join(", ") ||
                          ITEM_KINDS.find((k) => k.key === i.kind)?.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{i.category ?? <span className="text-slate-400">—</span>}</td>
                    {showPurchase && <td className="px-5 py-3 text-slate-600">{i.supplierName ?? <span className="text-slate-400">—</span>}</td>}
                    {showPurchase && <td className="px-5 py-3 text-right tabular-nums text-slate-600">{euros(i.purchasePriceCents)}</td>}
                    {showPurchase && (
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                        {i.pricingMode === "coef" ? `× ${formatCoef(i.coefX1000)}` : <span className="text-slate-400">fixe</span>}
                      </td>
                    )}
                    <td className="px-5 py-3 text-right font-bold tabular-nums">
                      {euros(i.salePriceCents)}
                      <span className="block text-xs font-normal text-slate-500">/ {unitShort(i.unit)}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{i.taxRateBp != null ? formatRate(i.taxRateBp) : <span className="text-slate-400">défaut</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length >= 300 && <p className="mt-3 text-sm text-slate-500">Seuls les 300 premiers articles sont affichés : affinez la recherche.</p>}
        </>
      )}

      {canImport && (
        <div className="mt-4 lg:hidden">
          <ButtonLink href="/catalogue/importer" variant="secondary" className="w-full">
            <Icon name="upload" /> Importer une grille fournisseur
          </ButtonLink>
        </div>
      )}
      {canCreate && <Fab href="/catalogue/nouveau" label="Article" />}
    </>
  );
}
