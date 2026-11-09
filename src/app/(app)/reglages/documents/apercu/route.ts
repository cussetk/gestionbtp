import { currentSession, toCtx } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getLogo, getSettings } from "@/server/settings";
import { buildSampleQuote } from "@/server/pdf/sample";
import { renderDocumentPdf } from "@/server/pdf/document";

/** Aperçu PDF d'un devis d'exemple avec la mise en page et les mentions de l'entreprise. */
export async function GET() {
  const session = await currentSession();
  if (!session || session.orgStatus !== "active" || !can(session, "reglages.gerer")) {
    return new Response("Accès refusé", { status: 403 });
  }
  const ctx = toCtx(session);
  const [bundle, logo] = await Promise.all([getSettings(ctx), getLogo(ctx)]);
  const pdf = await renderDocumentPdf(buildSampleQuote(bundle, logo));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="apercu-devis.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
