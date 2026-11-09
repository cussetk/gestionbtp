"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cx, type IconName } from "./ui";

const ITEMS: { href: string; label: string; icon: IconName; ready: boolean; match?: string[] }[] = [
  { href: "/clients", label: "Clients", icon: "users", ready: true, match: ["/clients", "/sites"] },
  { href: "/planning", label: "Planning", icon: "calendar", ready: false },
  { href: "/parc", label: "Parc", icon: "box", ready: false },
  { href: "/plus", label: "Plus", icon: "menu", ready: true, match: ["/plus", "/equipe", "/reglages"] },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {ITEMS.map((item) => {
          const active = (item.match ?? [item.href]).some((m) => pathname.startsWith(m));
          const content = (
            <>
              <Icon name={item.icon} className="size-6" />
              <span className="text-[11px] font-medium">{item.label}</span>
              {!item.ready && <span className="text-[10px] text-slate-400">bientôt</span>}
            </>
          );
          return (
            <li key={item.href}>
              {item.ready ? (
                <Link
                  href={item.href}
                  className={cx("flex h-16 flex-col items-center justify-center gap-0.5", active ? "text-brand-700" : "text-slate-500")}
                >
                  {content}
                </Link>
              ) : (
                <span aria-disabled className="flex h-16 flex-col items-center justify-center gap-0.5 text-slate-300">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
