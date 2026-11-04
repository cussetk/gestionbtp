import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { countClients, listClients } from "@/server/clients";
import { formatPhone } from "@/lib/text";
import { EmptyState, Fab, Icon, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const session = await requireSession();
  const ctx = { orgId: session.orgId, userId: session.userId };
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const [items, total] = await Promise.all([listClients(ctx, { q, limit: 100 }), countClients(ctx)]);

  return (
    <>
      <PageHeader title="Clients" subtitle={total === 0 ? "Aucun client" : `${total} client${total > 1 ? "s" : ""}`} />

      <Form action="/clients" className="relative mb-4">
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

      {items.length === 0 ? (
        q ? (
          <EmptyState title={`Aucun résultat pour « ${q} »`}>Essayez un nom, un numéro ou une ville.</EmptyState>
        ) : (
          <EmptyState title="Pas encore de client">Ajoutez votre premier client avec le bouton en bas.</EmptyState>
        )
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          {items.map((c) => (
            <li key={c.id} className="flex items-center">
              <Link href={`/clients/${c.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-slate-50">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                  <Icon name={c.type === "professionnel" ? "building" : "user"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.displayName}</span>
                  <span className="block truncate text-sm text-slate-500">
                    {[c.city, c.siteCount > 1 ? `${c.siteCount} sites` : null].filter(Boolean).join(" · ") || "—"}
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
      )}

      <Fab href="/clients/nouveau" label="Client" />
    </>
  );
}
