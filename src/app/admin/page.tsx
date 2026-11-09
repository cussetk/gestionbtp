import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/session";
import { adminStats, listOrganizations, type OrgStatus } from "@/server/admin";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/text";
import { EmptyState, Icon, cx } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Entreprises" };

const TABS: { key: OrgStatus | "toutes"; label: string }[] = [
  { key: "en_attente", label: "À valider" },
  { key: "active", label: "Actives" },
  { key: "suspendue", label: "Suspendues" },
  { key: "toutes", label: "Toutes" },
];

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const session = await requirePlatformAdmin();
  const ctx = { userId: session.userId, isPlatformAdmin: session.isPlatformAdmin };
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = first(sp.q)?.trim() ?? "";
  const stats = await adminStats(ctx);
  const defaultTab = stats.enAttente > 0 ? "en_attente" : "toutes";
  const tab = (TABS.find((t) => t.key === first(sp.statut))?.key ?? defaultTab) as OrgStatus | "toutes";
  const orgs = await listOrganizations(ctx, { status: tab === "toutes" ? undefined : tab, q });

  const counters = [
    { label: "À valider", value: stats.enAttente, tone: stats.enAttente > 0 ? "text-amber-700" : "text-slate-900" },
    { label: "Actives", value: stats.actives, tone: "text-emerald-700" },
    { label: "Suspendues", value: stats.suspendues, tone: "text-slate-900" },
    { label: "Utilisateurs", value: stats.utilisateurs, tone: "text-slate-900" },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counters.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
            <p className={cx("text-2xl font-bold tabular-nums", c.tone)}>{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <nav className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?statut=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cx(
              "flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold",
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Form action="/admin" className="relative mb-4">
        <input type="hidden" name="statut" value={tab} />
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input type="search" name="q" defaultValue={q} placeholder="Entreprise, SIRET, e-mail, nom…" aria-label="Rechercher" className="input pl-11" />
      </Form>

      {orgs.length === 0 ? (
        <EmptyState title={tab === "en_attente" ? "Aucun espace à valider" : "Aucune entreprise"} />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/${o.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.name}</span>
                    <StatusBadge status={o.status} />
                  </span>
                  <span className="block truncate text-sm text-slate-600">
                    {o.ownerName ?? "—"} · {o.ownerEmail ?? "—"}
                    {o.ownerPhone ? ` · ${formatPhone(o.ownerPhone)}` : ""}
                  </span>
                  <span className="block text-xs text-slate-400">
                    Créé le {formatDate(o.createdAt)} · {o.memberCount} compte(s) · {o.clientCount} client(s) · formule {o.plan}
                  </span>
                </span>
                <Icon name="chevron" className="size-5 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
