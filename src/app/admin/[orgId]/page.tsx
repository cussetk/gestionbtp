import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/session";
import { getOrganizationForAdmin } from "@/server/admin";
import { loadOr404 } from "@/lib/page-helpers";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/text";
import { ActionRow, Card, PageHeader, SectionTitle } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { NoteForm, PlanForm, StatusActions } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Entreprise" };

const ZONES: Record<string, string> = {
  "Europe/Paris": "Métropole",
  "America/Guadeloupe": "Guadeloupe",
  "America/Martinique": "Martinique",
  "America/Cayenne": "Guyane",
  "Indian/Reunion": "La Réunion",
  "Indian/Mayotte": "Mayotte",
};

export default async function AdminOrgPage({ params }: PageProps<"/admin/[orgId]">) {
  const session = await requirePlatformAdmin();
  const { orgId } = await params;
  const { org, members, events } = await loadOr404(orgId, () =>
    getOrganizationForAdmin({ userId: session.userId, isPlatformAdmin: session.isPlatformAdmin }, orgId),
  );
  const owner = members.find((m) => m.role === "proprietaire");

  return (
    <>
      <PageHeader title={org.name} subtitle={<StatusBadge status={org.status} />} back="/admin" />

      <Card className="space-y-1">
        <p className="text-sm text-slate-600">
          Créé le {formatDate(org.createdAt)} · {ZONES[org.timezone] ?? org.timezone} · {org.clientCount} client(s)
          {org.siret ? ` · SIRET ${org.siret}` : ""}
        </p>
        {org.statusReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Motif de suspension : {org.statusReason}</p>}
        {owner && (
          <>
            <p className="pt-2 text-sm font-medium">Propriétaire : {owner.fullName}</p>
            <ActionRow href={`mailto:${owner.email}`} icon="mail" hint="Écrire">
              {owner.email}
            </ActionRow>
            {owner.phone && (
              <>
                <ActionRow href={`tel:${owner.phone}`} icon="phone" hint="Appeler">
                  {formatPhone(owner.phone)}
                </ActionRow>
                {whatsappLink(owner.phone) && (
                  <ActionRow href={whatsappLink(owner.phone)!} icon="whatsapp" hint="WhatsApp" external>
                    Écrire sur WhatsApp
                  </ActionRow>
                )}
              </>
            )}
          </>
        )}
      </Card>

      <SectionTitle>Décision</SectionTitle>
      <Card>
        <StatusActions orgId={org.id} status={org.status} orgName={org.name} />
      </Card>

      <SectionTitle>Formule</SectionTitle>
      <Card>
        <PlanForm orgId={org.id} plan={org.plan} />
      </Card>

      <SectionTitle>Comptes ({members.length})</SectionTitle>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        {members.map((m) => (
          <li key={m.userId} className="px-4 py-3 text-sm">
            <p className="font-medium">
              {m.fullName} <span className="font-normal text-slate-500">· {m.role === "proprietaire" ? "Propriétaire" : (m.title ?? "Membre")}</span>
              {!m.active && <span className="text-red-600"> · désactivé</span>}
            </p>
            <p className="text-slate-500">
              {m.email} · dernière connexion {formatDateTime(m.lastLoginAt)}
            </p>
          </li>
        ))}
      </ul>

      <SectionTitle>Journal et notes</SectionTitle>
      <Card className="space-y-3">
        <NoteForm orgId={org.id} />
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun évènement.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                <p>
                  <span className="font-bold capitalize">{ev.action}</span>
                  {ev.detail && <span className="text-slate-700"> — {ev.detail}</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(ev.createdAt)} · {ev.adminName ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 px-1 text-xs text-slate-400">
        Par respect du RGPD, l&apos;espace gestionnaire ne montre pas les données métier des clients (fiches, devis, factures).
      </p>
    </>
  );
}
