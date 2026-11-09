/**
 * Lot C : fournisseurs, catalogue (prix, coefficients, droits sur les prix d'achat), import de grilles.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@/db";
import { catalogItems } from "@/db/schema";
import { getSessionContext, signUp } from "@/server/auth";
import type { Ctx } from "@/server/clients";
import { acceptInvitation, createInvitation } from "@/server/team";
import { archiveSupplier, createSupplier, getSupplier, listSuppliers, updateSupplier } from "@/server/suppliers";
import { archiveItem, createItem, getItem, itemFormOptions, listItems, updateDefaultCoef, updateItem } from "@/server/catalog";
import { abandonImport, applyImport, createImportDraft, getImport, ImportError, matchRows } from "@/server/catalog-import";
import { ForbiddenError } from "@/lib/permissions";
import { guessUnit, margin, parseCoef, parseEuros, priceChangePercent, salePriceFromCoef } from "@/lib/catalog";
import { detectHeaderRow, guessMapping, parseCsv, rowsFromTable, type ImportRow } from "@/lib/catalog-import";
import {
  acceptInvitationInput,
  importApplyInput,
  invitationInput,
  itemInput,
  signUpInput,
  supplierInput,
} from "@/lib/validation";

async function company(name: string, email: string) {
  const { token } = await signUp(
    signUpInput.parse({ orgName: name, fullName: "Patron", email, password: "motdepasse-solide", timezone: "America/Guadeloupe" }),
  );
  const s = (await getSessionContext(token))!;
  return { orgId: s.orgId, userId: s.userId, permissions: s.permissions } as Ctx;
}

async function member(owner: Ctx, email: string, permissions: string[]): Promise<Ctx> {
  const { token } = await createInvitation(owner, invitationInput.parse({ fullName: "Membre", email, permissions }));
  const s = (await getSessionContext((await acceptInvitation(acceptInvitationInput.parse({ token, fullName: "Membre", password: "motdepasse-membre" }))).token))!;
  return { orgId: s.orgId, userId: s.userId, permissions: s.permissions };
}

let owner: Ctx;
let other: Ctx;
let tech: Ctx;
let secretary: Ctx;

beforeAll(async () => {
  owner = await company("Clim Caraïbes", "c-owner@test.fr");
  other = await company("Autre Froid", "c-other@test.fr");
  tech = await member(owner, "c-tech@test.fr", ["catalogue.voir"]);
  secretary = await member(owner, "c-sec@test.fr", ["catalogue.voir", "catalogue.modifier"]);
});

describe("calculs de prix", () => {
  it("lit les montants écrits à la française ou à l'anglaise", () => {
    expect(parseEuros("1 234,56 €")).toBe(123456);
    expect(parseEuros("1.234,56")).toBe(123456);
    expect(parseEuros("1,234.56")).toBe(123456);
    expect(parseEuros("12")).toBe(1200);
    expect(parseEuros("0,5")).toBe(50);
    expect(parseEuros(899.9)).toBe(89990);
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("-5")).toBeNull();
  });

  it("coefficient, prix de vente et marge", () => {
    expect(parseCoef("1,4")).toBe(1400);
    expect(parseCoef("x1.35")).toBe(1350);
    expect(parseCoef("0")).toBeNull();
    expect(salePriceFromCoef(89990, 1400)).toBe(125986);
    expect(margin(100000, 140000)).toEqual({ amount: 40000, rate: 40000 / 140000 });
    expect(priceChangePercent(10000, 10500)).toBe(5);
  });

  it("reconnaît les unités des grilles", () => {
    expect(guessUnit("Pce")).toBe("u");
    expect(guessUnit("ML")).toBe("m");
    expect(guessUnit("m²")).toBe("m2");
    expect(guessUnit("Forfait")).toBe("forfait");
    expect(guessUnit("boîte")).toBeNull();
  });
});

describe("validation d'un article", () => {
  it("prix au coefficient : prix de vente calculé", () => {
    const v = itemInput.parse({ kind: "produit", name: "Split 2,5 kW", unit: "u", pricingMode: "coef", purchasePrice: "899,90", coef: "1,4" });
    expect(v.salePriceCents).toBe(125986);
    expect(v.coefX1000).toBe(1400);
  });
  it("prix au coefficient sans prix d'achat : refusé", () => {
    const r = itemInput.safeParse({ kind: "produit", name: "Split", unit: "u", pricingMode: "coef", coef: "1,4" });
    expect(r.success).toBe(false);
  });
  it("prix fixe : prix de vente obligatoire", () => {
    expect(itemInput.safeParse({ kind: "main_oeuvre", name: "Heure", unit: "h", pricingMode: "fixe" }).success).toBe(false);
    expect(itemInput.parse({ kind: "main_oeuvre", name: "Heure", unit: "h", pricingMode: "fixe", salePrice: "55" }).salePriceCents).toBe(5500);
  });
});

describe("fournisseurs", () => {
  it("création, recherche, modification, archivage, isolation", async () => {
    const { id } = await createSupplier(owner, supplierInput.parse({ name: "Clim Distribution Jarry", phone: "0590 26 00 00", city: "Baie-Mahault", customerAccount: "C-4421" }));
    expect((await listSuppliers(owner, { q: "jarry" })).map((s) => s.id)).toContain(id);
    expect((await listSuppliers(owner, { q: "4421" })).map((s) => s.id)).toContain(id);
    await updateSupplier(owner, id, supplierInput.parse({ name: "Clim Distribution", city: "Baie-Mahault" }));
    expect((await getSupplier(owner, id)).supplier.name).toBe("Clim Distribution");
    await expect(getSupplier(other, id)).rejects.toThrow("introuvable");
    expect(await listSuppliers(other)).toEqual([]);
    await archiveSupplier(owner, id);
    expect((await listSuppliers(owner)).map((s) => s.id)).not.toContain(id);
  });

  it("refusés sans le droit achats", async () => {
    await expect(listSuppliers(tech)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createSupplier(secretary, supplierInput.parse({ name: "X" }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("catalogue et confidentialité des prix d'achat", () => {
  let supplierId: string;
  let itemId: string;

  beforeAll(async () => {
    supplierId = (await createSupplier(owner, supplierInput.parse({ name: "Frigo Pro" }))).id;
    const opts = await itemFormOptions(owner);
    itemId = (
      await createItem(
        owner,
        itemInput.parse({
          kind: "produit",
          name: "Climatiseur mural 2,5 kW",
          brand: "Daikin",
          category: "Climatiseurs muraux",
          unit: "u",
          pricingMode: "coef",
          purchasePrice: "800",
          coef: "1,5",
          supplierId,
          supplierRef: "FTXM25R",
          taxRateId: opts.taxRates.find((t) => t.isDefault)!.id,
          trackSerial: "on",
        }),
      )
    ).id;
  });

  it("le propriétaire voit achat, coefficient, fournisseur et l'historique", async () => {
    const d = await getItem(owner, itemId);
    expect(d.item.purchasePriceCents).toBe(80000);
    expect(d.item.salePriceCents).toBe(120000);
    expect(d.item.supplierName).toBe("Frigo Pro");
    expect(d.taxRate?.rateBp).toBe(850);
    expect(d.history).toHaveLength(1);
    expect(d.history[0].source).toBe("creation");
  });

  it("un technicien voit le prix de vente mais jamais l'achat ni la marge", async () => {
    const list = await listItems(tech, { q: "daikin" });
    expect(list).toHaveLength(1);
    expect(list[0].salePriceCents).toBe(120000);
    expect(list[0].purchasePriceCents).toBeNull();
    expect(list[0].coefX1000).toBeNull();
    expect(list[0].supplierName).toBeNull();
    const d = await getItem(tech, itemId);
    expect(d.item.purchasePriceCents).toBeNull();
    expect(d.history.every((h) => h.purchasePriceCents === null)).toBe(true);
    await expect(createItem(tech, itemInput.parse({ kind: "produit", name: "X", unit: "u", salePrice: "1" }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("le secrétariat (sans prix d'achat) change le prix de vente : l'achat est conservé et le prix devient fixe", async () => {
    await updateItem(
      secretary,
      itemId,
      itemInput.parse({ kind: "produit", name: "Climatiseur mural 2,5 kW", unit: "u", pricingMode: "fixe", salePrice: "1290" }),
    );
    const d = await getItem(owner, itemId);
    expect(d.item.purchasePriceCents).toBe(80000);
    expect(d.item.supplierId).toBe(supplierId);
    expect(d.item.salePriceCents).toBe(129000);
    expect(d.item.pricingMode).toBe("fixe");
    expect(d.history[0].source).toBe("manuel");
  });

  it("le secrétariat ne peut pas importer de grille", async () => {
    await expect(createImportDraft(secretary, { supplierId: null, source: "fichier", fileName: null, rows: [] })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("isolation : une autre entreprise ne voit pas l'article", async () => {
    expect(await listItems(other)).toEqual([]);
    await expect(getItem(other, itemId)).rejects.toThrow("introuvable");
    await expect(
      createItem(other, itemInput.parse({ kind: "produit", name: "Pirate", unit: "u", pricingMode: "fixe", salePrice: "1", supplierId })),
    ).rejects.toThrow("Fournisseur inconnu");
  });

  it("coefficient par défaut réglable", async () => {
    await updateDefaultCoef(owner, 1350);
    expect((await itemFormOptions(owner)).defaultCoefX1000).toBe(1350);
    await expect(updateDefaultCoef(secretary, 1200)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("archivage", async () => {
    const { id } = await createItem(owner, itemInput.parse({ kind: "prestation", name: "Mise en service", unit: "forfait", pricingMode: "fixe", salePrice: "90" }));
    await archiveItem(owner, id);
    expect((await listItems(owner)).map((i) => i.id)).not.toContain(id);
  });
});

describe("lecture de grilles (CSV / Excel)", () => {
  it("détecte l'en-tête et les colonnes, préfère le prix net", () => {
    const rows = parseCsv(
      [
        "Tarif 2027 — Clim Distribution",
        "",
        "Code article;Désignation;Marque;UV;Prix public HT;Prix net HT;Famille",
        'FTXM25R;"Unité murale 2,5 kW";Daikin;U;1 120,00;812,50;Muraux',
        "LF14;Liaison frigo 1/4 3/8;Sanha;ML;12,90;7,45;Liaisons",
        ";Ligne sans prix;;;;;",
      ].join("\n"),
    );
    const h = detectHeaderRow(rows);
    expect(h).toBe(1); // la ligne vide est retirée
    const map = guessMapping(rows[h]);
    expect(map.supplierRef).toBe(0);
    expect(map.name).toBe(1);
    expect(map.price).toBe(5);
    const out = rowsFromTable(rows, h, map);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ supplierRef: "FTXM25R", name: "Unité murale 2,5 kW", purchasePriceCents: 81250, unit: "u", category: "Muraux" });
    expect(out[1]).toMatchObject({ unit: "m", purchasePriceCents: 745 });
    expect(out[2].purchasePriceCents).toBeNull();
    expect(out[2].warnings?.[0]).toContain("Prix");
  });

  it("applique une remise sur des prix publics", () => {
    const rows = [["Réf", "Désignation", "Tarif"], ["A1", "Support mural", 50]];
    const out = rowsFromTable(rows, 0, guessMapping(rows[0]), 30);
    expect(out[0].purchasePriceCents).toBe(3500);
  });
});

describe("import de grille : brouillon, validation, application", () => {
  let supplierId: string;
  let existingId: string;
  let fixedId: string;

  beforeAll(async () => {
    supplierId = (await createSupplier(owner, supplierInput.parse({ name: "Grille Fournisseur" }))).id;
    existingId = (
      await createItem(
        owner,
        itemInput.parse({ kind: "produit", name: "Pompe de relevage", unit: "u", pricingMode: "coef", purchasePrice: "60", coef: "1,5", supplierId, supplierRef: "PR-01" }),
      )
    ).id;
    fixedId = (
      await createItem(
        owner,
        itemInput.parse({ kind: "produit", name: "Support mural 450", unit: "u", pricingMode: "fixe", purchasePrice: "20", salePrice: "45", reference: "SUP450" }),
      )
    ).id;
  });

  it("rapproche par référence fournisseur, par référence interne, sinon crée", () => {
    const rows = matchRows(
      [
        { supplierRef: "pr 01", name: "Pompe relevage Sauermann", brand: null, unit: "u", purchasePriceCents: 6600, category: null },
        { supplierRef: "SUP-450", name: "Support", brand: null, unit: "u", purchasePriceCents: 2000, category: null },
        { supplierRef: "NEW", name: "Goulotte 60x45", brand: null, unit: "m", purchasePriceCents: 450, category: null },
      ],
      [
        { id: "a", name: "Pompe de relevage", reference: null, supplierId: "s", supplierRef: "PR-01", purchasePriceCents: 6000, salePriceCents: 9000, pricingMode: "coef", coefX1000: 1500 },
        { id: "b", name: "Support mural 450", reference: "SUP450", supplierId: null, supplierRef: null, purchasePriceCents: 2000, salePriceCents: 4500, pricingMode: "fixe", coefX1000: null },
      ],
      "s",
    );
    expect(rows[0]).toMatchObject({ matchItemId: "a", action: "maj" });
    expect(rows[1]).toMatchObject({ matchItemId: "b", action: "ignorer" }); // prix inchangé
    expect(rows[2]).toMatchObject({ matchItemId: null, action: "creer" });
  });

  it("rien ne change avant validation ; puis créations, mises à jour et historique", async () => {
    const before = await listItems(owner, { supplierId });
    const { id } = await createImportDraft(owner, {
      supplierId,
      source: "fichier",
      fileName: "tarif.csv",
      rows: [
        { supplierRef: "PR-01", name: "Pompe de relevage", brand: "Sauermann", unit: "u", purchasePriceCents: 6600, category: "Accessoires" },
        { supplierRef: "SUP450", name: "Support mural 450", brand: null, unit: "u", purchasePriceCents: 2200, category: null },
        { supplierRef: "GT60", name: "Goulotte 60x45", brand: null, unit: "m", purchasePriceCents: 450, category: "Goulottes" },
        { supplierRef: "GT80", name: "Goulotte 80x60", brand: null, unit: "m", purchasePriceCents: 610, category: "Goulottes" },
        { supplierRef: "X", name: "Ligne illisible", brand: null, unit: "u", purchasePriceCents: null, category: null },
      ],
    });
    // Brouillon : catalogue intact
    expect(await listItems(owner, { supplierId })).toEqual(before);
    const draft = await getImport(owner, id);
    expect(draft.import.status).toBe("brouillon");
    const rows = draft.import.rows as ImportRow[];
    expect(rows.map((r) => r.action)).toEqual(["maj", "maj", "creer", "creer", "ignorer"]);

    // L'utilisateur décoche la goulotte 80 et corrige un prix
    const edited = rows.map((r) => ({
      key: r.key,
      action: r.supplierRef === "GT80" ? ("ignorer" as const) : r.action,
      supplierRef: r.supplierRef,
      name: r.name,
      brand: r.brand,
      unit: r.unit,
      purchasePriceCents: r.supplierRef === "GT60" ? 470 : r.purchasePriceCents,
      category: r.category,
      kind: r.kind,
    }));
    // Tentative de viser un autre article : ignorée (le rapprochement du serveur fait foi)
    const summary = await applyImport(owner, importApplyInput.parse({ importId: id, coefX1000: 1600, taxRateId: null, rows: edited }));
    expect(summary).toEqual({ created: 1, updated: 2, unchanged: 0, ignored: 2 });

    const pompe = await getItem(owner, existingId);
    expect(pompe.item.purchasePriceCents).toBe(6600);
    expect(pompe.item.salePriceCents).toBe(9900); // coefficient 1,5 conservé
    expect(pompe.item.brand).toBe("Sauermann"); // complété
    expect(pompe.history[0].source).toBe("import");

    const support = await getItem(owner, fixedId);
    expect(support.item.purchasePriceCents).toBe(2200);
    expect(support.item.salePriceCents).toBe(4500); // prix fixe : inchangé
    expect(support.item.supplierId).toBe(supplierId); // rattaché au fournisseur

    const goulotte = (await listItems(owner, { q: "goulotte 60" }))[0];
    expect(goulotte).toMatchObject({ purchasePriceCents: 470, salePriceCents: 752, unit: "m", supplierRef: "GT60", category: "Goulottes" });
    expect(await listItems(owner, { q: "goulotte 80" })).toEqual([]);

    // Une seule application possible
    await expect(applyImport(owner, importApplyInput.parse({ importId: id, coefX1000: 1600, taxRateId: null, rows: edited }))).rejects.toBeInstanceOf(ImportError);
    expect((await getImport(owner, id)).import.summary).toEqual(summary);
  });

  it("abandon d'un brouillon ; isolation des imports", async () => {
    const { id } = await createImportDraft(owner, {
      supplierId: null,
      source: "ia",
      fileName: "photo.jpg",
      notes: "Prix TTC",
      rows: [{ supplierRef: null, name: "Vanne 1/4", brand: null, unit: "u", purchasePriceCents: 900, category: null }],
    });
    await expect(getImport(other, id)).rejects.toThrow("introuvable");
    expect((await getImport(owner, id)).import.notes).toBe("Prix TTC");
    await abandonImport(owner, id);
    await expect(abandonImport(owner, id)).rejects.toBeInstanceOf(ImportError);
    expect(await listItems(owner, { q: "vanne" })).toEqual([]);
  });

  it("refuse un brouillon vide ou un fournisseur d'une autre entreprise", async () => {
    await expect(createImportDraft(owner, { supplierId: null, source: "fichier", fileName: null, rows: [] })).rejects.toBeInstanceOf(ImportError);
    await expect(
      createImportDraft(other, { supplierId, source: "fichier", fileName: null, rows: [{ supplierRef: null, name: "x", brand: null, unit: "u", purchasePriceCents: 1, category: null }] }),
    ).rejects.toThrow("introuvable");
  });

  it("la base refuse un article rattaché au fournisseur d'une autre entreprise", async () => {
    await expect(
      withTenant(other.orgId, (tx) =>
        tx.insert(catalogItems).values({ orgId: other.orgId, name: "x", supplierId, salePriceCents: 0 }),
      ),
    ).rejects.toThrow();
  });
});
