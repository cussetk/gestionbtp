import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, withTenant } from "@/db";
import { clients, sites } from "@/db/schema";
import { AuthError, getSessionContext, signIn, signOut, signUp } from "@/server/auth";
import {
  archiveClient,
  archiveSite,
  createClient,
  createSite,
  getClient,
  getSite,
  listClients,
  NotFoundError,
  updateClient,
  updateSite,
  type Ctx,
} from "@/server/clients";
import { clientInput, siteInput, signUpInput } from "@/lib/validation";
import { formatPhone, isValidSiret, normalizeSearch } from "@/lib/text";

const client = (raw: Record<string, unknown>) => clientInput.parse(raw);
const site = (raw: Record<string, unknown>) => siteInput.parse(raw);

async function newCompany(name: string, email: string): Promise<Ctx> {
  const { token } = await signUp(
    signUpInput.parse({ orgName: name, fullName: "Gérant " + name, email, password: "motdepasse-solide" }),
  );
  const ctx = await getSessionContext(token);
  if (!ctx) throw new Error("session manquante");
  return { orgId: ctx.orgId, userId: ctx.userId, permissions: ctx.permissions };
}

let froid: Ctx; // Froid Antilles (Guadeloupe)
let clim: Ctx; // Clim Services (concurrent, autre espace)

beforeAll(async () => {
  froid = await newCompany("Froid Antilles", "gerant@froid-antilles.fr");
  clim = await newCompany("Clim Services", "contact@clim-services.fr");
});

// ─── Validation ─────────────────────────────────────────────────────────────

describe("validation", () => {
  it("vérifie les SIRET (clé de Luhn)", () => {
    expect(isValidSiret("73282932000074")).toBe(true);
    expect(isValidSiret("73282932000075")).toBe(false);
    expect(isValidSiret("1234")).toBe(false);
  });

  it("normalise et formate les téléphones, métropole et DOM", () => {
    const c = client({ type: "particulier", lastName: "Durand", phone: "0690 12-34.56", phone2: "+590 (0)590 99" });
    expect(c.phone).toBe("0690123456");
    expect(c.phone2).toBe("+590059099");
    expect(formatPhone("0690123456")).toBe("06 90 12 34 56");
    expect(formatPhone("+590690123456")).toBe("+590 690 12 34 56");
    expect(() => client({ type: "particulier", lastName: "X", phone: "abc" })).toThrow();
  });

  it("exige le nom (particulier) ou la raison sociale (pro)", () => {
    expect(clientInput.safeParse({ type: "particulier" }).success).toBe(false);
    expect(clientInput.safeParse({ type: "professionnel", lastName: "Dupont" }).success).toBe(false);
    expect(clientInput.safeParse({ type: "professionnel", companyName: "Hôtel Le Lagon" }).success).toBe(true);
  });

  it("case « créer le site » : ignorée sans adresse, adresse complète exigée si commencée", () => {
    expect(clientInput.safeParse({ type: "particulier", lastName: "A", createSiteFromAddress: "on" }).success).toBe(true);
    const partial = clientInput.safeParse({ type: "particulier", lastName: "A", city: "Pointe-à-Pitre", createSiteFromAddress: "on" });
    expect(partial.success).toBe(false);
  });

  it("refuse un site sans adresse et un code postal invalide", () => {
    const id = crypto.randomUUID();
    expect(siteInput.safeParse({ clientId: id, label: "Domicile" }).success).toBe(false);
    expect(
      siteInput.safeParse({ clientId: id, label: "A", addressLine1: "1 rue", postalCode: "971", city: "Baie-Mahault" })
        .success,
    ).toBe(false);
  });

  it("recherche sans accents ni majuscules", () => {
    expect(normalizeSearch("  Hôtel   ÉLÉGANCE ")).toBe("hotel elegance");
  });
});

// ─── Comptes et sessions ────────────────────────────────────────────────────

describe("comptes", () => {
  it("connecte avec le bon mot de passe, refuse le mauvais", async () => {
    const { token } = await signIn("GERANT@froid-antilles.fr", "motdepasse-solide");
    const ctx = await getSessionContext(token);
    expect(ctx?.orgName).toBe("Froid Antilles");
    expect(ctx?.role).toBe("proprietaire");
    expect(ctx?.orgStatus).toBe("en_attente");
    expect(ctx?.permissions).toContain("equipe.gerer");
    await expect(signIn("gerant@froid-antilles.fr", "mauvais")).rejects.toBeInstanceOf(AuthError);
    await expect(signIn("inconnu@exemple.fr", "motdepasse-solide")).rejects.toBeInstanceOf(AuthError);
  });

  it("refuse deux comptes avec le même e-mail", async () => {
    await expect(
      signUp(
        signUpInput.parse({
          orgName: "Doublon",
          fullName: "X",
          email: "gerant@froid-antilles.fr",
          password: "motdepasse-solide",
        }),
      ),
    ).rejects.toThrow(/existe déjà/);
  });

  it("invalide la session à la déconnexion et ignore les jetons inconnus", async () => {
    const { token } = await signIn("gerant@froid-antilles.fr", "motdepasse-solide");
    expect(await getSessionContext(token)).not.toBeNull();
    await signOut(token);
    expect(await getSessionContext(token)).toBeNull();
    expect(await getSessionContext("jeton-bidon")).toBeNull();
    expect(await getSessionContext(undefined)).toBeNull();
  });

  it("ne stocke ni le mot de passe ni le jeton en clair", async () => {
    const db = await getDb();
    const { token } = await signIn("gerant@froid-antilles.fr", "motdepasse-solide");
    const r = (await db.execute(
      sql`select (select count(*)::int from sessions where token_hash = ${token}) as t,
                 (select count(*)::int from users where password_hash like '%motdepasse%') as p`,
    )) as unknown as { rows: { t: number; p: number }[] };
    expect(r.rows[0]).toEqual({ t: 0, p: 0 });
  });
});

// ─── Clients et sites ───────────────────────────────────────────────────────

describe("clients et sites", () => {
  it("crée un client particulier avec son site à l'adresse de facturation", async () => {
    const { id, siteId } = await createClient(
      froid,
      client({
        type: "particulier",
        firstName: "Marie",
        lastName: "Bélénus",
        phone: "0690 11 22 33",
        addressLine1: "12 rue des Flamboyants",
        postalCode: "97122",
        city: "Baie-Mahault",
        createSiteFromAddress: "on",
      }),
    );
    expect(siteId).not.toBeNull();
    const { client: c, sites: s } = await getClient(froid, id);
    expect(c.displayName).toBe("BÉLÉNUS Marie");
    expect(s).toHaveLength(1);
    expect(s[0].label).toBe("Domicile");
    expect(s[0].city).toBe("Baie-Mahault");
  });

  it("crée un client pro et plusieurs sites, puis les modifie", async () => {
    const { id } = await createClient(
      froid,
      client({ type: "professionnel", companyName: "Hôtel Le Lagon", siret: "732 829 320 00074", lastName: "Martin" }),
    );
    const s1 = await createSite(
      froid,
      site({ clientId: id, label: "Bâtiment A", addressLine1: "Route de la plage", postalCode: "97190", city: "Le Gosier", accessNotes: "Groupe ext. sur le toit, clé à l'accueil" }),
    );
    await createSite(
      froid,
      site({ clientId: id, label: "Restaurant", addressLine1: "Route de la plage", postalCode: "97190", city: "Le Gosier" }),
    );
    await updateSite(
      froid,
      s1.id,
      site({ clientId: id, label: "Bâtiment A (chambres)", addressLine1: "Route de la plage", postalCode: "97190", city: "Le Gosier", coordinates: "16,2050 ; -61.4930" }),
    );
    const { site: updated } = await getSite(froid, s1.id);
    expect(updated.label).toBe("Bâtiment A (chambres)");
    expect(updated.latitude).toBeCloseTo(16.205);

    await updateClient(froid, id, client({ type: "professionnel", companyName: "Hôtel Le Lagon Bleu", email: "Direction@LAGON.fr" }));
    const { client: c, sites: s } = await getClient(froid, id);
    expect(c.displayName).toBe("Hôtel Le Lagon Bleu");
    expect(c.email).toBe("direction@lagon.fr");
    expect(s).toHaveLength(2);
  });

  it("recherche par nom sans accent, téléphone, ville d'un site", async () => {
    expect((await listClients(froid, { q: "belenus" })).map((c) => c.displayName)).toEqual(["BÉLÉNUS Marie"]);
    expect((await listClients(froid, { q: "06 90 11" })).map((c) => c.displayName)).toEqual(["BÉLÉNUS Marie"]);
    expect((await listClients(froid, { q: "gosier" })).map((c) => c.displayName)).toEqual(["Hôtel Le Lagon Bleu"]);
    expect(await listClients(froid, { q: "100%_" })).toEqual([]);
    const all = await listClients(froid);
    expect(all.map((c) => c.displayName)).toEqual(["BÉLÉNUS Marie", "Hôtel Le Lagon Bleu"]);
    expect(all[1].siteCount).toBe(2);
  });

  it("ne crée pas de doublon si la même création est renvoyée (coupure réseau)", async () => {
    const id = crypto.randomUUID();
    const input = client({ id, type: "particulier", lastName: "Renvoi" });
    await createClient(froid, input);
    await createClient(froid, input);
    expect((await listClients(froid, { q: "renvoi" })).length).toBe(1);
  });

  it("archive un site, puis un client avec ses sites", async () => {
    const [lagon] = await listClients(froid, { q: "lagon" });
    const { sites: s } = await getClient(froid, lagon.id);
    await archiveSite(froid, s[1].id);
    expect((await getClient(froid, lagon.id)).sites).toHaveLength(1);

    await archiveClient(froid, lagon.id);
    await expect(getClient(froid, lagon.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listClients(froid, { q: "lagon" })).toEqual([]);
    await expect(getSite(froid, s[0].id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("met à jour updated_at et row_version à chaque modification (synchro)", async () => {
    const { id } = await createClient(froid, client({ type: "particulier", lastName: "Version" }));
    const read = () =>
      withTenant(froid.orgId, async (tx) => (await tx.select().from(clients).where(sql`id = ${id}`))[0]);
    const before = await read();
    await updateClient(froid, id, client({ type: "particulier", lastName: "Version", firstName: "Paul" }));
    const after = await read();
    expect(after.rowVersion).toBeGreaterThan(before.rowVersion);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });
});

// ─── Isolation entre entreprises ────────────────────────────────────────────

describe("isolation entre entreprises", () => {
  it("une autre entreprise ne voit, ne modifie ni n'archive les clients", async () => {
    const [marie] = await listClients(froid, { q: "belenus" });

    expect(await listClients(clim)).toEqual([]);
    expect(await listClients(clim, { q: "belenus" })).toEqual([]);
    await expect(getClient(clim, marie.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateClient(clim, marie.id, client({ type: "particulier", lastName: "Piraté" })),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveClient(clim, marie.id)).rejects.toBeInstanceOf(NotFoundError);

    const { client: still } = await getClient(froid, marie.id);
    expect(still.lastName).toBe("Bélénus");
  });

  it("ne peut pas rattacher un site au client d'une autre entreprise", async () => {
    const [marie] = await listClients(froid, { q: "belenus" });
    await expect(
      createSite(clim, site({ clientId: marie.id, label: "X", addressLine1: "1 rue", postalCode: "97100", city: "Basse-Terre" })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ne peut pas réutiliser l'id d'un client d'une autre entreprise", async () => {
    const [marie] = await listClients(froid, { q: "belenus" });
    await expect(createClient(clim, client({ id: marie.id, type: "particulier", lastName: "Usurpation" }))).rejects.toThrow();
    expect((await getClient(froid, marie.id)).client.lastName).toBe("Bélénus");
  });

  it("Postgres bloque même une requête SQL brute sans filtre", async () => {
    const rows = await withTenant(clim.orgId, (tx) => tx.select().from(clients));
    expect(rows).toEqual([]);
    const siteRows = await withTenant(clim.orgId, (tx) => tx.select().from(sites));
    expect(siteRows).toEqual([]);
  });

  it("Postgres refuse d'écrire une ligne au nom d'une autre entreprise", async () => {
    await expect(
      withTenant(clim.orgId, (tx) =>
        tx.insert(clients).values({ orgId: froid.orgId, type: "particulier", lastName: "Intrus", displayName: "INTRUS" }),
      ),
    ).rejects.toThrow();
  });

  it("sans entreprise posée, aucune ligne n'est visible", async () => {
    const db = await getDb();
    const r = (await db.transaction(async (tx) => {
      await tx.execute(sql`set local role app_tenant`);
      return tx.execute(sql`select count(*)::int as n from clients`);
    })) as unknown as { rows: { n: number }[] };
    expect(r.rows[0].n).toBe(0);
  });
});
