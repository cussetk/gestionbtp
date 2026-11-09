import { currentSession } from "@/lib/session";
import { getLogo } from "@/server/settings";

/** Logo de l'entreprise de l'utilisateur connecté. */
export async function GET() {
  const session = await currentSession();
  if (!session) return new Response("Accès refusé", { status: 403 });
  const logo = await getLogo({ orgId: session.orgId });
  if (!logo) return new Response("Aucun logo", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: { "Content-Type": logo.mime, "Cache-Control": "private, max-age=3600", ETag: logo.sha256 },
  });
}
