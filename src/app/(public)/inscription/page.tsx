import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/session";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Créer mon espace" };

export default async function SignUpPage() {
  if (await currentSession()) redirect("/");
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Créer l&apos;espace de mon entreprise</h1>
      <p className="mb-4 text-sm text-slate-500">Vous en serez le propriétaire. Après validation de votre espace, vous pourrez inviter votre équipe.</p>
      <SignUpForm />
    </>
  );
}
