/**
 * Géocodage d'une adresse française (métropole et DOM) avec le service public
 * de la Géoplateforme (IGN, Base Adresse Nationale) : gratuit, sans clé, hébergé en France.
 * Ne bloque jamais l'enregistrement : en cas d'échec, la position reste vide.
 */
import type { LatLng } from "@/lib/geo";
import { normalizeSearch } from "@/lib/text";

const ENDPOINT = "https://data.geopf.fr/geocodage/search";
/**
 * Score minimal du service. Il ne suffit pas seul (relevés réels en Guadeloupe, nov. 2026) :
 *  - « 10 rue Frébault, Pointe-à-Pitre » → « Rue du Général Frébault », 0,68 : correct ;
 *  - « 12 rue des Flamboyants, Baie-Mahault » → « Rue des Fougères », 0,58 : faux.
 * D'où la vérification complémentaire du nom de la voie (sameStreet).
 */
const MIN_SCORE = 0.5;
/** Types acceptés : numéro, voie ou lieu-dit. Une commune seule est trop imprécise. */
const ACCEPTED_TYPES = new Set(["housenumber", "street", "locality"]);

export type GeocodeResult = LatLng & { score: number; label: string };

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { score?: number; label?: string; postcode?: string; type?: string; street?: string; name?: string };
};

/** Mots significatifs d'un nom de voie (sans « rue », « de », accents…). */
function streetWords(value: string): string[] {
  const stop = new Set(["rue", "avenue", "av", "bd", "boulevard", "chemin", "route", "rte", "allee", "impasse", "place", "lotissement", "lot", "residence", "res", "cite", "de", "des", "du", "la", "le", "les", "l", "d", "et"]);
  return normalizeSearch(value)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !stop.has(w) && !/^\d/.test(w));
}

/** Au moins un mot significatif de la voie saisie se retrouve dans le résultat. */
function sameStreet(input: string, found: string | undefined): boolean {
  const wanted = streetWords(input);
  if (wanted.length === 0 || !found) return true;
  const got = new Set(streetWords(found));
  return wanted.some((w) => got.has(w));
}

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
    const props = f?.properties ?? {};
    if (props.type && !ACCEPTED_TYPES.has(props.type)) return null;
    if (props.postcode && props.postcode !== address.postalCode) return null;
    if (!sameStreet(address.addressLine1, props.street ?? props.name ?? props.label)) return null;
    // GeoJSON : [longitude, latitude]
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, score, label: f?.properties?.label ?? q };
  } catch {
    return null;
  }
}
