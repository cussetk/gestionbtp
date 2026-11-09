/**
 * Modèle PDF des devis et factures, à la charte de l'entreprise.
 * Utilisé par l'aperçu des réglages (données d'exemple) et par les vrais documents (lot D),
 * pour que l'aperçu soit exactement le document final.
 */
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatEuros } from "@/lib/company";
import { formatRate } from "@/lib/tax";

export type DocLine = {
  description: string;
  details?: string | null;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  rateBp: number;
  /** Ligne de section (titre) sans montant. */
  section?: boolean;
};

export type DocData = {
  kind: "devis" | "facture";
  title: string;
  number: string;
  issueDate: string;
  extraDates: { label: string; value: string }[];
  company: {
    name: string;
    addressLines: string[];
    contactLines: string[];
    logo: { data: Buffer; format: "png" | "jpg"; width: number; height: number } | null;
  };
  client: { name: string; lines: string[] };
  site: { label: string; lines: string[] } | null;
  subject: string | null;
  lines: DocLine[];
  /** Mentions imprimées sous les totaux (paiement, TVA particulière…). */
  mentions: string[];
  /** Pied de page légal (identité, assurance). */
  footer: string[];
  notes: string | null;
  attestation: string | null;
  signature: boolean;
  bank: string | null;
  cgv: string | null;
  style: {
    primaryColor: string;
    accentColor: string;
    template: "classique" | "moderne" | "epure";
    logoPosition: "gauche" | "centre" | "droite";
    font: "helvetica" | "times";
  };
};

export function computeTotals(lines: DocLine[]) {
  const byRate = new Map<number, { baseCents: number; vatCents: number }>();
  let totalHt = 0;
  for (const l of lines) {
    if (l.section) continue;
    const base = Math.round(l.quantity * l.unitPriceCents);
    totalHt += base;
    const entry = byRate.get(l.rateBp) ?? { baseCents: 0, vatCents: 0 };
    entry.baseCents += base;
    byRate.set(l.rateBp, entry);
  }
  let totalVat = 0;
  for (const [rate, entry] of byRate) {
    entry.vatCents = Math.round((entry.baseCents * rate) / 10000);
    totalVat += entry.vatCents;
  }
  return {
    totalHtCents: totalHt,
    vat: [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rateBp, v]) => ({ rateBp, ...v })),
    totalVatCents: totalVat,
    totalTtcCents: totalHt + totalVat,
  };
}

function qty(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/ | /g, " ");
}

function fonts(font: DocData["style"]["font"]) {
  return font === "times" ? { regular: "Times-Roman", bold: "Times-Bold" } : { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function makeStyles(d: DocData) {
  const f = fonts(d.style.font);
  const p = d.style.primaryColor;
  const ink = d.style.accentColor;
  const t = d.style.template;
  return StyleSheet.create({
    page: { fontFamily: f.regular, fontSize: 9, color: ink, paddingTop: 32, paddingBottom: 62, paddingHorizontal: 40, lineHeight: 1.3 },
    bold: { fontFamily: f.bold },
    band: { position: "absolute", top: 0, left: 0, right: 0, height: t === "moderne" ? 8 : 0, backgroundColor: p },
    header: {
      flexDirection: d.style.logoPosition === "droite" ? "row-reverse" : d.style.logoPosition === "centre" ? "column" : "row",
      alignItems: d.style.logoPosition === "centre" ? "center" : "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
    },
    companyBlock: { maxWidth: 260, textAlign: d.style.logoPosition === "droite" ? "left" : d.style.logoPosition === "centre" ? "center" : "right" },
    companyName: { fontFamily: f.bold, fontSize: 12, color: t === "epure" ? ink : p, marginBottom: 2 },
    muted: { color: "#5b6773" },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingBottom: 8,
      marginBottom: 12,
      borderBottomWidth: t === "classique" ? 1.5 : t === "epure" ? 0.5 : 0,
      borderBottomColor: t === "classique" ? ink : "#c9d2da",
    },
    title: { fontFamily: f.bold, fontSize: t === "epure" ? 18 : 20, lineHeight: 1.15, color: t === "epure" ? ink : p },
    number: { fontFamily: f.bold, fontSize: 11, marginTop: 3 },
    parties: { flexDirection: "row", gap: 16, marginBottom: 12 },
    party: {
      flex: 1,
      padding: t === "epure" ? 0 : 8,
      borderRadius: t === "moderne" ? 4 : 0,
      backgroundColor: t === "moderne" ? "#f3f6f8" : undefined,
      borderWidth: t === "classique" ? 0.75 : 0,
      borderColor: "#c9d2da",
    },
    partyLabel: { fontSize: 7.5, color: "#5b6773", marginBottom: 3 },
    subject: { marginBottom: 10 },
    th: {
      flexDirection: "row",
      backgroundColor: t === "moderne" ? p : undefined,
      color: t === "moderne" ? "#ffffff" : ink,
      borderBottomWidth: t === "moderne" ? 0 : 1,
      borderBottomColor: ink,
      paddingVertical: 5,
      paddingHorizontal: 4,
      fontFamily: f.bold,
      fontSize: 8,
    },
    tr: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#dfe5ea" },
    section: { paddingVertical: 4, paddingHorizontal: 4, fontFamily: f.bold, color: p, borderBottomWidth: 0.5, borderBottomColor: "#dfe5ea" },
    cDesc: { flex: 1, paddingRight: 6 },
    cQty: { width: 46, textAlign: "right" },
    cUnit: { width: 34, paddingLeft: 4 },
    cPu: { width: 64, textAlign: "right" },
    cVat: { width: 40, textAlign: "right" },
    cTotal: { width: 70, textAlign: "right" },
    details: { fontSize: 8, color: "#5b6773", marginTop: 1 },
    totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
    totals: { width: 220 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
    grand: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
      paddingVertical: 6,
      paddingHorizontal: 6,
      backgroundColor: t === "epure" ? undefined : p,
      color: t === "epure" ? ink : "#ffffff",
      borderTopWidth: t === "epure" ? 1 : 0,
      borderTopColor: ink,
      fontFamily: f.bold,
      fontSize: 11,
    },
    block: { marginTop: 10 },
    blockTitle: { fontFamily: f.bold, marginBottom: 3 },
    small: { fontSize: 8 },
    conditionsRow: { marginTop: 10, flexDirection: "row", gap: 16, alignItems: "flex-start" },
    signBox: { flex: 1, height: 78, borderWidth: 0.75, borderColor: "#9aa7b2", padding: 6, borderRadius: t === "moderne" ? 4 : 0 },
    attestation: { marginTop: 10, padding: 7, borderWidth: 0.75, borderColor: p, borderRadius: t === "moderne" ? 4 : 0 },
    footer: { position: "absolute", bottom: 22, left: 40, right: 40, fontSize: 7, color: "#5b6773", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#c9d2da", paddingTop: 5 },
    pageNum: { position: "absolute", bottom: 10, right: 40, fontSize: 7, color: "#9aa7b2" },
  });
}

function QuotePdf({ d }: { d: DocData }) {
  const s = makeStyles(d);
  const totals = computeTotals(d.lines);
  const logo = d.company.logo;
  const logoH = 52;
  const logoW = logo ? Math.min(170, (logo.width / logo.height) * logoH) : 0;

  return (
    <Document title={`${d.title} ${d.number}`} author={d.company.name} language="fr">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <View style={s.header}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf : pas d'attribut alt
            <Image src={{ data: logo.data, format: logo.format }} style={{ width: logoW, height: logoH, objectFit: "contain" }} />
          ) : (
            <View />
          )}
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{d.company.name}</Text>
            {d.company.addressLines.map((l) => (
              <Text key={l}>{l}</Text>
            ))}
            {d.company.contactLines.map((l) => (
              <Text key={l} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>{d.title}</Text>
            <Text style={s.number}>N° {d.number}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>Date : {d.issueDate}</Text>
            {d.extraDates.map((x) => (
              <Text key={x.label}>
                {x.label} : {x.value}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Client</Text>
            <Text style={s.bold}>{d.client.name}</Text>
            {d.client.lines.map((l) => (
              <Text key={l}>{l}</Text>
            ))}
          </View>
          {d.site && (
            <View style={s.party}>
              <Text style={s.partyLabel}>Lieu d&apos;intervention</Text>
              <Text style={s.bold}>{d.site.label}</Text>
              {d.site.lines.map((l) => (
                <Text key={l}>{l}</Text>
              ))}
            </View>
          )}
        </View>

        {d.subject && (
          <Text style={s.subject}>
            <Text style={s.bold}>Objet : </Text>
            {d.subject}
          </Text>
        )}

        <View style={s.th}>
          <Text style={s.cDesc}>Désignation</Text>
          <Text style={s.cQty}>Qté</Text>
          <Text style={s.cUnit}>Unité</Text>
          <Text style={s.cPu}>PU HT</Text>
          <Text style={s.cVat}>TVA</Text>
          <Text style={s.cTotal}>Total HT</Text>
        </View>
        {d.lines.map((l, i) =>
          l.section ? (
            <Text key={i} style={s.section} wrap={false}>
              {l.description}
            </Text>
          ) : (
            <View key={i} style={s.tr} wrap={false}>
              <View style={s.cDesc}>
                <Text>{l.description}</Text>
                {l.details && <Text style={s.details}>{l.details}</Text>}
              </View>
              <Text style={s.cQty}>{qty(l.quantity)}</Text>
              <Text style={s.cUnit}>{l.unit}</Text>
              <Text style={s.cPu}>{formatEuros(l.unitPriceCents)}</Text>
              <Text style={s.cVat}>{formatRate(l.rateBp)}</Text>
              <Text style={s.cTotal}>{formatEuros(Math.round(l.quantity * l.unitPriceCents))}</Text>
            </View>
          ),
        )}

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text>Total HT</Text>
              <Text>{formatEuros(totals.totalHtCents)}</Text>
            </View>
            {totals.vat.map((v) => (
              <View key={v.rateBp} style={s.totalRow}>
                <Text>
                  TVA {formatRate(v.rateBp)} sur {formatEuros(v.baseCents)}
                </Text>
                <Text>{formatEuros(v.vatCents)}</Text>
              </View>
            ))}
            <View style={s.grand}>
              <Text>Total TTC</Text>
              <Text>{formatEuros(totals.totalTtcCents)}</Text>
            </View>
          </View>
        </View>

        {d.notes && (
          <View style={s.block} wrap={false}>
            <Text>{d.notes}</Text>
          </View>
        )}

        <View style={s.conditionsRow} wrap={false}>
          <View style={{ flex: 1.35 }}>
            {d.mentions.length > 0 && (
              <>
                <Text style={s.blockTitle}>Conditions</Text>
                {d.mentions.map((m) => (
                  <Text key={m} style={s.small}>
                    {m}
                  </Text>
                ))}
                {d.bank && <Text style={s.small}>{d.bank}</Text>}
              </>
            )}
          </View>
          {d.signature && (
            <View style={s.signBox}>
              <Text style={[s.small, s.bold]}>Bon pour accord</Text>
              <Text style={[s.small, s.muted]}>Date, nom, signature et mention « Devis reçu avant l&apos;exécution des travaux »</Text>
            </View>
          )}
        </View>

        {d.attestation && (
          <View style={s.attestation} wrap={false}>
            <Text style={s.blockTitle}>Attestation du client pour l&apos;application du taux réduit de TVA</Text>
            <Text style={{ fontSize: 7.5 }}>{d.attestation}</Text>
            <Text style={[s.small, { marginTop: 4 }]}>Date et signature du client :</Text>
            <View style={{ height: 22 }} />
          </View>
        )}

        <View style={s.footer} fixed>
          {d.footer.map((f) => (
            <Text key={f}>{f}</Text>
          ))}
        </View>
        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {d.cgv && (
        <Page size="A4" style={s.page}>
          <View style={s.band} fixed />
          <Text style={[s.title, { fontSize: 14, marginBottom: 10 }]}>Conditions générales de vente</Text>
          <Text style={{ fontSize: 8, lineHeight: 1.45 }}>{d.cgv}</Text>
          <View style={s.footer} fixed>
            {d.footer.map((f) => (
              <Text key={f}>{f}</Text>
            ))}
          </View>
          <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      )}
    </Document>
  );
}

export async function renderDocumentPdf(d: DocData): Promise<Buffer> {
  return renderToBuffer(<QuotePdf d={d} />);
}
