import { redirect } from "next/navigation";
import { currentSession } from "@/lib/session";

export default async function Home() {
  const session = await currentSession();
  if (!session) redirect("/connexion");
  redirect(session.orgStatus === "active" ? "/clients" : "/en-attente");
}
