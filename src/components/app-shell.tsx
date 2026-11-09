"use client";

import Link from "next/link";
import Form from "next/form";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { APP_NAME } from "@/lib/config";
import { isActive, type NavSection } from "@/lib/navigation";
import { Icon, cx, type IconName } from "./ui";
import { SignOutButton } from "./sign-out-button";

export type ShellUser = {
  fullName: string;
  roleLabel: string;
  orgName: string;
  isPlatformAdmin: boolean;
  canCreateClient: boolean;
  canManageTeam: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Menu latéral (ordinateur et tablette en paysage). */
export function Sidebar({ nav, user }: { nav: NavSection[]; user: ShellUser }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-glacier-950 text-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-600">
          <Icon name="drop" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight">{user.orgName}</p>
          <p className="text-xs text-glacier-300">{APP_NAME}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {nav.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-1 px-3 text-xs font-bold text-glacier-300">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item, pathname);
                const content = (
                  <>
                    <Icon name={item.icon} className="size-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!item.ready && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-glacier-300">bientôt</span>}
                  </>
                );
                return (
                  <li key={item.href}>
                    {item.ready ? (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "relative flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                          active ? "bg-glacier-800 font-bold text-white" : "text-white/80 hover:bg-glacier-900 hover:text-white",
                        )}
                      >
                        {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r bg-copper-500" />}
                        {content}
                      </Link>
                    ) : (
                      <span aria-disabled className="flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-[15px] text-white/35">
                        {content}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user.isPlatformAdmin && (
          <Link href="/admin" className="mb-2 flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] text-white/80 hover:bg-glacier-900 hover:text-white">
            <Icon name="shield" className="size-[18px]" /> Espace gestionnaire
          </Link>
        )}
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-glacier-800 text-sm font-bold">{initials(user.fullName)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.fullName}</p>
            <p className="truncate text-xs text-glacier-300">{user.roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

type CreateEntry = { href: string; label: string; icon: IconName; ready: boolean; show: boolean };

/** Bouton « Créer » : accès direct aux créations, depuis n'importe quelle page. */
function CreateMenu({ user }: { user: ShellUser }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  const entries: CreateEntry[] = [
    { href: "/clients/nouveau", label: "Client", icon: "user", ready: true, show: user.canCreateClient },
    { href: "#", label: "Devis", icon: "doc", ready: false, show: true },
    { href: "#", label: "Facture", icon: "receipt", ready: false, show: true },
    { href: "#", label: "Intervention", icon: "calendar", ready: false, show: true },
    { href: "/equipe/inviter", label: "Membre de l'équipe", icon: "users", ready: true, show: user.canManageTeam },
  ];
  return (
    <details ref={ref} className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg bg-brand-600 px-4 font-bold text-white hover:bg-brand-700 [&::-webkit-details-marker]:hidden">
        <Icon name="plus" className="size-5" /> Créer
      </summary>
      <ul className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
        {entries
          .filter((e) => e.show)
          .map((e) => (
            <li key={e.label}>
              {e.ready ? (
                <Link href={e.href} className="flex h-10 items-center gap-3 px-4 text-[15px] hover:bg-slate-50">
                  <Icon name={e.icon} className="size-[18px] text-slate-500" /> {e.label}
                </Link>
              ) : (
                <span className="flex h-10 items-center gap-3 px-4 text-[15px] text-slate-400">
                  <Icon name={e.icon} className="size-[18px]" /> {e.label}
                  <span className="ml-auto text-xs">bientôt</span>
                </span>
              )}
            </li>
          ))}
      </ul>
    </details>
  );
}

/** Barre du haut sur ordinateur : recherche et création. */
export function TopBar({ user }: { user: ShellUser }) {
  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-8 backdrop-blur lg:flex">
      <Form action="/clients" className="relative max-w-xl flex-1">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="q"
          placeholder="Rechercher un client, un téléphone, une adresse…"
          aria-label="Rechercher"
          className="h-10 w-full rounded-lg border border-slate-200 bg-surface pl-11 pr-3 text-[15px] focus:border-brand-500 focus:bg-white focus:outline-none"
        />
      </Form>
      <div className="ml-auto">
        <CreateMenu user={user} />
      </div>
    </div>
  );
}

/** En-tête sur téléphone. */
export function MobileHeader({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-30 bg-glacier-950 text-white lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{user.orgName}</p>
          <p className="truncate text-xs text-glacier-300">
            {user.fullName}, {user.roleLabel.toLowerCase()}
          </p>
        </div>
        {user.isPlatformAdmin && (
          <Link href="/admin" aria-label="Espace gestionnaire" className="grid size-11 place-items-center rounded-full text-white/90 active:bg-white/15">
            <Icon name="shield" />
          </Link>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
