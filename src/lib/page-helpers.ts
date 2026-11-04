import "server-only";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/clients";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Charge une ressource ; id invalide ou ressource absente → page 404. */
export async function loadOr404<T>(id: string, load: () => Promise<T>): Promise<T> {
  if (!UUID.test(id)) notFound();
  try {
    return await load();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export function mapsUrl(s: { latitude: number | null; longitude: number | null; addressLine1: string; postalCode: string; city: string }) {
  const dest = s.latitude != null && s.longitude != null ? `${s.latitude},${s.longitude}` : `${s.addressLine1}, ${s.postalCode} ${s.city}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function wazeUrl(s: { latitude: number | null; longitude: number | null; addressLine1: string; postalCode: string; city: string }) {
  return s.latitude != null && s.longitude != null
    ? `https://waze.com/ul?ll=${s.latitude},${s.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(`${s.addressLine1}, ${s.postalCode} ${s.city}`)}&navigate=yes`;
}
