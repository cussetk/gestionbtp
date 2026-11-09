"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { createImportFromAiAction, createImportFromFileAction, type AiState } from "@/app/(app)/catalogue/actions";
import { euros, unitShort } from "@/lib/catalog";
import {
  COLUMN_FIELDS,
  MAX_IMPORT_ROWS,
  detectHeaderRow,
  guessMapping,
  rowsFromTable,
  type ColumnMapping,
} from "@/lib/catalog-import";
import { FormError, Icon, buttonStyles, cx } from "../ui";
import { readTable, resizeImage } from "./files";

type Supplier = { id: string; name: string };

const MAX_AI_FILES = 6;
const MAX_AI_BYTES = 4 * 1024 * 1024;

function columnLabel(header: unknown[], i: number): string {
  const letter = i < 26 ? String.fromCharCode(65 + i) : `C${i + 1}`;
  const h = String(header[i] ?? "").trim();
  return h ? `${letter} : ${h.slice(0, 40)}` : `Colonne ${letter}`;
}

export function ImportStart({
  suppliers,
  initialSupplierId,
  aiEnabled,
}: {
  suppliers: Supplier[];
  initialSupplierId: string | null;
  aiEnabled: boolean;
}) {
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? "");
  const [mode, setMode] = useState<"fichier" | "ia">("fichier");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
        <label htmlFor="supplier" className="text-[17px] font-bold">
          De quel fournisseur vient cette grille ?
        </label>
        <p className="mt-0.5 text-sm text-slate-500">Les prix seront rapprochés de ses articles par référence.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select id="supplier" className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sans fournisseur (mon propre tarif)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Link href="/fournisseurs/nouveau" className={cx(buttonStyles.secondary, "shrink-0")}>
            <Icon name="plus" /> Nouveau fournisseur
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Type de document">
        {(
          [
            ["fichier", "Fichier Excel ou CSV", "doc"],
            ["ia", "Photo ou PDF", "camera"],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cx(
              "flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 text-sm font-bold",
              mode === key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600",
            )}
          >
            <Icon name={icon} className="size-5 shrink-0" /> {label}
          </button>
        ))}
      </div>

      {mode === "fichier" ? <FileImport supplierId={supplierId || null} /> : <AiImport supplierId={supplierId || null} enabled={aiEnabled} />}
    </div>
  );
}

// ─── Fichier Excel / CSV ──────────────────────────────────────────────────

function FileImport({ supplierId }: { supplierId: string | null }) {
  const [table, setTable] = useState<{ rows: unknown[][]; name: string; sheet?: string } | null>(null);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [discount, setDiscount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    setTable(null);
    if (!file) return;
    try {
      const t = await readTable(file);
      if (t.rows.length < 2) throw new Error("Ce fichier ne contient pas de tableau lisible.");
      const h = Math.max(detectHeaderRow(t.rows), 0);
      setTable({ ...t, name: file.name });
      setHeaderIndex(h);
      setMapping(guessMapping(t.rows[h]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fichier illisible.");
    }
  }

  const discountValue = Number(discount.replace(",", ".")) || 0;
  const rows = useMemo(
    () => (table && mapping.name !== undefined ? rowsFromTable(table.rows, headerIndex, mapping, discountValue) : []),
    [table, headerIndex, mapping, discountValue],
  );
  const header = table?.rows[headerIndex] ?? [];
  const width = table ? Math.max(...table.rows.slice(0, 50).map((r) => r.length)) : 0;
  const missing = COLUMN_FIELDS.filter((f) => f.required && mapping[f.key] === undefined);
  const withPrice = rows.filter((r) => r.purchasePriceCents !== null).length;

  function submit() {
    setError(null);
    start(async () => {
      const res = await createImportFromFileAction({
        supplierId,
        fileName: table?.name ?? null,
        rows: rows.map(({ warnings, ...r }) => ({ ...r, warnings: warnings?.slice(0, 5) })),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
      <div>
        <h2 className="text-[17px] font-bold">Fichier du fournisseur</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Excel (.xlsx) ou CSV. Le fichier est lu sur votre appareil : rien n&apos;est enregistré avant votre validation.
        </p>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.csv,.txt,text/csv" className="sr-only" id="grid-file" onChange={(e) => onFile(e.target.files?.[0])} />
      <label htmlFor="grid-file" className={cx(buttonStyles.secondary, "w-full cursor-pointer border-2 border-dashed border-slate-300 ring-0 sm:w-auto")}>
        <Icon name="upload" /> {table ? "Choisir un autre fichier" : "Choisir le fichier"}
      </label>
      <FormError message={error ?? undefined} />

      {table && (
        <>
          <p className="text-sm text-slate-600">
            <span className="font-bold">{table.name}</span>
            {table.sheet ? `, feuille « ${table.sheet} »` : ""} : {table.rows.length} lignes lues.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Ligne des intitulés</span>
              <select className="input" value={headerIndex} onChange={(e) => { const h = Number(e.target.value); setHeaderIndex(h); setMapping(guessMapping(table.rows[h])); }}>
                {table.rows.slice(0, 20).map((r, i) => (
                  <option key={i} value={i}>
                    Ligne {i + 1} : {r.filter((c) => c !== null && c !== "").slice(0, 3).join(" | ").slice(0, 50)}
                  </option>
                ))}
              </select>
            </label>
            {COLUMN_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                <select
                  className="input"
                  aria-label={f.label}
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }) as ColumnMapping)}
                >
                  <option value="">{f.required ? "Choisir la colonne…" : "Aucune"}</option>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {columnLabel(header, i)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Remise à appliquer (%)</span>
              <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              <span className="mt-1 block text-xs text-slate-500">Seulement si la colonne contient des prix publics et non vos prix nets.</span>
            </label>
          </div>

          {missing.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Indiquez la colonne : {missing.map((f) => f.label).join(", ")}.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                <table className="w-full text-left text-sm">
                  <caption className="bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-500">Aperçu des premières lignes</caption>
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Réf.</th>
                      <th className="px-3 py-2">Désignation</th>
                      <th className="px-3 py-2">Unité</th>
                      <th className="px-3 py-2 text-right">Achat HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 6).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-600">{r.supplierRef ?? "—"}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-slate-600">{unitShort(r.unit)}</td>
                        <td className={cx("px-3 py-2 text-right tabular-nums", r.purchasePriceCents === null && "text-amber-700")}>
                          {r.purchasePriceCents === null ? "illisible" : euros(r.purchasePriceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > MAX_IMPORT_ROWS && (
                <p className="text-sm font-bold text-red-700">{rows.length} lignes : {MAX_IMPORT_ROWS} maximum par import. Découpez le fichier.</p>
              )}
              <button type="button" onClick={submit} disabled={pending || rows.length === 0 || rows.length > MAX_IMPORT_ROWS} className={cx(buttonStyles.primary, "w-full sm:w-auto")}>
                {pending ? "Préparation…" : `Relire les ${withPrice} prix avant d'importer`}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ─── Photo / PDF lus par l'IA ─────────────────────────────────────────────

function AiImport({ supplierId, enabled }: { supplierId: string | null; enabled: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<AiState, FormData>(createImportFromAiAction, {});
  const [, start] = useTransition();

  if (!enabled) {
    return (
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
        <h2 className="text-[17px] font-bold">Lecture des photos et PDF</h2>
        <p className="mt-1 text-[15px] text-slate-600">
          La lecture automatique des grilles en photo ou en PDF n&apos;est pas encore activée pour votre espace. En attendant, demandez à votre
          fournisseur son tarif au format Excel : c&apos;est le plus fiable.
        </p>
      </section>
    );
  }

  async function add(list: FileList | null) {
    if (!list) return;
    setLocalError(null);
    setPreparing(true);
    try {
      const prepared = await Promise.all(Array.from(list).map((f) => resizeImage(f)));
      setFiles((prev) => [...prev, ...prepared].slice(0, MAX_AI_FILES));
    } finally {
      setPreparing(false);
    }
  }

  const total = files.reduce((s, f) => s + f.size, 0);

  function submit() {
    if (total > MAX_AI_BYTES) return setLocalError("Fichiers trop lourds (4 Mo maximum au total).");
    const fd = new FormData();
    if (supplierId) fd.set("supplierId", supplierId);
    for (const f of files) fd.append("files", f);
    start(() => formAction(fd));
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6">
      <div>
        <h2 className="text-[17px] font-bold">Photos ou PDF de la grille</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          L&apos;IA lit le document et vous propose les lignes. Vous vérifiez chaque prix avant que quoi que ce soit ne soit enregistré.
          Une photo par page, bien à plat et nette.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={cx(buttonStyles.secondary, "cursor-pointer lg:hidden")}>
          <Icon name="camera" /> Prendre une photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>
        <label className={cx(buttonStyles.secondary, "cursor-pointer")}>
          <Icon name="upload" /> Choisir des fichiers
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>
      </div>

      {preparing && <p className="text-sm text-slate-500">Préparation des photos…</p>}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Icon name={f.type === "application/pdf" ? "doc" : "camera"} className="size-5 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">
                {i + 1}. {f.name}
              </span>
              <span className="tabular-nums text-slate-500">{Math.round(f.size / 1024)} Ko</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={`Retirer ${f.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormError message={localError ?? state.error} />
      {pending && (
        <p role="status" className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 ring-1 ring-brand-100">
          Lecture en cours… Comptez 20 secondes à une minute par page. Ne fermez pas cette page.
        </p>
      )}
      <button type="button" onClick={submit} disabled={pending || preparing || files.length === 0} className={cx(buttonStyles.primary, "w-full sm:w-auto")}>
        {pending ? "Lecture…" : `Lire ${files.length > 1 ? `les ${files.length} fichiers` : "le document"}`}
      </button>
      <p className="text-xs text-slate-500">
        Seul le document du fournisseur est transmis au service de lecture, jamais les données de vos clients. {MAX_AI_FILES} fichiers et 4 Mo au maximum.
      </p>
    </section>
  );
}
