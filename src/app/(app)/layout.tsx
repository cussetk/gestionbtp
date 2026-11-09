import Link from "next/link";
import { requireActiveSession } from "@/lib/session";
import { BottomNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Icon } from "@/components/ui";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireActiveSession();
  const roleLabel = session.role === "proprietaire" ? "Propriétaire" : (session.title ?? "Membre");
  return (
    <>
      <header
        className="sticky top-0 z-30 bg-brand-700 text-white shadow"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{session.orgName}</p>
            <p className="truncate text-xs text-white/75">
              {session.fullName} · {roleLabel}
            </p>
          </div>
          {session.isPlatformAdmin && (
            <Link
              href="/admin"
              aria-label="Espace gestionnaire"
              className="grid size-11 place-items-center rounded-full text-white/90 active:bg-white/15"
            >
              <Icon name="shield" />
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-4">{children}</main>
      <BottomNav />
    </>
  );
}
