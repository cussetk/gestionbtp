import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Icon, PageHeader, cx, type IconName } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Plus" };

type Entry = { href: string; label: string; hint: string; icon: IconName; ready: boolean; show: boolean };

export default async function MorePage() {
  const session = await requireActiveSession();
  const entries: Entry[] = [
    { href: "/catalogue", label: "Catalogue", hint: "Produits, main-d'œuvre, prestations et prix", icon: "tag", ready: true, show: can(session, "catalogue.voir") },
    { href: "/fournisseurs", label: "Fournisseurs", hint: "Coordonnées et grilles de prix", icon: "truck", ready: true, show: can(session, "achats.gerer") },
    { href: "/equipe", label: "Mon équipe", hint: "Sous-comptes et autorisations", icon: "badge", ready: true, show: can(session, "equipe.gerer") },
    { href: "/admin", label: "Espace gestionnaire", hint: "Valider et gérer les comptes", icon: "shield", ready: true, show: session.isPlatformAdmin },
    { href: "/reglages", label: "Réglages de l'entreprise", hint: "TVA, numérotation, mise en page des documents", icon: "settings", ready: true, show: can(session, "reglages.gerer") },
    { href: "#", label: "Fluides frigorigènes", hint: "Registre et bouteilles", icon: "drop", ready: false, show: true },
  ];
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Plus" subtitle={session.orgName} />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        {entries
          .filter((e) => e.show)
          .map((e) => {
            const inner = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name={e.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{e.label}</span>
                  <span className="block text-sm text-slate-500">{e.ready ? e.hint : `${e.hint} · bientôt`}</span>
                </span>
                {e.ready && <Icon name="chevron" className="size-5 text-slate-400" />}
              </>
            );
            return (
              <li key={e.label}>
                {e.ready ? (
                  <Link href={e.href} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-slate-50">
                    {inner}
                  </Link>
                ) : (
                  <div className={cx("flex min-h-16 items-center gap-3 px-4 py-3 opacity-50")}>{inner}</div>
                )}
              </li>
            );
          })}
      </ul>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-brand-700 px-4 py-2 text-white">
        <span className="text-sm">Se déconnecter</span>
        <SignOutButton />
      </div>
    </div>
  );
}
