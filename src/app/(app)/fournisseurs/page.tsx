import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { listSuppliers } from "@/server/suppliers";
import { formatPhone } from "@/lib/text";
import { EmptyState, Fab, Icon, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function SuppliersPage({ searchParams }: PageProps<"/fournisseurs">) {
  const session = await requirePermission("achats.gerer");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const items = await listSuppliers(toCtx(session), { q });

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        subtitle={q ? `${items.length} résultat(s) pour « ${q} »` : items.length === 0 ? "Aucun fournisseur" : `${items.length} fournisseur${items.length > 1 ? "s" : ""}`}
        primary={{ href: "/fournisseurs/nouveau", label: "Nouveau fournisseur" }}
      />

      <Form action="/fournisseurs" className="relative mb-4 lg:max-w-md">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input type="search" name="q" defaultValue={q} placeholder="Nom, ville, n° de compte…" aria-label="Rechercher un fournisseur" className="input pl-11" enterKeyHint="search" />
      </Form>

      {items.length === 0 ? (
        q ? (
          <EmptyState title={`Aucun fournisseur ne correspond à « ${q} »`} />
        ) : (
          <EmptyState title="Pas encore de fournisseur">
            Ajoutez vos distributeurs (climatisation, électricité, quincaillerie) pour importer leurs grilles de prix et préparer vos commandes.
          </EmptyState>
        )
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:hidden">
            {items.map((s) => (
              <li key={s.id} className="flex items-center">
                <Link href={`/fournisseurs/${s.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-slate-50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <Icon name="truck" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.name}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {[s.city, `${s.itemCount} article${s.itemCount > 1 ? "s" : ""}`].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </Link>
                {s.phone && (
                  <a href={`tel:${s.phone}`} aria-label={`Appeler ${s.name}`} className="mr-2 grid size-12 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50">
                    <Icon name="phone" />
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold">Fournisseur</th>
                  <th scope="col" className="px-5 py-3 font-bold">Interlocuteur</th>
                  <th scope="col" className="px-5 py-3 font-bold">Téléphone</th>
                  <th scope="col" className="px-5 py-3 font-bold">Ville</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Articles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="group hover:bg-brand-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/fournisseurs/${s.id}`} className="font-bold text-ink group-hover:text-brand-700">{s.name}</Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.contactName ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3">
                      {s.phone ? <a href={`tel:${s.phone}`} className="text-slate-700 hover:text-brand-700 hover:underline">{formatPhone(s.phone)}</a> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.city ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{s.itemCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Fab href="/fournisseurs/nouveau" label="Fournisseur" />
    </>
  );
}
