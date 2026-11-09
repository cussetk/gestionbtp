import type { Metadata } from "next";
import Link from "next/link";
import { loadSettingsPage } from "@/lib/settings-page";
import { Icon, PageHeader, cx } from "@/components/ui";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsHome() {
  const { issues } = await loadSettingsPage();
  const blocking = issues.filter((i) => i.level === "bloquant");
  const advice = issues.filter((i) => i.level === "conseil");

  return (
    <>
      <PageHeader title="Réglages" subtitle="Ces informations figurent sur tous vos devis et factures." back="/plus" />

      <section
        className={cx(
          "rounded-2xl p-4 ring-1 lg:p-6",
          blocking.length ? "bg-amber-50 ring-amber-200" : "bg-emerald-50 ring-emerald-200",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cx(
              "grid size-10 shrink-0 place-items-center rounded-full",
              blocking.length ? "bg-amber-500 text-white" : "bg-emerald-600 text-white",
            )}
          >
            <Icon name={blocking.length ? "clock" : "check"} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold">
              {blocking.length
                ? `${blocking.length} information${blocking.length > 1 ? "s" : ""} obligatoire${blocking.length > 1 ? "s" : ""} à compléter`
                : "Vos documents seront conformes"}
            </h2>
            <p className="text-sm text-slate-700">
              {blocking.length
                ? "Tant qu'elles manquent, vous pourrez préparer des devis, mais pas émettre de facture."
                : "Toutes les mentions légales obligatoires sont renseignées. Elles seront ajoutées automatiquement."}
            </p>
          </div>
        </div>
        {blocking.length > 0 && (
          <ul className="mt-4 divide-y divide-amber-200/70 overflow-hidden rounded-xl bg-white ring-1 ring-amber-200">
            {blocking.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{i.label}</span>
                    <span className="block text-sm text-slate-600">{i.why}</span>
                  </span>
                  <Icon name="chevron" className="size-5 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {advice.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
          <h2 className="text-[17px] font-bold">Recommandé</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {advice.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex items-center gap-3 py-3 hover:text-brand-700">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{i.label}</span>
                    <span className="block text-sm text-slate-500">{i.why}</span>
                  </span>
                  <Icon name="chevron" className="size-5 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Téléphone : accès aux rubriques (sur ordinateur, elles sont à gauche). */}
      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 lg:hidden">
        {SETTINGS_SECTIONS.slice(1).map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-slate-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Icon name={s.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{s.label}</span>
                <span className="block text-sm text-slate-500">{s.hint}</span>
              </span>
              <Icon name="chevron" className="size-5 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
