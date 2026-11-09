import type { Metadata } from "next";
import { requirePermission, toCtx } from "@/lib/session";
import { loadOr404 } from "@/lib/page-helpers";
import { getSupplier } from "@/server/suppliers";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/supplier-form";

export const metadata: Metadata = { title: "Modifier le fournisseur" };

export default async function EditSupplierPage({ params }: PageProps<"/fournisseurs/[id]/modifier">) {
  const session = await requirePermission("achats.gerer");
  const { id } = await params;
  const { supplier: s } = await loadOr404(id, () => getSupplier(toCtx(session), id));
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Modifier le fournisseur" subtitle={s.name} back={`/fournisseurs/${s.id}`} />
      <SupplierForm
        mode="update"
        initial={{
          id: s.id,
          name: s.name,
          contactName: s.contactName,
          email: s.email,
          phone: s.phone,
          website: s.website,
          addressLine1: s.addressLine1,
          addressLine2: s.addressLine2,
          postalCode: s.postalCode,
          city: s.city,
          siret: s.siret,
          vatNumber: s.vatNumber,
          customerAccount: s.customerAccount,
          paymentTermsDays: s.paymentTermsDays?.toString(),
          notes: s.notes,
        }}
      />
    </div>
  );
}
