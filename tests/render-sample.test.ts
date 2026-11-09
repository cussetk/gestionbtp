import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { getSessionContext, signUp } from "@/server/auth";
import { getSettings, updateIdentity, updatePayment } from "@/server/settings";
import { buildSampleQuote } from "@/server/pdf/sample";
import { renderDocumentPdf } from "@/server/pdf/document";
import { identityInput, paymentInput, signUpInput } from "@/lib/validation";
import { vatNumberFromSiren } from "@/lib/company";

it.skipIf(!process.env.RENDER_OUT)("rend l'aperçu", async () => {
  const { token } = await signUp(signUpInput.parse({ orgName: "Froid Antilles", fullName: "P", email: "r@test.fr", password: "motdepasse-solide", timezone: "America/Guadeloupe" }));
  const s = (await getSessionContext(token))!;
  const ctx = { orgId: s.orgId, userId: s.userId, permissions: s.permissions };
  await updateIdentity(ctx, identityInput.parse({ name: "Froid Antilles", legalForm: "SARL", siret: "73282932000074", shareCapital: "5000", registration: "RCS Pointe-à-Pitre 732 829 320", vatNumber: vatNumberFromSiren("732829320"), addressLine1: "ZI de Jarry, rue Alfred Lumière", postalCode: "97122", city: "Baie-Mahault", phone: "0590260000", email: "contact@froid-antilles.fr", insurerName: "Assurances Caraïbes", insurerAddress: "1 bd Légitimus, 97110 Pointe-à-Pitre", insurancePolicy: "DEC-2026-123", insuranceCoverage: "Guadeloupe et îles du Nord" }));
  await updatePayment(ctx, paymentInput.parse({ paymentTermsDays: "30", latePenaltyText: "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur.", earlyPaymentDiscountText: "Escompte pour paiement anticipé : néant.", quoteValidityDays: "30", depositPercent: "30", iban: "FR7630006000011234567890189", bankName: "Banque des Antilles", cgv: "Article 1 – Objet.\nLes présentes conditions s'appliquent à toutes les prestations." }));
  for (const template of ["moderne", "classique", "epure"] as const) {
    const b = await getSettings(ctx);
    const { readFileSync } = await import("node:fs");
    const png = readFileSync("public/icon-512.png");
    const doc = buildSampleQuote({ ...b, settings: { ...b.settings, template } }, { data: png, mime: "image/png", width: 512, height: 512 });
    writeFileSync(`${process.env.RENDER_OUT}/apercu-${template}.pdf`, await renderDocumentPdf(doc));
  }
});
