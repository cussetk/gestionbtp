import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { getClient } from "@/server/clients";
import { loadOr404 } from "@/lib/page-helpers";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/modifier">) {
  const session = await requireSession();
  const { id } = await params;
  const { client } = await loadOr404(id, () => getClient(session, id));
  return (
    <>
      <PageHeader title="Modifier le client" subtitle={client.displayName} back={`/clients/${client.id}`} />
      <ClientForm
        mode="update"
        initial={{
          id: client.id,
          type: client.type,
          companyName: client.companyName,
          firstName: client.firstName,
          lastName: client.lastName,
          siret: client.siret,
          email: client.email,
          phone: client.phone,
          phone2: client.phone2,
          addressLine1: client.addressLine1,
          addressLine2: client.addressLine2,
          postalCode: client.postalCode,
          city: client.city,
          notes: client.notes,
        }}
      />
    </>
  );
}
