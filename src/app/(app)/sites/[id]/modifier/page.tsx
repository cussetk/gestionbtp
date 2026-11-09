import type { Metadata } from "next";
import { requirePermission, toCtx } from "@/lib/session";
import { getSite } from "@/server/clients";
import { loadOr404 } from "@/lib/page-helpers";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/site-form";

export const metadata: Metadata = { title: "Modifier le site" };

export default async function EditSitePage({ params }: PageProps<"/sites/[id]/modifier">) {
  const session = await requirePermission("clients.modifier");
  const { id } = await params;
  const { site, client } = await loadOr404(id, () => getSite(toCtx(session), id));
  return (
    <>
      <PageHeader title="Modifier le site" subtitle={client.displayName} back={`/sites/${site.id}`} />
      <SiteForm
        mode="update"
        initial={{
          id: site.id,
          clientId: site.clientId,
          label: site.label,
          addressLine1: site.addressLine1,
          addressLine2: site.addressLine2,
          postalCode: site.postalCode,
          city: site.city,
          latitude: site.latitude,
          longitude: site.longitude,
          geoSource: site.geoSource,
          geoAccuracyM: site.geoAccuracyM,
          accessNotes: site.accessNotes,
          contactName: site.contactName,
          contactPhone: site.contactPhone,
          notes: site.notes,
        }}
      />
    </>
  );
}
