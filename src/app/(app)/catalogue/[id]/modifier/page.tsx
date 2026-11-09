import type { Metadata } from "next";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { loadOr404 } from "@/lib/page-helpers";
import { centsToInput, formatCoef } from "@/lib/catalog";
import { getItem, itemFormOptions } from "@/server/catalog";
import { PageHeader } from "@/components/ui";
import { ItemForm } from "@/components/item-form";

export const metadata: Metadata = { title: "Modifier l'article" };

export default async function EditItemPage({ params }: PageProps<"/catalogue/[id]/modifier">) {
  const session = await requirePermission("catalogue.modifier");
  const ctx = toCtx(session);
  const { id } = await params;
  const [{ item: i }, options] = await Promise.all([loadOr404(id, () => getItem(ctx, id)), itemFormOptions(ctx)]);
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Modifier l'article" subtitle={i.name} back={`/catalogue/${i.id}`} />
      <ItemForm
        mode="update"
        showPurchase={can(session, "prix.achat")}
        options={options}
        initial={{
          id: i.id,
          kind: i.kind,
          reference: i.reference,
          name: i.name,
          description: i.description,
          brand: i.brand,
          category: i.category,
          unit: i.unit,
          purchasePrice: centsToInput(i.purchasePriceCents),
          pricingMode: i.pricingMode,
          coef: i.coefX1000 ? formatCoef(i.coefX1000) : undefined,
          salePrice: centsToInput(i.salePriceCents),
          taxRateId: i.taxRateId ?? "",
          supplierId: i.supplierId ?? "",
          supplierRef: i.supplierRef,
          trackStock: i.trackStock ? "on" : "",
          trackSerial: i.trackSerial ? "on" : "",
          notes: i.notes,
        }}
      />
    </div>
  );
}
