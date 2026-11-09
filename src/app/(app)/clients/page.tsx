import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { countClients, listClients } from "@/server/clients";
import { formatPhone } from "@/lib/text";
import { EmptyState, Fab, Icon, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const session = await requirePermission("clients.voir");
  const ctx = toCtx(session);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const [items, total] = await Promise.all([listClients(ctx, { q, limit: 200 }), countClients(ctx)]);
  const canCreate = can(session, "clients.modifier");

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={q ? `${items.length} résultat(s) pour « ${q} »` : total === 0 ? "Aucun client" : `${total} client${total > 1 ? "s" : ""}`}
        primary={canCreate ? { href: "/clients/nouveau", label: "Nouveau client" } : undefined}
      />

      {/* Sur ordinateur, la recherche est dans la barre du haut. */}
      <Form action="/clients" className="relative mb-4 lg:hidden">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nom, téléphone, ville, adresse…"
          aria-label="Rechercher un client"
          className="input pl-11"
          enterKeyHint="search"
        />
      </Form>
      {q && (
        <Link href="/clients" className="mb-4 hidden text-sm font-bold text-brand-700 underline lg:inline-block">
          Effacer la recherche
        </Link>
      )}

      {items.length === 0 ? (
        q ? (
          <EmptyState title={`Aucun client ne correspond à « ${q} »`}>Essayez un nom, un numéro ou une ville.</EmptyState>
        ) : (
          <EmptyState title="Pas encore de client">
            {canCreate ? "Ajoutez votre premier client pour y rattacher ses adresses d'intervention." : "Les clients ajoutés par votre équipe apparaîtront ici."}
          </EmptyState>
        )
      ) : (
        <>
          {/* Téléphone : liste tactile */}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:hidden">
            {items.map((c) => (
              <li key={c.id} className="flex items-center">
                <Link href={`/clients/${c.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-slate-50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <Icon name={c.type === "professionnel" ? "building" : "user"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{c.displayName}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {[c.city, c.siteCount > 1 ? `${c.siteCount} sites` : null].filter(Boolean).join(", ") || "Sans adresse"}
                    </span>
                  </span>
                </Link>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    aria-label={`Appeler ${c.displayName} au ${formatPhone(c.phone)}`}
                    className="mr-2 grid size-12 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50"
                  >
                    <Icon name="phone" />
                  </a>
                )}
              </li>
            ))}
          </ul>

          {/* Ordinateur : tableau */}
          <div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold">Client</th>
                  <th scope="col" className="px-5 py-3 font-bold">Type</th>
                  <th scope="col" className="px-5 py-3 font-bold">Téléphone</th>
                  <th scope="col" className="px-5 py-3 font-bold">Ville</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Sites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.id} className="group hover:bg-brand-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="font-bold text-ink group-hover:text-brand-700">
                        {c.displayName}
                      </Link>
                      {c.type === "professionnel" && (c.firstName || c.lastName) && (
                        <span className="block text-sm text-slate-500">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.type === "professionnel" ? "Professionnel" : "Particulier"}</td>
                    <td className="px-5 py-3">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="text-slate-700 hover:text-brand-700 hover:underline">
                          {formatPhone(c.phone)}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.city ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{c.siteCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {canCreate && <Fab href="/clients/nouveau" label="Client" />}
    </>
  );
}
