import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { getClient } from "@/server/clients";
import { loadOr404 } from "@/lib/page-helpers";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/site-form";

export const metadata: Metadata = { title: "Nouveau site" };

export default async function NewSitePage({ params }: PageProps<"/clients/[id]/sites/nouveau">) {
  const session = await requireSession();
  const { id } = await params;
  const { client, sites } = await loadOr404(id, () => getClient(session, id));
  // Premier site : on propose l'adresse de facturation.
  const prefill =
    sites.length === 0 && client.addressLine1
      ? { addressLine1: client.addressLine1, addressLine2: client.addressLine2, postalCode: client.postalCode, city: client.city }
      : {};
  return (
    <>
      <PageHeader title="Nouveau site" subtitle={client.displayName} back={`/clients/${client.id}`} />
      <SiteForm mode="create" initial={{ id: crypto.randomUUID(), clientId: client.id, ...prefill }} />
    </>
  );
}
