import type { ReactNode } from "react";
import { cx } from "./ui";

/** Bloc de réglages : titre, explication courte, contenu. */
export function SettingsBlock({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-6", className)}>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function SavedNotice({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
      {text}
    </p>
  );
}

/** Rappel légal (encadré discret). */
export function LegalNote({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-100">{children}</div>;
}
