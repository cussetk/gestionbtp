import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { Icon } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Espace en cours de validation" };

export default async function PendingPage() {
  const session = await requireSession();
  if (session.orgStatus === "active") redirect("/clients");
  const suspended = session.orgStatus === "suspendue";
  return (
    <div className="text-center">
      <div className={`mx-auto mb-3 grid size-12 place-items-center rounded-full ${suspended ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
        <Icon name={suspended ? "ban" : "clock"} className="size-7" />
      </div>
      <h1 className="mb-2 text-lg font-semibold">{suspended ? "Espace suspendu" : "Espace en cours de validation"}</h1>
      {suspended ? (
        <>
          <p className="text-sm text-slate-600">L&apos;accès à l&apos;espace « {session.orgName} » est suspendu.</p>
          {session.orgStatusReason && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">Motif : {session.orgStatusReason}</p>}
          <p className="mt-2 text-sm text-slate-600">Vos données sont conservées. Contactez-nous pour rétablir l&apos;accès.</p>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Merci {session.fullName} ! L&apos;espace « {session.orgName} » a bien été créé. Nous le validons rapidement,
          généralement dans la journée. Vous pourrez alors vous connecter normalement.
        </p>
      )}
      <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-1 text-white">
        <span className="text-sm">Se déconnecter</span>
        <SignOutButton />
      </div>
    </div>
  );
}
