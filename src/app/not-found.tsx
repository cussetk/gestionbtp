import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-lg font-bold">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-600">Cet élément n&apos;existe pas ou a été archivé.</p>
      <Link href="/clients" className="mt-6 inline-block font-bold text-brand-700 underline">
        Retour aux clients
      </Link>
    </main>
  );
}
