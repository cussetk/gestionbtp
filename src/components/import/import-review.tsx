"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { abandonImportAction, applyImportAction } from "@/app/(app)/catalogue/actions";
import {
  ITEM_KINDS,
  UNITS,
  centsToInput,
  euros,
  formatCoef,
  parseCoef,
  parseEuros,
  priceChangePercent,
  salePriceFromCoef,
  type ItemKind,
  type Unit,
} from "@/lib/catalog";
import type { ImportAction, ImportRow } from "@/lib/catalog-import";
import { formatRate } from "@/lib/tax";
import { FormError, Icon, buttonStyles, cx } from "../ui";
import { SubmitButton } from "../submit-button";

type Row = ImportRow & { priceText: string };
type Filter = "tous" | "creer" | "maj" | "ignorer" | "verifier";
type Summary = { created: number; updated: number; unchanged: number; ignored: number };

const PAGE = 100;

export function ImportReview({
  importId,
  source,
  rows: initialRows,
  taxRates,
  defaultCoefX1000,
}: {
  importId: string;
  source: "fichier" | "ia";
  rows: ImportRow[];
  taxRates: { id: string; label: string; rateBp: number; isDefault: boolean }[];
  defaultCoefX1000: number;
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRows.map((r) => ({ ...r, priceText: centsToInput(r.purchasePriceCents) })));
  const [coefText, setCoefText] = useState(formatCoef(defaultCoefX1000));
  const [taxRateId, setTaxRateId] = useState("");
  const [kind, setKind] = useState<ItemKind>("produit");
  const [filter, setFilter] = useState<Filter>("tous");
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [pending, start] = useTransition();

  const coef = parseCoef(coefText);
  const defaultRate = taxRates.find((t) => t.isDefault);

  const isInvalid = (r: Row) => r.action !== "ignorer" && (parseEuros(r.priceText) === null || !r.name.trim());
  const needsCheck = (r: Row) => r.warnings.length > 0 || isInvalid(r) || (source === "ia" && r.action !== "ignorer");

  const counts = { tous: rows.length, creer: 0, maj: 0, ignorer: 0, verifier: 0 };
  for (const r of rows) {
    counts[r.action]++;
    if (r.warnings.length > 0 || isInvalid(r)) counts.verifier++;
  }

  const visible = rows.filter((r) =>
    filter === "tous" ? true : filter === "verifier" ? r.warnings.length > 0 || isInvalid(r) : r.action === filter,
  );
  const invalidCount = rows.filter(isInvalid).length;

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggle(r: Row) {
    const on: ImportAction = r.matchItemId ? "maj" : "creer";
    update(r.key, { action: r.action === "ignorer" ? on : "ignorer" });
  }

  function setAll(include: boolean) {
    setRows((prev) =>
      prev.map((r) => {
        if (filter !== "tous" && !visible.includes(r)) return r;
        return { ...r, action: include ? (r.matchItemId ? "maj" : "creer") : "ignorer" };
      }),
    );
  }

  function submit() {
    setError(null);
    if (!coef) return setError("Coefficient invalide (ex. 1,4).");
    if (invalidCount > 0) {
      setFilter("verifier");
      return setError(`${invalidCount} ligne${invalidCount > 1 ? "s" : ""} cochée${invalidCount > 1 ? "s" : ""} sans prix ou sans désignation : corrigez-les ou décochez-les.`);
    }
    start(async () => {
      const res = await applyImportAction({
        importId,
        coefX1000: coef,
        taxRateId: taxRateId || null,
        rows: rows.map((r) => ({
          key: r.key,
          action: r.action,
          supplierRef: r.supplierRef,
          name: r.name.trim(),
          brand: r.brand,
          unit: r.unit,
          purchasePriceCents: parseEuros(r.priceText),
          category: r.category,
          kind: r.matchItemId ? r.kind : kind,
        })),
      });
      if (!res.ok) setError(res.error);
      else {
        setResult(res.summary);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (result) {
    return (
      <section className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200" role="status">
        <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <Icon name="check" /> Import validé
        </h2>
        <ul className="mt-2 space-y-0.5 text-[15px] text-emerald-950">
          <li>{result.created} article{result.created > 1 ? "s" : ""} créé{result.created > 1 ? "s" : ""}</li>
          <li>{result.updated} prix mis à jour</li>
          {result.unchanged > 0 && <li>{result.unchanged} sans changement</li>}
          <li>{result.ignored} ligne{result.ignored > 1 ? "s" : ""} ignorée{result.ignored > 1 ? "s" : ""}</li>
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href="/catalogue" className={buttonStyles.primary}>
            Voir le catalogue
          </Link>
          <Link href="/catalogue/importer" className={buttonStyles.secondary}>
            Importer une autre grille
          </Link>
        </div>
      </section>
    );
  }

  const toCreate = counts.creer;
  const toUpdate = counts.maj;

  return (
    <div className="space-y-4 pb-28 lg:pb-4">
      <section className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-3 lg:p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Coefficient des nouveaux articles</span>
          <input className="input" inputMode="decimal" value={coefText} onChange={(e) => setCoefText(e.target.value)} aria-invalid={!coef || undefined} />
          <span className="mt-1 block text-xs text-slate-500">Les articles existants gardent leur coefficient ou leur prix fixe.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">TVA des nouveaux articles</span>
          <select className="input" value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
            <option value="">Taux par défaut{defaultRate ? ` (${formatRate(defaultRate.rateBp)})` : ""}</option>
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({formatRate(t.rateBp)})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nature des nouveaux articles</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
            {ITEM_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav aria-label="Filtrer les lignes" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {(
          [
            ["tous", "Toutes"],
            ["creer", "Nouveaux"],
            ["maj", "Prix modifiés"],
            ["ignorer", "Ignorées"],
            ["verifier", "À vérifier"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setShown(PAGE);
            }}
            aria-pressed={filter === key}
            className={cx(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold",
              filter === key ? "bg-glacier-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200",
              key === "verifier" && counts.verifier > 0 && filter !== key && "text-amber-800 ring-amber-300",
            )}
          >
            {label} <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <span className="text-slate-500">
          {visible.length} ligne{visible.length > 1 ? "s" : ""}
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={() => setAll(true)} className="font-bold text-brand-700">
            Tout cocher
          </button>
          <button type="button" onClick={() => setAll(false)} className="font-bold text-brand-700">
            Tout décocher
          </button>
        </span>
      </div>

      <ul className="space-y-2">
        {visible.slice(0, shown).map((r) => {
          const price = parseEuros(r.priceText);
          const included = r.action !== "ignorer";
          const invalid = isInvalid(r);
          const change = r.match ? priceChangePercent(r.match.purchasePriceCents, price) : null;
          const newSale =
            price === null
              ? null
              : r.match
                ? r.match.pricingMode === "coef" && r.match.coefX1000
                  ? salePriceFromCoef(price, r.match.coefX1000)
                  : r.match.salePriceCents
                : coef
                  ? salePriceFromCoef(price, coef)
                  : null;
          return (
            <li
              key={r.key}
              className={cx(
                "rounded-2xl bg-white p-3 ring-1 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_8rem_7rem_9rem_minmax(0,14rem)] lg:items-center lg:gap-3",
                invalid ? "ring-red-300" : needsCheck(r) && included ? "ring-amber-300" : "ring-slate-200",
                !included && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3 lg:contents">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggle(r)}
                  aria-label={`Importer ${r.name}`}
                  className="mt-3 size-6 shrink-0 accent-brand-600 lg:mt-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    className="input py-2 font-medium"
                    value={r.name}
                    onChange={(e) => update(r.key, { name: e.target.value })}
                    aria-label="Désignation"
                  />
                  <p className="truncate text-xs text-slate-500">
                    {[r.supplierRef && `Réf. ${r.supplierRef}`, r.brand, r.category, r.sourceLine && (source === "ia" ? `page ${r.sourceLine}` : `ligne ${r.sourceLine}`)]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2 lg:contents">
                <label className="block lg:order-none">
                  <span className="sr-only">Prix d&apos;achat HT</span>
                  <span className="relative block">
                    <input
                      className={cx("input py-2 pr-8 text-right tabular-nums", invalid && "ring-2 ring-red-400")}
                      inputMode="decimal"
                      value={r.priceText}
                      onChange={(e) => update(r.key, { priceText: e.target.value })}
                      aria-label={`Prix d'achat HT de ${r.name}`}
                      aria-invalid={invalid || undefined}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                  </span>
                </label>
                <select
                  className="input py-2"
                  value={r.unit}
                  onChange={(e) => update(r.key, { unit: e.target.value as Unit })}
                  aria-label={`Unité de ${r.name}`}
                >
                  {UNITS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.short}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 text-sm lg:mt-0">
                {r.match ? (
                  <span className={cx("font-bold", change && change > 0 ? "text-red-700" : change && change < 0 ? "text-emerald-700" : "text-slate-500")}>
                    {change === null || change === 0 ? "Prix inchangé" : `${change > 0 ? "+" : ""}${change.toLocaleString("fr-FR")} %`}
                  </span>
                ) : (
                  <span className="font-bold text-brand-700">Nouvel article</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-600 lg:mt-0">
                {r.match && (
                  <span className="block truncate">
                    Catalogue : {euros(r.match.purchasePriceCents)} → {euros(price)}
                  </span>
                )}
                <span className="block">
                  Vente : {euros(newSale)}
                  {r.match?.pricingMode === "fixe" ? " (prix fixe)" : ""}
                </span>
                {r.match && r.match.name !== r.name && <span className="block truncate text-xs text-slate-500">« {r.match.name} »</span>}
                {(r.warnings.length > 0 || invalid) && (
                  <span className="mt-1 block text-xs font-medium text-amber-800">
                    {[...(invalid ? [price === null ? "Prix à corriger" : "Désignation vide"] : []), ...r.warnings].join(". ")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={cx(buttonStyles.secondary, "w-full")}>
          Afficher {Math.min(PAGE, visible.length - shown)} lignes de plus
        </button>
      )}

      <div
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:rounded-2xl lg:border lg:shadow-lg"
      >
        <FormError message={error ?? undefined} />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-slate-600">
            <span className="font-bold text-ink">{toCreate}</span> création{toCreate > 1 ? "s" : ""},{" "}
            <span className="font-bold text-ink">{toUpdate}</span> mise{toUpdate > 1 ? "s" : ""} à jour de prix. Rien n&apos;est enregistré avant de valider.
          </p>
          <button type="button" onClick={submit} disabled={pending || toCreate + toUpdate === 0} className={buttonStyles.primary}>
            {pending ? "Enregistrement…" : "Valider l'import"}
          </button>
        </div>
      </div>

      <form action={abandonImportAction} className="pt-2">
        <input type="hidden" name="id" value={importId} />
        <SubmitButton variant="ghost" pendingLabel="…" confirm="Abandonner cet import ? Le catalogue ne sera pas modifié.">
          Abandonner cet import
        </SubmitButton>
      </form>
    </div>
  );
}
