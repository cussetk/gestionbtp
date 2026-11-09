"use client";

import { useActionState, useState } from "react";
import { saveItemAction, type FormState } from "@/app/(app)/catalogue/actions";
import {
  ITEM_KINDS,
  UNITS,
  euros,
  formatCoef,
  formatPercent,
  margin,
  parseCoef,
  parseEuros,
  salePriceFromCoef,
} from "@/lib/catalog";
import { formatRate } from "@/lib/tax";
import { Field, FormError, TextArea, TextInput, cx } from "./ui";
import { SubmitButton } from "./submit-button";

type Values = Record<string, string | null | undefined>;

export type ItemFormOptions = {
  taxRates: { id: string; label: string; rateBp: number; isDefault: boolean; active: boolean }[];
  suppliers: { id: string; name: string }[];
  categories: string[];
  defaultCoefX1000: number;
};

function Segmented<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
}: {
  name: string;
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">{legend}</legend>
      <div className="grid gap-1 rounded-xl bg-slate-200/70 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.key}
            className={cx(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-bold leading-tight",
              value === o.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600",
            )}
          >
            <input type="radio" name={`${name}-choice`} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ItemForm({
  mode,
  initial,
  options,
  showPurchase,
}: {
  mode: "create" | "update";
  initial: Values;
  options: ItemFormOptions;
  /** Droit « prix.achat » : prix d'achat, coefficient, marge et fournisseur. */
  showPurchase: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveItemAction, {});
  const v: Values = state.values ?? initial;
  const e = state.errors ?? {};
  const val = (k: string) => v[k] ?? "";

  const [kind, setKind] = useState((initial.kind as string) ?? "produit");
  const [pricingMode, setPricingMode] = useState<"coef" | "fixe">(
    showPurchase ? ((initial.pricingMode as "coef" | "fixe") ?? "coef") : "fixe",
  );
  const [purchase, setPurchase] = useState(initial.purchasePrice ?? "");
  const [coef, setCoef] = useState(initial.coef ?? formatCoef(options.defaultCoefX1000));
  const [sale, setSale] = useState(initial.salePrice ?? "");
  const [taxRateId, setTaxRateId] = useState(initial.taxRateId ?? "");

  const purchaseCents = parseEuros(purchase);
  const coefX1000 = parseCoef(coef);
  const saleCents =
    pricingMode === "coef" ? (purchaseCents !== null && coefX1000 ? salePriceFromCoef(purchaseCents, coefX1000) : null) : parseEuros(sale);
  const m = saleCents !== null ? margin(purchaseCents, saleCents) : null;
  const defaultRate = options.taxRates.find((t) => t.isDefault);
  const rate = options.taxRates.find((t) => t.id === taxRateId) ?? defaultRate;
  const ttc = saleCents !== null && rate ? Math.round(saleCents * (1 + rate.rateBp / 10000)) : null;
  const visibleRates = options.taxRates.filter((t) => t.active || t.id === initial.taxRateId);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={val("id")} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pricingMode" value={pricingMode} />
      <FormError message={e._form} />

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
        <Segmented
          name="kind"
          legend="Nature"
          value={kind}
          onChange={setKind}
          options={ITEM_KINDS.map((k) => ({ key: k.key, label: k.label }))}
        />
        <p className="-mt-2 text-xs text-slate-500">{ITEM_KINDS.find((k) => k.key === kind)?.hint}</p>

        <Field label="Désignation *" name="name" error={e.name} hint="Telle qu'elle apparaîtra sur vos devis et factures.">
          <TextInput name="name" defaultValue={val("name")} error={e.name} />
        </Field>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Référence interne" name="reference" error={e.reference}>
            <TextInput name="reference" defaultValue={val("reference")} error={e.reference} />
          </Field>
          {kind === "produit" ? (
            <Field label="Marque" name="brand" error={e.brand}>
              <TextInput name="brand" defaultValue={val("brand")} error={e.brand} />
            </Field>
          ) : (
            <input type="hidden" name="brand" value="" />
          )}
          <Field label="Famille" name="category" error={e.category} hint="Pour classer et filtrer.">
            <TextInput name="category" list="categories" defaultValue={val("category")} error={e.category} />
            <datalist id="categories">
              {options.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Description" name="description" error={e.description} hint="Caractéristiques, garantie… reprises sous la désignation sur le devis.">
          <TextArea name="description" defaultValue={val("description")} error={e.description} />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
        <h2 className="text-[17px] font-bold">Prix</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Unité" name="unit" error={e.unit}>
            <select id="unit" name="unit" className="input" defaultValue={val("unit") || (kind === "main_oeuvre" ? "h" : kind === "prestation" ? "forfait" : "u")}>
              {UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="TVA" name="taxRateId" error={e.taxRateId}>
            <select id="taxRateId" name="taxRateId" className="input" value={taxRateId} onChange={(ev) => setTaxRateId(ev.target.value)}>
              <option value="">Taux par défaut{defaultRate ? ` (${formatRate(defaultRate.rateBp)})` : ""}</option>
              {visibleRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({formatRate(t.rateBp)}){t.active ? "" : " (désactivé)"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {showPurchase && (
          <>
            <Field label={pricingMode === "coef" ? "Prix d'achat HT *" : "Prix d'achat HT"} name="purchasePrice" error={e.purchasePrice} hint="Visible seulement par les comptes autorisés à voir les marges.">
              <TextInput name="purchasePrice" inputMode="decimal" value={purchase} onChange={(ev) => setPurchase(ev.target.value)} error={e.purchasePrice} />
            </Field>
            <Segmented
              name="pricing"
              legend="Prix de vente"
              value={pricingMode}
              onChange={setPricingMode}
              options={[
                { key: "coef", label: "Calculé (coefficient)" },
                { key: "fixe", label: "Prix fixe" },
              ]}
            />
          </>
        )}

        {pricingMode === "coef" ? (
          <>
            <Field label="Coefficient *" name="coef" error={e.coef} hint="Prix de vente = prix d'achat × coefficient. Suit automatiquement les hausses du fournisseur.">
              <TextInput name="coef" inputMode="decimal" value={coef} onChange={(ev) => setCoef(ev.target.value)} error={e.coef} />
            </Field>
            <input type="hidden" name="salePrice" value="" />
          </>
        ) : (
          <>
            <Field label="Prix de vente HT *" name="salePrice" error={e.salePrice}>
              <TextInput name="salePrice" inputMode="decimal" value={sale} onChange={(ev) => setSale(ev.target.value)} error={e.salePrice} />
            </Field>
            <input type="hidden" name="coef" value="" />
          </>
        )}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 text-center ring-1 ring-slate-200 lg:grid-cols-4" aria-live="polite">
          <div className="bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">Vente HT</p>
            <p className="font-bold tabular-nums">{euros(saleCents)}</p>
          </div>
          <div className="bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">Vente TTC</p>
            <p className="font-bold tabular-nums">{euros(ttc)}</p>
          </div>
          {showPurchase && (
            <>
              <div className="bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-500">Marge</p>
                <p className={cx("font-bold tabular-nums", m && m.amount < 0 && "text-red-700")}>{m ? euros(m.amount) : "—"}</p>
              </div>
              <div className="bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-500">Taux de marque</p>
                <p className={cx("font-bold tabular-nums", m && m.amount < 0 && "text-red-700")}>{formatPercent(m?.rate)}</p>
              </div>
            </>
          )}
        </div>
      </section>

      {showPurchase && (
        <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
          <h2 className="text-[17px] font-bold">Fournisseur</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Fournisseur principal" name="supplierId" error={e.supplierId}>
              <select id="supplierId" name="supplierId" className="input" defaultValue={val("supplierId")}>
                <option value="">Aucun</option>
                {options.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Référence chez le fournisseur" name="supplierRef" error={e.supplierRef} hint="Sert à mettre à jour le prix lors de l'import de sa grille.">
              <TextInput name="supplierRef" defaultValue={val("supplierRef")} error={e.supplierRef} />
            </Field>
          </div>
        </section>
      )}

      {kind === "produit" && (
        <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
          <h2 className="text-[17px] font-bold">Suivi</h2>
          <label className="flex min-h-11 items-start gap-3 text-[15px]">
            <input type="checkbox" name="trackSerial" defaultChecked={val("trackSerial") === "on"} className="mt-0.5 size-5 accent-brand-600" />
            <span>
              Numéros de série
              <span className="block text-sm text-slate-500">Climatiseurs, pompes à chaleur… suivis de la commande jusqu&apos;à l&apos;équipement posé chez le client.</span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3 text-[15px]">
            <input type="checkbox" name="trackStock" defaultChecked={val("trackStock") === "on"} className="mt-0.5 size-5 accent-brand-600" />
            <span>
              Suivre le stock
              <span className="block text-sm text-slate-500">Quantités en dépôt et dans les véhicules (module stock à venir).</span>
            </span>
          </label>
        </section>
      )}

      <Field label="Notes internes" name="notes" error={e.notes}>
        <TextArea name="notes" defaultValue={val("notes")} error={e.notes} />
      </Field>

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <SubmitButton className="w-full shadow-lg lg:w-auto">{mode === "create" ? "Créer l'article" : "Enregistrer"}</SubmitButton>
      </div>
    </form>
  );
}
