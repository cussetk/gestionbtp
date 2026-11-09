/**
 * Géocodage d'une adresse française (métropole et DOM) avec le service public
 * de la Géoplateforme (IGN, Base Adresse Nationale) : gratuit, sans clé, hébergé en France.
 * Ne bloque jamais l'enregistrement : en cas d'échec, la position reste vide.
 */
import type { LatLng } from "@/lib/geo";

const ENDPOINT = "https://data.geopf.fr/geocodage/search";
/** En dessous, le résultat est trop incertain (ex. seule la commune est reconnue). */
const MIN_SCORE = 0.45;

export type GeocodeResult = LatLng & { score: number; label: string };

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { score?: number; label?: string; postcode?: string };
};

export async function geocodeAddress(address: {
  addressLine1: string;
  postalCode: string;
  city: string;
}): Promise<GeocodeResult | null> {
  if (process.env.GEOCODING_DISABLED === "1") return null;
  const q = `${address.addressLine1} ${address.postalCode} ${address.city}`.trim();
  if (q.length < 6) return null;

  const url = `${ENDPOINT}?${new URLSearchParams({ q, postcode: address.postalCode, limit: "1", index: "address" })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: Feature[] };
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    const score = f?.properties?.score ?? 0;
    if (!coords || coords.length < 2 || score < MIN_SCORE) return null;
    if (f?.properties?.postcode && f.properties.postcode !== address.postalCode) return null;
    // GeoJSON : [longitude, latitude]
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, score, label: f?.properties?.label ?? q };
  } catch {
    return null;
  }
}
