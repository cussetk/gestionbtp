import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getClient } from "@/server/clients";
import { loadOr404, mapsUrl } from "@/lib/page-helpers";
import { formatPhone } from "@/lib/text";
import { ActionRow, ButtonLink, Card, EmptyState, Icon, PageHeader, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { archiveClientAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const { client } = await loadOr404(id, () => getClient(session, id));
  return { title: client.displayName };
}

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const { client, sites } = await loadOr404(id, () => getClient(session, id));
  const billing = [client.addressLine1, client.addressLine2, [client.postalCode, client.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const contact = client.type === "professionnel" ? [client.firstName, client.lastName].filter(Boolean).join(" ") : null;

  return (
    <>
      <PageHeader
        back="/clients"
        title={client.displayName}
        subtitle={client.type === "professionnel" ? `Professionnel${client.siret ? ` · SIRET ${client.siret}` : ""}` : "Particulier"}
        action={
          <Link
            href={`/clients/${client.id}/modifier`}
            aria-label="Modifier le client"
            className="grid size-11 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50"
          >
            <Icon name="edit" />
          </Link>
        }
      />

      <Card className="space-y-1">
        {contact && <p className="pb-1 text-sm text-slate-500">Contact : {contact}</p>}
        {client.phone && (
          <ActionRow href={`tel:${client.phone}`} icon="phone" hint="Appeler">
            {formatPhone(client.phone)}
          </ActionRow>
        )}
        {client.phone2 && (
          <ActionRow href={`tel:${client.phone2}`} icon="phone" hint="Autre numéro">
            {formatPhone(client.phone2)}
          </ActionRow>
        )}
        {client.email && (
          <ActionRow href={`mailto:${client.email}`} icon="mail" hint="Écrire">
            {client.email}
          </ActionRow>
        )}
        {billing && <p className="pt-2 text-sm text-slate-600">Facturation : {billing}</p>}
        {!client.phone && !client.email && !billing && <p className="text-sm text-slate-500">Aucune coordonnée.</p>}
      </Card>

      {client.notes && (
        <Card className="mt-3">
          <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
        </Card>
      )}

      <SectionTitle
        action={
          <Link href={`/clients/${client.id}/sites/nouveau`} className="flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-brand-700">
            <Icon name="plus" className="size-4" /> Ajouter
          </Link>
        }
      >
        Sites d&apos;intervention ({sites.length})
      </SectionTitle>
      {sites.length === 0 ? (
        <EmptyState title="Aucun site">Ajoutez l&apos;adresse où se trouvent les équipements.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {sites.map((s) => (
            <li key={s.id} className="flex items-stretch overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
              <Link href={`/sites/${s.id}`} className="min-w-0 flex-1 px-4 py-3 active:bg-slate-50">
                <span className="block font-medium">{s.label}</span>
                <span className="block text-sm text-slate-500">
                  {s.addressLine1}, {s.postalCode} {s.city}
                </span>
                {s.accessNotes && <span className="mt-1 block truncate text-xs text-amber-700">Accès : {s.accessNotes}</span>}
              </Link>
              <a
                href={mapsUrl(s)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Itinéraire vers ${s.label}`}
                className="grid w-14 shrink-0 place-items-center border-l border-slate-100 text-brand-700 active:bg-brand-50"
              >
                <Icon name="pin" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Bientôt ici</SectionTitle>
      <Card className="text-sm text-slate-500">Équipements, interventions, devis et factures de ce client.</Card>

      <div className="mt-8 flex flex-col gap-2">
        <ButtonLink href={`/clients/${client.id}/modifier`} variant="secondary">
          Modifier le client
        </ButtonLink>
        <form action={archiveClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <SubmitButton
            variant="danger"
            className="w-full"
            pendingLabel="Archivage…"
            confirm={`Archiver ${client.displayName} et ses sites ? Il n'apparaîtra plus dans vos listes.`}
          >
            <Icon name="archive" /> Archiver le client
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
