import { requireActiveSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { visibleNav } from "@/lib/navigation";
import { BottomNav } from "@/components/app-nav";
import { MobileHeader, Sidebar, TopBar, type ShellUser } from "@/components/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireActiveSession();
  const user: ShellUser = {
    fullName: session.fullName,
    roleLabel: session.role === "proprietaire" ? "Propriétaire" : (session.title ?? "Membre"),
    orgName: session.orgName,
    isPlatformAdmin: session.isPlatformAdmin,
    canCreateClient: can(session, "clients.modifier"),
    canManageTeam: can(session, "equipe.gerer"),
  };
  return (
    <>
      <Sidebar nav={visibleNav(session.permissions)} user={user} />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <MobileHeader user={user} />
        <TopBar user={user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-4 lg:max-w-6xl lg:px-8 lg:pb-16 lg:pt-8">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
