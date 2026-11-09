"use client";

/**
 * Relevé de position fiable sur le terrain :
 *  1. GPS précis (12 s) ;
 *  2. en cas d'échec ou de délai dépassé : position approximative (réseau, dernière position < 2 min).
 * Messages d'erreur explicites, selon le téléphone.
 */

export type GeoFix = { lat: number; lng: number; accuracy: number };

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function geolocationHelp(code: number | "insecure" | "unsupported"): string {
  if (code === "insecure") return "La localisation nécessite une connexion sécurisée (https).";
  if (code === "unsupported") return "Ce navigateur ne permet pas la localisation. Collez plutôt un lien Google Maps.";
  if (code === 1) {
    return isIOS()
      ? "Localisation refusée. Sur iPhone : Réglages › Confidentialité et sécurité › Service de localisation › activez-le, puis Safari (ou l'application) › « Lorsque l'app est active ». Revenez ensuite et réessayez."
      : "Localisation refusée. Touchez le cadenas à gauche de l'adresse (ou ⋮ › Paramètres du site) › Position › Autoriser, vérifiez que la localisation du téléphone est activée, puis réessayez.";
  }
  if (code === 2) {
    return "Position introuvable : activez la localisation du téléphone, ou sortez à l'extérieur pour capter le GPS, puis réessayez.";
  }
  return "Le GPS met trop de temps à répondre. Réessayez à l'extérieur, ou collez un lien Google Maps.";
}

function once(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

export async function locateDevice(): Promise<GeoFix> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) throw { code: "unsupported" as const };
  if (!window.isSecureContext) throw { code: "insecure" as const };
  let pos: GeolocationPosition;
  try {
    pos = await once({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  } catch (err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) throw { code: 1 };
    try {
      pos = await once({ enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
    } catch (err2) {
      throw { code: (err2 as GeolocationPositionError).code ?? 3 };
    }
  }
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

export function geoErrorMessage(err: unknown): string {
  const code = (err as { code?: number | "insecure" | "unsupported" })?.code ?? 3;
  return geolocationHelp(code);
}
