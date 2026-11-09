import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/supplier-form";

export const metadata: Metadata = { title: "Nouveau fournisseur" };

export default async function NewSupplierPage() {
  await requirePermission("achats.gerer");
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Nouveau fournisseur" back="/fournisseurs" />
      <SupplierForm mode="create" initial={{ id: crypto.randomUUID() }} />
    </div>
  );
}
