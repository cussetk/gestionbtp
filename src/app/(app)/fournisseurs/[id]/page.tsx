import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { loadOr404 } from "@/lib/page-helpers";
import { formatPhone, whatsappLink } from "@/lib/text";
import { getSupplier } from "@/server/suppliers";
import { ActionRow, ButtonLink, Card, Icon, PageHeader, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ImportList } from "@/components/catalog-ui";
import { archiveSupplierAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/fournisseurs/[id]">): Promise<Metadata> {
  const session = await requirePermission("achats.gerer");
  const { id } = await params;
  const { supplier } = await loadOr404(id, () => getSupplier(toCtx(session), id));
  return { title: supplier.name };
}

export default async function SupplierPage({ params }: PageProps<"/fournisseurs/[id]">) {
  const session = await requirePermission("achats.gerer");
  const { id } = await params;
  const { supplier: s, itemCount, imports } = await loadOr404(id, () => getSupplier(toCtx(session), id));
  const canImport = can(session, "catalogue.modifier") && can(session, "prix.achat");
  const address = [s.addressLine1, s.addressLine2, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const wa = whatsappLink(s.phone);
  const website = s.website ? (s.website.startsWith("http") ? s.website : `https://${s.website}`) : null;

  return (
    <>
      <PageHeader
        back="/fournisseurs"
        title={s.name}
        subtitle={s.contactName ? `Contact : ${s.contactName}` : "Fournisseur"}
        action={
          <Link href={`/fournisseurs/${s.id}/modifier`} aria-label="Modifier le fournisseur" className="grid size-11 shrink-0 place-items-center rounded-full text-brand-700 active:bg-brand-50 lg:hidden">
            <Icon name="edit" />
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div>
          <Card className="space-y-1">
            {s.phone && (
              <ActionRow href={`tel:${s.phone}`} icon="phone" hint="Appeler">
                {formatPhone(s.phone)}
              </ActionRow>
            )}
            {wa && (
              <ActionRow href={wa} icon="whatsapp" hint="WhatsApp" external>
                Écrire sur WhatsApp
              </ActionRow>
            )}
            {s.email && (
              <ActionRow href={`mailto:${s.email}`} icon="mail" hint="E-mail de commande">
                {s.email}
              </ActionRow>
            )}
            {website && (
              <ActionRow href={website} icon="globe" hint="Site internet" external>
                {s.website}
              </ActionRow>
            )}
            {!s.phone && !s.email && !website && <p className="text-sm text-slate-500">Aucune coordonnée.</p>}
          </Card>

          <Card className="mt-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              {address && (
                <>
                  <dt className="text-slate-500">Adresse</dt>
                  <dd>{address}</dd>
                </>
              )}
              <dt className="text-slate-500">N° de compte</dt>
              <dd>{s.customerAccount ?? <span className="text-slate-400">—</span>}</dd>
              <dt className="text-slate-500">Paiement</dt>
              <dd>{s.paymentTermsDays != null ? `${s.paymentTermsDays} jours` : <span className="text-slate-400">—</span>}</dd>
              {s.siret && (
                <>
                  <dt className="text-slate-500">SIRET</dt>
                  <dd className="tabular-nums">{s.siret}</dd>
                </>
              )}
              {s.vatNumber && (
                <>
                  <dt className="text-slate-500">N° de TVA</dt>
                  <dd>{s.vatNumber}</dd>
                </>
              )}
            </dl>
          </Card>

          {s.notes && (
            <Card className="mt-3">
              <p className="mb-1 text-sm font-bold text-slate-500">Notes internes</p>
              <p className="whitespace-pre-wrap text-sm">{s.notes}</p>
            </Card>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <span className="hidden lg:contents">
              <ButtonLink href={`/fournisseurs/${s.id}/modifier`} variant="secondary">
                <Icon name="edit" /> Modifier le fournisseur
              </ButtonLink>
            </span>
            <form action={archiveSupplierAction}>
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton variant="danger" className="w-full" pendingLabel="Archivage…" confirm={`Archiver ${s.name} ? Ses articles restent dans le catalogue.`}>
                <Icon name="archive" /> Archiver le fournisseur
              </SubmitButton>
            </form>
          </div>
        </div>

        <div className="lg:-mt-6">
          <SectionTitle>Catalogue</SectionTitle>
          <Card>
            <p className="text-[15px]">
              <span className="text-2xl font-bold tabular-nums">{itemCount}</span> article{itemCount > 1 ? "s" : ""} de ce fournisseur dans votre catalogue.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {can(session, "catalogue.voir") && (
                <ButtonLink href={`/catalogue?fournisseur=${s.id}`} variant="secondary">
                  <Icon name="tag" /> Voir ses articles
                </ButtonLink>
              )}
              {canImport && (
                <ButtonLink href={`/catalogue/importer?fournisseur=${s.id}`}>
                  <Icon name="upload" /> Importer sa grille de prix
                </ButtonLink>
              )}
            </div>
          </Card>

          {canImport && imports.length > 0 && (
            <>
              <SectionTitle>Derniers imports de grille</SectionTitle>
              <ImportList items={imports} timezone={session.orgTimezone} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
