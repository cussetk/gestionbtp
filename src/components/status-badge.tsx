import { cx } from "./ui";

const STYLES = {
  en_attente: ["En attente", "bg-amber-100 text-amber-800"],
  active: ["Active", "bg-emerald-100 text-emerald-800"],
  suspendue: ["Suspendue", "bg-red-100 text-red-700"],
} as const;

export function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  const [label, style] = STYLES[status];
  return <span className={cx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", style)}>{label}</span>;
}
