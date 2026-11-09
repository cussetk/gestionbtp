/** Formats de date en français, dans le fuseau de l'entreprise. */
export function formatDate(d: Date | string | null | undefined, timeZone = "Europe/Paris"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined, timeZone = "Europe/Paris"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(d));
}
