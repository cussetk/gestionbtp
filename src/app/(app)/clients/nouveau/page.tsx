import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  await requirePermission("clients.modifier");
  // Identifiant créé dès l'ouverture du formulaire : un double envoi ne crée pas de doublon.
  const id = crypto.randomUUID();
  return (
    <>
      <PageHeader title="Nouveau client" back="/clients" />
      <ClientForm mode="create" initial={{ id, type: "particulier" }} />
    </>
  );
}
