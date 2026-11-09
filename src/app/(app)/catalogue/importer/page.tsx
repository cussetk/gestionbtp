import type { Metadata } from "next";
import { requirePermission, toCtx } from "@/lib/session";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { listImports } from "@/server/catalog-import";
import { itemFormOptions } from "@/server/catalog";
import { isAiEnabled } from "@/server/ai-extract";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ImportList } from "@/components/catalog-ui";
import { ImportStart } from "@/components/import/import-start";
import { DefaultCoefForm } from "@/components/import/default-coef-form";
import { LegalNote } from "@/components/settings-ui";

export const metadata: Metadata = { title: "Importer une grille de prix" };
// La lecture d'une photo ou d'un PDF par l'IA peut prendre une à deux minutes.
export const maxDuration = 300;

export default async function ImportPage({ searchParams }: PageProps<"/catalogue/importer">) {
  const session = await requirePermission("catalogue.modifier");
  const ctx = toCtx(session);
  if (!can(session, "prix.achat")) redirect("/acces-refuse?droit=prix.achat");
  const sp = await searchParams;
  const wanted = Array.isArray(sp.fournisseur) ? sp.fournisseur[0] : sp.fournisseur;
  const [options, imports] = await Promise.all([itemFormOptions(ctx), listImports(ctx, 15)]);
  const initialSupplierId = options.suppliers.some((s) => s.id === wanted) ? wanted! : null;

  return (
    <div className="lg:max-w-4xl">
      <PageHeader title="Importer une grille de prix" subtitle="Créez vos articles et mettez vos prix d'achat à jour en une fois." back="/catalogue" />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ImportStart suppliers={options.suppliers} initialSupplierId={initialSupplierId} aiEnabled={isAiEnabled()} />
        <aside className="mt-4 space-y-4 lg:mt-0">
          <DefaultCoefForm initial={options.defaultCoefX1000} />
          <LegalNote>
            Comment ça marche : 1) vous choisissez le fichier, 2) vous relisez les lignes et les variations de prix, 3) vous validez. Les articles déjà au
            catalogue sont reconnus par leur référence fournisseur.
          </LegalNote>
        </aside>
      </div>
      {imports.length > 0 && (
        <>
          <SectionTitle>Imports récents</SectionTitle>
          <ImportList items={imports} timezone={session.orgTimezone} showSupplier />
        </>
      )}
    </div>
  );
}
