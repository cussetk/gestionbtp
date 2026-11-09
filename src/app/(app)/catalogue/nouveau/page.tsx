import type { Metadata } from "next";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { itemFormOptions } from "@/server/catalog";
import { PageHeader } from "@/components/ui";
import { ItemForm } from "@/components/item-form";

export const metadata: Metadata = { title: "Nouvel article" };

export default async function NewItemPage({ searchParams }: PageProps<"/catalogue/nouveau">) {
  const session = await requirePermission("catalogue.modifier");
  const options = await itemFormOptions(toCtx(session));
  const sp = await searchParams;
  const kind = ["produit", "main_oeuvre", "prestation"].includes(String(sp.nature)) ? String(sp.nature) : "produit";
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Nouvel article" back="/catalogue" />
      <ItemForm mode="create" initial={{ id: crypto.randomUUID(), kind }} options={options} showPurchase={can(session, "prix.achat")} />
    </div>
  );
}
