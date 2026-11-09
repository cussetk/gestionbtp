import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/session";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage() {
  if (await currentSession()) redirect("/");
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Connexion</h1>
      <SignInForm />
    </>
  );
}
