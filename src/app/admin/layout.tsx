import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/session";
import { Icon } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: { default: "Espace gestionnaire", template: "%s · Gestionnaire" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requirePlatformAdmin();
  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Icon name="shield" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">Gestionnaire</p>
            <p className="truncate text-xs text-white/70">{session.fullName}</p>
          </div>
          <Link href="/" className="rounded-full px-3 py-2 text-sm font-bold text-white/90 active:bg-white/15">
            Mon espace
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4">{children}</main>
    </>
  );
}
