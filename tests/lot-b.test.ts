/**
 * Lot B : réglages (TVA par zone, numérotation légale, identité et conformité, logo, PDF).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import { getDb, withTenant } from "@/db";
import { getSessionContext, signUp } from "@/server/auth";
import type { Ctx } from "@/server/clients";
import {
  allocateNumber,
  getSettings,
  resetTaxRates,
  saveLogo,
  saveTaxRate,
  setDefaultTaxRate,
  setTaxRateActive,
  SettingsError,
  updateIdentity,
  updatePayment,
  updateSeries,
  updateTaxSettings,
} from "@/server/settings";
import { lookupCompany } from "@/server/siret-lookup";
import { buildSampleQuote } from "@/server/pdf/sample";
import { computeTotals, renderDocumentPdf } from "@/server/pdf/document";
import { acceptInvitation, createInvitation } from "@/server/team";
import { checkCompliance } from "@/lib/compliance";
import { formatEuros, isValidIban, legalFormFromInsee, vatNumberFromSiren } from "@/lib/company";
import { formatDocNumber, nextCounter, validatePattern } from "@/lib/numbering";
import { formatRate, parseRate } from "@/lib/tax";
import { identityLine, paymentMentions } from "@/lib/legal-mentions";
import { ForbiddenError } from "@/lib/permissions";
import {
  acceptInvitationInput,
  identityInput,
  invitationInput,
  paymentInput,
  signUpInput,
  taxRateInput,
} from "@/lib/validation";

async function company(name: string, email: string, timezone: string) {
  const { token } = await signUp(signUpInput.parse({ orgName: name, fullName: "Patron", email, password: "motdepasse-solide", timezone }));
  const s = (await getSessionContext(token))!;
  return { orgId: s.orgId, userId: s.userId, permissions: s.permissions } as Ctx;
}

let gwada: Ctx;
let paris: Ctx;
let cayenne: Ctx;

beforeAll(async () => {
  gwada = await company("Froid Antilles", "b-gwada@test.fr", "America/Guadeloupe");
  paris = await company("Clim Paris", "b-paris@test.fr", "Europe/Paris");
  cayenne = await company("Froid Guyane", "b-cayenne@test.fr", "America/Cayenne");
});

describe("TVA par défaut selon la zone", () => {
  it("Guadeloupe : 8,5 % par défaut, 2,1 % travaux avec attestation, autoliquidation", async () => {
    const { taxRates } = await getSettings(gwada);
    expect(taxRates.map((r) => [r.rateBp, r.isDefault, r.requiresAttestation])).toEqual([
      [850, true, false],
      [210, false, true],
      [0, false, false],
    ]);
  });
  it("Métropole : 20 %, 10 % et 5,5 % avec attestation", async () => {
    const { taxRates } = await getSettings(paris);
    expect(taxRates.map((r) => r.rateBp)).toEqual([2000, 1000, 550, 0]);
  });
  it("Guyane : TVA non applicable avec la mention légale", async () => {
    const { taxRates } = await getSettings(cayenne);
    expect(taxRates).toHaveLength(1);
    expect(taxRates[0].mention).toMatch(/294-1/);
  });
  it("affiche et lit les taux à la française", () => {
    expect(formatRate(850)).toBe("8,5 %");
    expect(formatRate(2000)).toBe("20 %");
    expect(parseRate("2,1")).toBe(210);
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("120")).toBeNull();
  });
});

describe("gestion des taux", () => {
  it("ajoute un taux, change le défaut, interdit de désactiver le défaut, réinitialise", async () => {
    const { id } = await saveTaxRate(gwada, taxRateInput.parse({ label: "Taux spécial", rate: "1,75", kind: "particulier" }));
    await setDefaultTaxRate(gwada, id);
    let { taxRates } = await getSettings(gwada);
    expect(taxRates.find((r) => r.isDefault)?.rateBp).toBe(175);
    await expect(setTaxRateActive(gwada, id, false)).rejects.toBeInstanceOf(SettingsError);

    await resetTaxRates(gwada);
    ({ taxRates } = await getSettings(gwada));
    const active = taxRates.filter((r) => r.active);
    expect(active.map((r) => r.rateBp)).toEqual([850, 210, 0]);
    expect(taxRates.filter((r) => !r.active)).toHaveLength(4); // historique conservé
  });

  it("une autre entreprise ne peut pas toucher ces taux", async () => {
    const { taxRates } = await getSettings(gwada);
    await expect(
      saveTaxRate(paris, taxRateInput.parse({ id: taxRates[0].id, label: "Piraté", rate: "0", kind: "normal" })),
    ).rejects.toThrow("Taux introuvable");
    await expect(setDefaultTaxRate(paris, taxRates[1].id)).rejects.toThrow("Taux introuvable");
  });
});

describe("numérotation légale", () => {
  it("formate les jetons dans le fuseau de l'entreprise", () => {
    const lastMinute2026 = new Date("2027-01-01T03:30:00Z"); // 31/12/2026 23:30 en Guadeloupe
    expect(formatDocNumber("FAC-{AAAA}-{N}", 7, { padding: 4, date: lastMinute2026, timeZone: "America/Guadeloupe" })).toBe("FAC-2026-0007");
    expect(formatDocNumber("FAC-{AAAA}-{N}", 7, { padding: 4, date: lastMinute2026, timeZone: "Europe/Paris" })).toBe("FAC-2027-0007");
    expect(formatDocNumber("F{AA}{MM}/{N}", 12, { padding: 3, date: lastMinute2026, timeZone: "America/Guadeloupe" })).toBe("F2612/012");
  });

  it.each([
    ["FAC-{AAAA}", 4, "annuel", /compteur \{N\}/],
    ["FAC-{N}-{N}", 4, "annuel", /une seule fois/],
    ["FAC {AAAA}-{N}", 4, "annuel", /pas d'espace/],
    ["FAC-{N}", 4, "annuel", /l'année/],
    ["FAC-{JJ}-{N}", 4, "jamais", /Jetons reconnus/],
  ] as const)("refuse « %s »", (pattern, padding, reset, message) => {
    expect(validatePattern(pattern, padding, reset)).toMatch(message);
  });

  it("accepte un format sans année si le compteur ne repart jamais à zéro", () => {
    expect(validatePattern("FAC-{N}", 6, "jamais")).toBeNull();
  });

  it("remet le compteur à 1 au changement d'année", () => {
    expect(nextCounter({ lastNumber: 41, lastYear: 2026, reset: "annuel" }, 2027)).toBe(1);
    expect(nextCounter({ lastNumber: 41, lastYear: 2026, reset: "jamais" }, 2027)).toBe(42);
    expect(nextCounter({ lastNumber: 41, lastYear: 2026, reset: "annuel" }, 2026)).toBe(42);
  });

  it("attribue des numéros continus, sans doublon même en simultané, puis verrouille le format", async () => {
    const date = new Date("2026-11-09T15:00:00Z");
    const db = await getDb();
    const numbers = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.transaction(async (tx) => {
          await tx.execute(`select set_config('app.org_id', '${paris.orgId}', true)`);
          await tx.execute("set local role app_tenant");
          return allocateNumber(tx as never, paris.orgId, "facture", date, "Europe/Paris");
        }),
      ),
    );
    expect([...numbers].sort()).toEqual(Array.from({ length: 12 }, (_, i) => `FAC-2026-${String(i + 1).padStart(4, "0")}`));

    await expect(updateSeries(paris, { docType: "facture", pattern: "F-{AAAA}-{N}", padding: 4, reset: "annuel" })).rejects.toThrow(
      /ne peut plus être modifié/,
    );
    // Les autres séries restent modifiables.
    await expect(updateSeries(paris, { docType: "devis", pattern: "D{AA}-{N}", padding: 3, reset: "annuel" })).resolves.toBeUndefined();

    // Nouvelle année : le compteur repart à 1.
    const next = await withTenant(paris.orgId, (tx) => allocateNumber(tx, paris.orgId, "facture", new Date("2027-01-02T10:00:00Z"), "Europe/Paris"));
    expect(next).toBe("FAC-2027-0001");
  });
});

describe("identité légale et conformité", () => {
  it("liste ce qui manque, puis plus rien de bloquant une fois complété", async () => {
    let bundle = await getSettings(gwada);
    const issues = () =>
      checkCompliance({
        org: bundle.org,
        settings: bundle.settings,
        activeTaxRates: bundle.taxRates.filter((r) => r.active).length,
        hasLogo: !!bundle.logo,
      });
    expect(issues().filter((i) => i.level === "bloquant").map((i) => i.key)).toEqual(
      expect.arrayContaining(["legalForm", "siret", "address", "vatNumber", "insurance"]),
    );

    await updateIdentity(
      gwada,
      identityInput.parse({
        name: "Froid Antilles",
        legalForm: "SARL",
        siret: "73282932000074",
        shareCapital: "5 000",
        registration: "RCS Pointe-à-Pitre 732 829 320",
        vatNumber: vatNumberFromSiren("732829320"),
        addressLine1: "ZI de Jarry, rue Alfred Lumière",
        postalCode: "97122",
        city: "Baie-Mahault",
        phone: "0590 26 00 00",
        insurerName: "Assurances Caraïbes",
        insurancePolicy: "DEC-2026-123",
        insuranceCoverage: "Guadeloupe et îles du Nord",
      }),
    );
    bundle = await getSettings(gwada);
    expect(bundle.org.name).toBe("Froid Antilles");
    expect(bundle.settings.shareCapitalCents).toBe(500000);
    expect(issues().filter((i) => i.level === "bloquant")).toEqual([]);
    expect(issues().map((i) => i.key)).toEqual(expect.arrayContaining(["iban", "cgv", "logo", "fluid"]));

    const line = identityLine({ org: bundle.org, settings: bundle.settings });
    expect(line).toContain("SARL au capital de 5 000 €");
    expect(line).toContain("SIRET 732 829 320 00074");
    expect(line).toContain("RCS Pointe-à-Pitre");
    expect(line).toContain(`TVA ${vatNumberFromSiren("732829320")}`);
  });

  it("refuse un n° de TVA, un IBAN ou un délai de paiement illégal", () => {
    expect(identityInput.safeParse({ name: "X", vatNumber: "FR00732829320" }).success).toBe(false);
    const base = { paymentTermsDays: "30", latePenaltyText: "x", earlyPaymentDiscountText: "y", quoteValidityDays: "30", depositPercent: "30" };
    expect(paymentInput.safeParse({ ...base, iban: "FR76 3000 6000 0112 3456 7890 188" }).success).toBe(false);
    expect(paymentInput.safeParse({ ...base, paymentTermsDays: "90" }).success).toBe(false);
    expect(paymentInput.safeParse({ ...base, iban: "FR76 3000 6000 0112 3456 7890 189" }).success).toBe(true);
  });

  it("ajoute l'indemnité de 40 € pour un pro et les mentions de régime de TVA", async () => {
    await updateTaxSettings(gwada, { vatRegime: "reel", vatOnDebits: true });
    const b = await getSettings(gwada);
    const pro = paymentMentions({ org: b.org, settings: b.settings }, "facture", true);
    const part = paymentMentions({ org: b.org, settings: b.settings }, "facture", false);
    expect(pro.join(" ")).toMatch(/40 €/);
    expect(part.join(" ")).not.toMatch(/40 €/);
    expect(pro).toContain("Option pour le paiement de la taxe d'après les débits");
    await updateTaxSettings(gwada, { vatRegime: "franchise", vatOnDebits: true });
    const f = await getSettings(gwada);
    expect(f.settings.vatOnDebits).toBe(false);
    expect(paymentMentions({ org: f.org, settings: f.settings }, "facture", false)).toContain("TVA non applicable, art. 293 B du CGI");
    await updateTaxSettings(gwada, { vatRegime: "reel", vatOnDebits: false });
  });

  it("outils : TVA depuis le SIREN, IBAN, forme juridique INSEE, montants", () => {
    expect(vatNumberFromSiren("552100554")).toBe("FR96552100554");
    expect(isValidIban("FR7630006000011234567890189")).toBe(true);
    expect(isValidIban("FR7630006000011234567890188")).toBe(false);
    expect(legalFormFromInsee("5499")).toBe("SARL");
    expect(legalFormFromInsee("5720")).toBe("SASU");
    expect(legalFormFromInsee("1000")).toBe("EI");
    expect(formatEuros(123450)).toBe("1 234,50 €");
  });
});

describe("autorisations", () => {
  it("un membre sans « Modifier les réglages » ne voit ni ne change rien", async () => {
    const { token } = await createInvitation(gwada, invitationInput.parse({ fullName: "Tech", email: "b-tech@test.fr", permissions: ["clients.voir"] }));
    const s = (await getSessionContext((await acceptInvitation(acceptInvitationInput.parse({ token, fullName: "Tech", password: "motdepasse-tech" }))).token))!;
    const tech: Ctx = { orgId: s.orgId, userId: s.userId, permissions: s.permissions };
    await expect(getSettings(tech)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updatePayment(tech, paymentInput.parse({ paymentTermsDays: "0", latePenaltyText: "x", earlyPaymentDiscountText: "y", quoteValidityDays: "10", depositPercent: "0" }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

/** PNG valide minimal (couleur unie) pour les tests. */
function tinyPng(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x30)])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("logo et PDF", () => {
  it("refuse un fichier qui n'est pas une image, accepte un PNG", async () => {
    await expect(saveLogo(gwada, { data: Buffer.from("<svg></svg>"), width: 100, height: 50 })).rejects.toBeInstanceOf(SettingsError);
    await saveLogo(gwada, { data: tinyPng(120, 60), width: 120, height: 60 });
    expect((await getSettings(gwada)).logo).toMatchObject({ width: 120, height: 60, mime: "image/png" });
  });

  it("calcule les totaux par taux, arrondis au centime", () => {
    const t = computeTotals([
      { description: "A", quantity: 3, unit: "u", unitPriceCents: 3333, rateBp: 850 },
      { description: "B", quantity: 1.5, unit: "h", unitPriceCents: 5500, rateBp: 210 },
      { description: "Titre", section: true, quantity: 0, unit: "", unitPriceCents: 0, rateBp: 0 },
    ]);
    expect(t.totalHtCents).toBe(9999 + 8250);
    expect(t.vat).toEqual([
      { rateBp: 850, baseCents: 9999, vatCents: 850 },
      { rateBp: 210, baseCents: 8250, vatCents: 173 },
    ]);
    expect(t.totalTtcCents).toBe(18249 + 850 + 173);
  });

  it("produit un PDF d'aperçu à la charte, avec attestation de taux réduit et CGV", async () => {
    await updatePayment(
      gwada,
      paymentInput.parse({
        paymentTermsDays: "30",
        latePenaltyText: "Pénalités : 3 fois le taux légal.",
        earlyPaymentDiscountText: "Escompte : néant.",
        quoteValidityDays: "30",
        depositPercent: "30",
        iban: "FR7630006000011234567890189",
        cgv: "Article 1 – Objet. Les présentes conditions…",
      }),
    );
    const bundle = await getSettings(gwada);
    const logo = await withTenant(gwada.orgId, async (tx) => {
      const { companyLogos } = await import("@/db/schema");
      const [l] = await tx.select().from(companyLogos);
      return l;
    });
    const doc = buildSampleQuote(bundle, logo);
    expect(doc.attestation).toMatch(/preneur de la prestation/);
    expect(doc.footer.join(" ")).toContain("Assurance décennale : Assurances Caraïbes");
    expect(doc.lines.filter((l) => !l.section).map((l) => l.rateBp)).toEqual([210, 210, 210, 850]);
    const pdf = await renderDocumentPdf(doc);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(2); // devis sur 1 page + CGV
  });
});

describe("pré-remplissage depuis le SIRET", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("transforme la réponse de l'annuaire en identité légale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                siren: "732829320",
                nom_raison_sociale: "FROID ANTILLES",
                nature_juridique: "5499",
                activite_principale: "43.22B",
                etat_administratif: "A",
                complements: { est_entrepreneur_individuel: false },
                siege: { siret: "73282932000074", numero_voie: "12", type_voie: "RUE", libelle_voie: "ALFRED LUMIERE", code_postal: "97122", libelle_commune: "BAIE-MAHAULT", etat_administratif: "A" },
              },
            ],
          }),
        ),
      ),
    );
    expect(await lookupCompany("732 829 320 00074")).toEqual({
      name: "FROID ANTILLES",
      siret: "73282932000074",
      legalForm: "SARL",
      vatNumber: vatNumberFromSiren("732829320"),
      nafCode: "43.22B",
      addressLine1: "12 rue Alfred Lumiere",
      postalCode: "97122",
      city: "Baie-Mahault",
      closed: false,
    });
  });

  it("ignore un SIRET invalide ou une réponse sans rapport", async () => {
    expect(await lookupCompany("123")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ siren: "999999999" }] }))));
    expect(await lookupCompany("73282932000074")).toBeNull();
  });
});
