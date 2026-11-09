import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { SitePositionButton } from "@/components/site-position-button";
import { getSite } from "@/server/clients";
import { loadOr404, mapsUrl, wazeUrl } from "@/lib/page-helpers";
import { formatPhone } from "@/lib/text";
import { ActionRow, ButtonLink, Card, Icon, PageHeader, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { archiveSiteAction } from "@/app/(app)/clients/actions";

export async function generateMetadata({ params }: PageProps<"/sites/[id]">): Promise<Metadata> {
  const session = await requirePermission("clients.voir");
  const { id } = await params;
  const { site } = await loadOr404(id, () => getSite(toCtx(session), id));
  return { title: site.label };
}

export default async function SitePage({ params }: PageProps<"/sites/[id]">) {
  const session = await requirePermission("clients.voir");
  const { id } = await params;
  const { site, client } = await loadOr404(id, () => getSite(toCtx(session), id));
  const canEdit = can(session, "clients.modifier");
  const canArchive = can(session, "clients.archiver");
  const sourceLabel =
    site.geoSource === "gps"
      ? `relevée sur place${site.geoAccuracyM != null ? ` (± ${site.geoAccuracyM} m)` : ""}`
      : site.geoSource === "adresse"
        ? "calculée depuis l'adresse"
        : "saisie à la main";
  const address = [site.addressLine1, site.addressLine2, `${site.postalCode} ${site.city}`].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        back={`/clients/${client.id}`}
        title={site.label}
        subtitle={
          <Link href={`/clients/${client.id}`} className="underline">
            {client.displayName}
          </Link>
        }
        action={
          canEdit && <Link
            href={`/sites/${site.id}/modifier`}
            aria-label="Modifier le site"
            className="grid size-11 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50"
          >
            <Icon name="edit" />
          </Link>
        }
      />

      <Card className="space-y-1">
        <ActionRow href={mapsUrl(site)} icon="pin" hint="Itinéraire (Google Maps)" external>
          {address}
        </ActionRow>
        <a
          href={wazeUrl(site)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-[3.25rem] inline-flex min-h-10 items-center text-sm font-semibold text-brand-700"
        >
          Ouvrir dans Waze
        </a>
      </Card>

      <Card className="mt-3 space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="locate" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Position GPS</p>
            {site.latitude != null && site.longitude != null ? (
              <p className="text-slate-600">
                {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {sourceLabel}
              </p>
            ) : (
              <p className="text-slate-600">Aucune position : l&apos;itinéraire utilise l&apos;adresse.</p>
            )}
          </div>
        </div>
        {canEdit && <SitePositionButton siteId={site.id} hasPosition={site.latitude != null} />}
      </Card>

      {site.accessNotes && (
        <Card className="mt-3 border-l-4 border-amber-400">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <Icon name="key" className="size-4" /> Accès
          </p>
          <p className="whitespace-pre-wrap text-sm">{site.accessNotes}</p>
        </Card>
      )}

      {(site.contactName || site.contactPhone) && (
        <Card className="mt-3">
          <p className="mb-1 text-sm text-slate-500">Contact sur place{site.contactName ? ` : ${site.contactName}` : ""}</p>
          {site.contactPhone && (
            <ActionRow href={`tel:${site.contactPhone}`} icon="phone" hint="Appeler">
              {formatPhone(site.contactPhone)}
            </ActionRow>
          )}
        </Card>
      )}

      {site.notes && (
        <Card className="mt-3">
          <p className="whitespace-pre-wrap text-sm">{site.notes}</p>
        </Card>
      )}

      <SectionTitle>Équipements</SectionTitle>
      <Card className="text-sm text-slate-500">Le parc d&apos;équipements de ce site arrive avec le module 2.</Card>

      <div className="mt-8 flex flex-col gap-2">
        {canEdit && <ButtonLink href={`/sites/${site.id}/modifier`} variant="secondary">
          Modifier le site
        </ButtonLink>}
        {canArchive && <form action={archiveSiteAction}>
          <input type="hidden" name="id" value={site.id} />
          <SubmitButton variant="danger" className="w-full" pendingLabel="Archivage…" confirm={`Archiver le site « ${site.label} » ?`}>
            <Icon name="archive" /> Archiver le site
          </SubmitButton>
        </form>}
      </div>
    </>
  );
}
