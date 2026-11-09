"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cx } from "./ui";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";



/** Sous-menu des réglages (colonne de gauche sur ordinateur). */
export function SettingsNav({ blocking }: { blocking: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Réglages" className="hidden lg:block">
      <ul className="sticky top-24 space-y-0.5">
        {SETTINGS_SECTIONS.map((s) => {
          const active = pathname === s.href;
          const count = blocking[s.href] ?? 0;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-[15px]",
                  active ? "bg-white font-bold text-ink shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70",
                )}
              >
                <Icon name={s.icon} className="size-[18px] text-slate-500" />
                <span className="flex-1">{s.label}</span>
                {count > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white" title="Informations obligatoires manquantes">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
