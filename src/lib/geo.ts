/** Coordonnées GPS : lecture de ce que l'utilisateur colle (partagé serveur/navigateur). */

export type LatLng = { lat: number; lng: number };

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/**
 * Comprend :
 *  - « 16.2412, -61.5331 » ou « 16,2412 ; -61,5331 »
 *  - un lien Google Maps (…/@16.24,-61.53,17z… , ?q=16.24,-61.53 , ?ll=… , !3d16.24!4d-61.53)
 *  - un lien Apple Plans (?ll=… ou ?q=…), Waze (?ll=…), OpenStreetMap (#map=17/16.24/-61.53, mlat/mlon)
 *  - la position partagée par WhatsApp (lien Google Maps)
 */
export function parseCoordinates(input: string | null | undefined): LatLng | null {
  if (!input) return null;
  const text = decodeURIComponent(input.trim());
  if (!text) return null;

  const patterns: RegExp[] = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // Google : position exacte du repère
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // Google : centre de la carte
    /[?&](?:q|ll|query|destination|daddr|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/,
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return valid(Number(m[1]), Number(m[2]));
  }

  // Deux nombres seuls (virgule décimale française acceptée).
  const plain = text.match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (plain) return valid(Number(plain[1].replace(",", ".")), Number(plain[2].replace(",", ".")));
  return null;
}

export function formatCoordinates(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
