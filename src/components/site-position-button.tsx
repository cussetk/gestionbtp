"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSitePositionAction } from "@/app/(app)/clients/actions";
import { Icon, buttonStyles, cx } from "./ui";
import { geoErrorMessage, locateDevice } from "./geolocate";

/** Un bouton sur la fiche du site : relève la position et l'enregistre directement. */
export function SitePositionButton({ siteId, hasPosition }: { siteId: string; hasPosition: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setMessage(null);
    setLocating(true);
    try {
      const fix = await locateDevice();
      startTransition(async () => {
        const res = await saveSitePositionAction({ siteId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
        if (res.ok) {
          setMessage({ ok: true, text: `Position enregistrée (précision ${Math.round(fix.accuracy)} m).` });
          router.refresh();
        } else {
          setMessage({ ok: false, text: res.error });
        }
      });
    } catch (err) {
      setMessage({ ok: false, text: geoErrorMessage(err) });
    } finally {
      setLocating(false);
    }
  }

  const busy = locating || pending;
  return (
    <div>
      <button type="button" onClick={run} disabled={busy} className={cx(buttonStyles.primary, "w-full")}>
        <Icon name="locate" />
        {busy ? "Relevé en cours…" : hasPosition ? "Je suis sur place : mettre à jour la position" : "Je suis sur place : enregistrer la position"}
      </button>
      {message && (
        <p
          role="status"
          className={cx("mt-2 rounded-lg px-3 py-2 text-sm", message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
