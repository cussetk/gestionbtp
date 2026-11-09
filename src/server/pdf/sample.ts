/**
 * Devis d'exemple pour l'aperçu des réglages : vraies informations de l'entreprise,
 * client et lignes fictifs mais réalistes (pose d'un climatiseur).
 */
import "server-only";
import { formatIban } from "@/lib/company";
import { formatDocNumber } from "@/lib/numbering";
import { REDUCED_RATE_ATTESTATION } from "@/lib/tax";
import { companyAddress, identityLine, insuranceLine, paymentMentions, type MentionsInput } from "@/lib/legal-mentions";
import { formatPhone } from "@/lib/text";
import type { SettingsBundle } from "../settings";
import type { DocData, DocLine } from "./document";

function frDate(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone }).format(d);
}

export function buildSampleQuote(
  bundle: SettingsBundle,
  logo: { data: Buffer; mime: string; width: number; height: number } | null,
): DocData {
  const { org, settings: s } = bundle;
  const tz = org.timezone;
  const rates = bundle.taxRates.filter((r) => r.active);
  const normal = rates.find((r) => r.isDefault) ?? rates[0];
  const reduced = rates.find((r) => r.requiresAttestation);
  const franchise = s.vatRegime === "franchise";
  const rate = (r?: { rateBp: number }) => (franchise ? 0 : (r?.rateBp ?? 0));

  const lines: DocLine[] = [
    { description: "Fourniture", section: true, quantity: 0, unit: "", unitPriceCents: 0, rateBp: 0 },
    {
      description: "Climatiseur mural inverter 3,5 kW (R32)",
      details: "Unité intérieure + unité extérieure, télécommande",
      quantity: 1,
      unit: "u",
      unitPriceCents: 89000,
      rateBp: rate(reduced ?? normal),
    },
    {
      description: "Liaisons frigorifiques cuivre isolées 1/4 - 3/8",
      details: "Longueur estimée",
      quantity: 5,
      unit: "m",
      unitPriceCents: 2200,
      rateBp: rate(reduced ?? normal),
    },
    { description: "Main-d'œuvre", section: true, quantity: 0, unit: "", unitPriceCents: 0, rateBp: 0 },
    {
      description: "Pose et mise en service",
      details: "Tirage au vide, contrôle d'étanchéité, essais",
      quantity: 4,
      unit: "h",
      unitPriceCents: 5500,
      rateBp: rate(reduced ?? normal),
    },
    { description: "Déplacement", quantity: 1, unit: "forfait", unitPriceCents: 3500, rateBp: rate(normal) },
  ];

  const now = new Date();
  const validUntil = new Date(now.getTime() + s.quoteValidityDays * 86_400_000);
  const series = bundle.series.find((x) => x.docType === "devis");
  const number = series
    ? formatDocNumber(series.pattern, series.lastNumber + 1, { padding: series.padding, date: now, timeZone: tz })
    : "DEV-0001";

  const mentionsInput: MentionsInput = { org, settings: s };
  const mentions = paymentMentions(mentionsInput, "devis", false);
  if (s.depositPercent > 0) mentions.unshift(`Acompte de ${s.depositPercent} % à la signature du devis.`);
  const extraRateMentions = rates
    .filter((r) => r.mention && lines.some((l) => !l.section && l.rateBp === r.rateBp && r.kind !== "normal"))
    .map((r) => r.mention!);
  mentions.push(...extraRateMentions);

  const contact = [org.phone ? `Tél. ${formatPhone(org.phone)}` : null, org.email, s.website].filter(Boolean) as string[];
  const address = companyAddress(org);

  return {
    kind: "devis",
    title: "Devis",
    number,
    issueDate: frDate(now, tz),
    extraDates: [{ label: "Valable jusqu'au", value: frDate(validUntil, tz) }],
    company: {
      name: s.tradeName ?? org.name,
      addressLines: address ? [address] : [],
      contactLines: contact,
      logo: logo ? { data: logo.data, format: logo.mime === "image/png" ? "png" : "jpg", width: logo.width, height: logo.height } : null,
    },
    client: { name: "Mme Marie EXEMPLE", lines: ["12 rue des Flamboyants", "97122 Baie-Mahault"] },
    site: { label: "Domicile", lines: ["12 rue des Flamboyants", "97122 Baie-Mahault"] },
    subject: "Fourniture et pose d'un climatiseur dans la chambre parentale",
    lines,
    mentions,
    footer: [identityLine(mentionsInput), insuranceLine(mentionsInput)].filter(Boolean) as string[],
    notes: s.quoteFooter,
    attestation: !franchise && reduced ? REDUCED_RATE_ATTESTATION : null,
    signature: true,
    bank: s.iban ? `Règlement par virement : ${s.bankName ? `${s.bankName}, ` : ""}IBAN ${formatIban(s.iban)}${s.bic ? `, BIC ${s.bic}` : ""}` : null,
    cgv: s.cgv,
    style: { primaryColor: s.primaryColor, accentColor: s.accentColor, template: s.template, logoPosition: s.logoPosition, font: s.font },
  };
}
