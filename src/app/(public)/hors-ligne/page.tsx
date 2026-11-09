import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hors ligne" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="text-center">
      <h1 className="mb-2 text-lg font-bold">Pas de réseau</h1>
      <p className="text-sm text-slate-600">
        Cette page n&apos;a pas encore été ouverte sur ce téléphone, elle n&apos;est donc pas disponible hors ligne.
        Les fiches déjà consultées restent accessibles.
      </p>
    </div>
  );
}
