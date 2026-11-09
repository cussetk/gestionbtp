import type { Metadata } from "next";
import Link from "next/link";
import { permissionLabel } from "@/lib/permissions";

export const metadata: Metadata = { title: "Accès refusé" };

export default async function ForbiddenPage({ searchParams }: PageProps<"/acces-refuse">) {
  const raw = (await searchParams).droit;
  const droit = Array.isArray(raw) ? raw[0] : raw;
  return (
    <div className="text-center">
      <h1 className="mb-2 text-lg font-bold">Accès refusé</h1>
      <p className="text-sm text-slate-600">
        {droit
          ? `Votre compte n'a pas l'autorisation « ${permissionLabel(droit)} ».`
          : "Cette page n'est pas accessible avec votre compte."}{" "}
        Demandez au responsable de votre entreprise de vous l&apos;accorder.
      </p>
      <Link href="/plus" className="mt-6 inline-block font-bold text-brand-700 underline">
        Retour
      </Link>
    </div>
  );
}
