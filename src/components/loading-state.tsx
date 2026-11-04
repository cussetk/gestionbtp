"use client";

import { useOffline } from "next/offline";

export function LoadingState() {
  const offline = useOffline();
  return (
    <div className="space-y-3" aria-busy="true">
      <p className="text-sm text-slate-500">{offline ? "En attente du réseau pour charger cette page…" : "Chargement…"}</p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
      ))}
    </div>
  );
}
