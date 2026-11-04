"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
    >
      Hors ligne — vos enregistrements partiront dès le retour du réseau.
    </div>
  );
}
