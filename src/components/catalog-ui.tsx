import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { Icon, cx } from "./ui";

const IMPORT_STATUS = {
  brouillon: ["À valider", "bg-amber-100 text-amber-800"],
  applique: ["Appliqué", "bg-emerald-100 text-emerald-800"],
  abandonne: ["Abandonné", "bg-slate-100 text-slate-600"],
} as const;

export function ImportStatusBadge({ status }: { status: keyof typeof IMPORT_STATUS }) {
  const [label, style] = IMPORT_STATUS[status];
  return <span className={cx("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", style)}>{label}</span>;
}

type Summary = { created: number; updated: number; unchanged: number; ignored: number } | null;

export type ImportListItem = {
  id: string;
  status: keyof typeof IMPORT_STATUS;
  source: "fichier" | "ia";
  fileName: string | null;
  createdAt: Date;
  summary: unknown;
  supplierName?: string | null;
};

function summaryText(s: Summary): string | null {
  if (!s) return null;
  const parts = [s.created && `${s.created} créé${s.created > 1 ? "s" : ""}`, s.updated && `${s.updated} prix mis à jour`].filter(Boolean);
  return parts.length ? parts.join(", ") : "Aucun changement";
}

/** Liste des derniers imports de grilles. */
export function ImportList({ items, timezone, showSupplier }: { items: ImportListItem[]; timezone: string; showSupplier?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/catalogue/imports/${i.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-slate-50 active:bg-slate-50">
            <Icon name={i.source === "ia" ? "camera" : "doc"} className="size-5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {showSupplier && i.supplierName ? `${i.supplierName} : ` : ""}
                {i.fileName ?? (i.source === "ia" ? "Photo" : "Fichier")}
              </span>
              <span className="block text-xs text-slate-500">
                {formatDateTime(i.createdAt, timezone)}
                {i.status === "applique" && summaryText(i.summary as Summary) ? `, ${summaryText(i.summary as Summary)}` : ""}
              </span>
            </span>
            <ImportStatusBadge status={i.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
