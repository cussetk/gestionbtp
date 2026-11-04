"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production uniquement). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** Vide les pages gardées en cache sur le téléphone (à la déconnexion). */
export async function clearOfflineCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-cache");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
    }
  } catch {
    // sans conséquence
  }
}
