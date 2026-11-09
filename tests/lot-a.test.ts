/**
 * Lot A : localisation des sites, équipe et autorisations, espace gestionnaire.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, withTenant } from "@/db";
import { sites } from "@/db/schema";
import { AuthError, getSessionContext, signIn, signUp } from "@/server/auth";
import { createClient, createSite, getSite, listClients, setSitePosition, updateSite, type Ctx } from "@/server/clients";
import {
  acceptInvitation,
  createInvitation,
  getInvitationByToken,
  listTeam,
  revokeInvitation,
  setMemberActive,
  TeamError,
  updateMember,
} from "@/server/team";
import {
  addAdminNote,
  AdminForbiddenError,
  adminStats,
  getOrganizationForAdmin,
  listOrganizations,
  setOrganizationStatus,
} from "@/server/admin";
import { geocodeAddress } from "@/server/geocode";
import { ForbiddenError } from "@/lib/permissions";
import { parseCoordinates } from "@/lib/geo";
import { toInternational, whatsappLink } from "@/lib/text";
import { acceptInvitationInput, clientInput, invitationInput, siteInput, signUpInput } from "@/lib/validation";

async function company(name: string, email: string) {
  const { token } = await signUp(
    signUpInput.parse({ orgName: name, fullName: `Patron ${name}`, email, password: "motdepasse-solide" }),
  );
  const s = (await getSessionContext(token))!;
  return { session: s, ctx: { orgId: s.orgId, userId: s.userId, permissions: s.permissions } as Ctx };
}

async function ctxFromToken(token: string): Promise<Ctx> {
  const s = (await getSessionContext(token))!;
  return { orgId: s.orgId, userId: s.userId, permissions: s.permissions };
}

let owner: Ctx;
let other: Ctx;
let adminCtx: { userId: string; isPlatformAdmin: boolean };

beforeAll(async () => {
  owner = (await company("Clim Caraïbes", "patron@clim-caraibes.fr")).ctx;
  other = (await company("Froid Nord", "patron@froid-nord.fr")).ctx;
  // Gestionnaire de la plateforme
  const admin = await company("Plateforme", "kevin@plateforme.fr");
  const db = await getDb();
  await db.execute(sql`update users set is_platform_admin = true where id = ${admin.ctx.userId}`);
  adminCtx = { userId: admin.ctx.userId, isPlatformAdmin: true };
});

// ─── Localisation ─────────────────────────────────────────────────────────

describe("lecture des coordonnées collées", () => {
  it.each([
    ["16.2412, -61.5331", { lat: 16.2412, lng: -61.5331 }],
    ["16,2412 ; -61,5331", { lat: 16.2412, lng: -61.5331 }],
    ["https://www.google.com/maps/@16.2412,-61.5331,17z", { lat: 16.2412, lng: -61.5331 }],
    ["https://maps.google.com/?q=16.2412,-61.5331", { lat: 16.2412, lng: -61.5331 }],
    ["https://www.google.com/maps/place/X/@16.1,-61.1,17z/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d16.2412!4d-61.5331", { lat: 16.2412, lng: -61.5331 }],
    ["https://maps.apple.com/?ll=16.2412,-61.5331&q=Repère", { lat: 16.2412, lng: -61.5331 }],
    ["https://www.openstreetmap.org/#map=18/16.2412/-61.5331", { lat: 16.2412, lng: -61.5331 }],
    ["https://waze.com/ul?ll=48.8566,2.3522&navigate=yes", { lat: 48.8566, lng: 2.3522 }],
  ])("comprend %s", (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it.each(["", "Baie-Mahault", "200, 10", "0, 0", "https://maps.app.goo.gl/abc"])("refuse %s", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });

  it("refuse une saisie illisible dans le formulaire", () => {
    const r = siteInput.safeParse({ clientId: crypto.randomUUID(), label: "A", addressLine1: "1 rue", postalCode: "97122", city: "Baie-Mahault", coordinates: "chez Marie" });
    expect(r.success).toBe(false);
  });
});

describe("géocodage depuis l'adresse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("lit la réponse GeoJSON (longitude puis latitude)", async () => {
    vi.stubEnv("GEOCODING_DISABLED", "0");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [{ geometry: { type: "Point", coordinates: [-61.5935, 16.2668] }, properties: { score: 0.91, type: "housenumber", street: "Rue des Flamboyants", label: "12 Rue des Flamboyants 97122 Baie-Mahault", postcode: "97122" } }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await geocodeAddress({ addressLine1: "12 rue des Flamboyants", postalCode: "97122", city: "Baie-Mahault" });
    expect(r).toMatchObject({ lat: 16.2668, lng: -61.5935 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.hostname).toBe("data.geopf.fr");
    expect(url.searchParams.get("postcode")).toBe("97122");
  });

  it("refuse une mauvaise rue proposée par le service (cas réel Baie-Mahault)", async () => {
    vi.stubEnv("GEOCODING_DISABLED", "0");
    const answer = (props: Record<string, unknown>) =>
      new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-61.5936, 16.2539] }, properties: { postcode: "97122", ...props } }] }));
    const addr = { addressLine1: "12 rue des Flamboyants", postalCode: "97122", city: "Baie-Mahault" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer({ score: 0.58, type: "housenumber", street: "Rue des Fougères" })));
    expect(await geocodeAddress(addr)).toBeNull();
    // Même avec un bon score, une autre rue est refusée.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer({ score: 0.9, type: "housenumber", street: "Rue des Fougères" })));
    expect(await geocodeAddress(addr)).toBeNull();
    // Commune seule : trop imprécis.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer({ score: 0.95, type: "municipality", name: "Baie-Mahault" })));
    expect(await geocodeAddress(addr)).toBeNull();
    // Nom officiel plus long, score moyen : accepté (cas réel Pointe-à-Pitre).
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-61.53, 16.24] }, properties: { postcode: "97110", score: 0.68, type: "housenumber", street: "Rue du General Frebault" } }] })),
    ));
    expect(await geocodeAddress({ addressLine1: "10 rue Frébault", postalCode: "97110", city: "Pointe-à-Pitre" })).toMatchObject({ lat: 16.24 });
    // Bonne rue, accents et majuscules différents : accepté.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer({ score: 0.88, type: "street", street: "Rue des FLAMBOYANTS" })));
    expect(await geocodeAddress(addr)).toMatchObject({ lat: 16.2539 });
  });

  it("ignore un résultat peu sûr, d'un autre code postal, ou une panne", async () => {
    vi.stubEnv("GEOCODING_DISABLED", "0");
    const answer = (score: number, postcode: string) =>
      new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-61.5, 16.2] }, properties: { score, postcode } }] }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer(0.3, "97122")));
    expect(await geocodeAddress({ addressLine1: "rue inconnue", postalCode: "97122", city: "Baie-Mahault" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(answer(0.9, "97100")));
    expect(await geocodeAddress({ addressLine1: "1 rue", postalCode: "97122", city: "Baie-Mahault" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("réseau")));
    expect(await geocodeAddress({ addressLine1: "1 rue", postalCode: "97122", city: "Baie-Mahault" })).toBeNull();
  });

  it("positionne automatiquement un nouveau site, et le recalcule si l'adresse change", async () => {
    vi.stubEnv("GEOCODING_DISABLED", "0");
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call++;
        const coords = call === 1 ? [-61.59, 16.26] : [-61.53, 16.24];
        const postcode = call === 1 ? "97122" : "97190";
        return new Response(JSON.stringify({ features: [{ geometry: { coordinates: coords }, properties: { score: 0.9, postcode } }] }));
      }),
    );
    const { id: clientId } = await createClient(owner, clientInput.parse({ type: "particulier", lastName: "Géo" }));
    const base = { clientId, label: "Maison", addressLine1: "1 rue A", postalCode: "97122", city: "Baie-Mahault" };
    const { id } = await createSite(owner, siteInput.parse(base));
    let { site } = await getSite(owner, id);
    expect([site.latitude, site.longitude, site.geoSource]).toEqual([16.26, -61.59, "adresse"]);

    // Formulaire renvoyé avec la position déjà calculée mais une nouvelle adresse → recalcul.
    await updateSite(owner, id, siteInput.parse({ ...base, postalCode: "97190", city: "Le Gosier", coordinates: "16.26, -61.59", geoSource: "adresse" }));
    ({ site } = await getSite(owner, id));
    expect([site.latitude, site.longitude, site.geoSource]).toEqual([16.24, -61.53, "adresse"]);

    // Position relevée par GPS sur place : prioritaire et conservée.
    await setSitePosition(owner, id, { lat: 16.241234, lng: -61.531234, accuracy: 12.4 });
    ({ site } = await getSite(owner, id));
    expect([site.latitude, site.longitude, site.geoSource, site.geoAccuracyM]).toEqual([16.241234, -61.531234, "gps", 12]);

    // Modification d'autre chose : la position GPS n'est pas écrasée.
    await updateSite(owner, id, siteInput.parse({ ...base, postalCode: "97190", city: "Le Gosier", label: "Maison principale", coordinates: "16.241234, -61.531234", geoSource: "gps", geoAccuracyM: "12" }));
    ({ site } = await getSite(owner, id));
    expect([site.latitude, site.geoSource, site.label]).toEqual([16.241234, "gps", "Maison principale"]);
    expect(call).toBe(2);
  });

  it("une autre entreprise ne peut pas déplacer le site", async () => {
    const [geo] = await listClients(owner, { q: "geo" });
    const siteId = (await withTenant(owner.orgId, (tx) => tx.select({ id: sites.id }).from(sites).where(sql`client_id = ${geo.id}`)))[0].id;
    await expect(setSitePosition(other, siteId, { lat: 1, lng: 1 })).rejects.toThrow("Site introuvable");
  });
});

describe("numéros pour WhatsApp (métropole et DOM)", () => {
  it.each([
    ["0690 11 22 33", "590690112233"],
    ["0590 84 00 00", "590590840000"],
    ["0696 12 34 56", "596696123456"],
    ["0694 12 34 56", "594694123456"],
    ["0692 12 34 56", "262692123456"],
    ["0639 12 34 56", "262639123456"],
    ["06 12 34 56 78", "33612345678"],
    ["+590 690 11 22 33", "590690112233"],
  ])("%s → %s", (input, expected) => {
    expect(toInternational(input)).toBe(expected);
  });

  it("construit le lien avec le message encodé", () => {
    expect(whatsappLink("0690112233", "Bonjour, entretien ?")).toBe("https://wa.me/590690112233?text=Bonjour%2C%20entretien%20%3F");
    expect(whatsappLink("123")).toBeNull();
  });
});

// ─── Équipe et autorisations ──────────────────────────────────────────────

describe("équipe", () => {
  let techToken: string;
  let tech: Ctx;

  it("le propriétaire invite un technicien avec des droits limités", async () => {
    const { token } = await createInvitation(
      owner,
      invitationInput.parse({ fullName: "Jean Tech", email: "Jean@clim-caraibes.fr", title: "Technicien", permissions: ["clients.voir", "interventions.realiser", "inexistant"] }),
    );
    const inv = await getInvitationByToken(token);
    expect(inv).toMatchObject({ email: "jean@clim-caraibes.fr", orgName: "Clim Caraïbes", permissions: ["clients.voir", "interventions.realiser"] });

    const session = await acceptInvitation(acceptInvitationInput.parse({ token, fullName: "Jean Tech", password: "motdepasse-tech" }));
    techToken = session.token;
    tech = await ctxFromToken(techToken);
    const s = (await getSessionContext(techToken))!;
    expect(s.role).toBe("membre");
    expect(s.orgId).toBe(owner.orgId);
    expect(s.permissions).toEqual(["clients.voir", "interventions.realiser"]);

    // Le lien ne sert qu'une fois.
    expect(await getInvitationByToken(token)).toBeNull();
    await expect(acceptInvitation(acceptInvitationInput.parse({ token, fullName: "X", password: "motdepasse-tech" }))).rejects.toBeInstanceOf(AuthError);
  });

  it("le technicien voit les clients mais ne peut ni créer, ni archiver, ni gérer l'équipe", async () => {
    expect(Array.isArray(await listClients(tech))).toBe(true);
    await expect(createClient(tech, clientInput.parse({ type: "particulier", lastName: "Interdit" }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listTeam(tech)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("le propriétaire change ses droits : effet immédiat, sans reconnexion", async () => {
    await updateMember(owner, { userId: tech.userId, title: "Chef d'équipe", permissions: ["clients.voir", "clients.modifier", "interventions.realiser"] });
    const s = (await getSessionContext(techToken))!;
    expect(s.permissions).toContain("clients.modifier");
    expect(s.title).toBe("Chef d'équipe");
    tech = await ctxFromToken(techToken);
    await expect(createClient(tech, clientInput.parse({ type: "particulier", lastName: "Autorisé" }))).resolves.toBeTruthy();
  });

  it("un membre gestionnaire d'équipe ne peut pas donner plus que ses propres droits", async () => {
    const { token } = await createInvitation(owner, invitationInput.parse({ fullName: "Sophie Bureau", email: "sophie@clim-caraibes.fr", permissions: ["clients.voir", "equipe.gerer"] }));
    const sophie = await ctxFromToken((await acceptInvitation(acceptInvitationInput.parse({ token, fullName: "Sophie Bureau", password: "motdepasse-bureau" }))).token);

    const { token: t2 } = await createInvitation(sophie, invitationInput.parse({ fullName: "Paul", email: "paul@clim-caraibes.fr", permissions: ["clients.voir", "clients.archiver", "factures.emettre"] }));
    expect((await getInvitationByToken(t2))?.permissions).toEqual(["clients.voir"]);

    // Elle ne retire pas à Jean un droit qu'elle n'a pas elle-même.
    await updateMember(sophie, { userId: tech.userId, title: null, permissions: [] });
    expect((await getSessionContext(techToken))!.permissions).toEqual(expect.arrayContaining(["clients.modifier", "interventions.realiser"]));
    expect((await getSessionContext(techToken))!.permissions).not.toContain("clients.voir");

    // Ni elle ni personne ne touche au propriétaire, ni à ses propres droits.
    await expect(updateMember(sophie, { userId: owner.userId, title: null, permissions: [] })).rejects.toBeInstanceOf(TeamError);
    await expect(updateMember(sophie, { userId: sophie.userId, title: null, permissions: ["clients.archiver"] })).rejects.toBeInstanceOf(TeamError);
    await expect(setMemberActive(sophie, owner.userId, false)).rejects.toBeInstanceOf(TeamError);
  });

  it("refuse d'inviter un e-mail qui a déjà un compte", async () => {
    await expect(createInvitation(owner, invitationInput.parse({ fullName: "X", email: "patron@froid-nord.fr", permissions: [] }))).rejects.toBeInstanceOf(TeamError);
  });

  it("une invitation annulée ne fonctionne plus ; une nouvelle remplace l'ancienne", async () => {
    const a = await createInvitation(owner, invitationInput.parse({ fullName: "Léa", email: "lea@clim-caraibes.fr", permissions: [] }));
    const b = await createInvitation(owner, invitationInput.parse({ fullName: "Léa", email: "lea@clim-caraibes.fr", permissions: ["clients.voir"] }));
    expect(await getInvitationByToken(a.token)).toBeNull();
    expect(await getInvitationByToken(b.token)).not.toBeNull();
    await revokeInvitation(owner, b.id);
    expect(await getInvitationByToken(b.token)).toBeNull();
  });

  it("désactiver un membre le déconnecte et l'empêche de revenir ; réactiver le rétablit", async () => {
    await setMemberActive(owner, tech.userId, false);
    expect(await getSessionContext(techToken)).toBeNull();
    await expect(signIn("jean@clim-caraibes.fr", "motdepasse-tech")).rejects.toThrow(/désactivé/);
    await setMemberActive(owner, tech.userId, true);
    await expect(signIn("jean@clim-caraibes.fr", "motdepasse-tech")).resolves.toBeTruthy();
  });

  it("une autre entreprise ne voit ni ne touche cette équipe", async () => {
    const { members } = await listTeam(other);
    expect(members.map((m) => m.email)).toEqual(["patron@froid-nord.fr"]);
    await expect(updateMember(other, { userId: tech.userId, title: null, permissions: ["clients.voir"] })).rejects.toThrow("Membre introuvable");
    await expect(setMemberActive(other, tech.userId, false)).rejects.toThrow("Membre introuvable");
    const { pending } = await listTeam(owner);
    await expect(revokeInvitation(other, pending[0].id)).rejects.toThrow("Invitation introuvable");
  });
});

// ─── Espace gestionnaire ──────────────────────────────────────────────────

describe("espace gestionnaire", () => {
  it("est refusé à un patron ordinaire", async () => {
    const notAdmin = { userId: owner.userId, isPlatformAdmin: false };
    await expect(listOrganizations(notAdmin)).rejects.toBeInstanceOf(AdminForbiddenError);
    await expect(setOrganizationStatus(notAdmin, owner.orgId, "active")).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it("liste les nouveaux espaces en attente, avec le contact du propriétaire et les volumes", async () => {
    const stats = await adminStats(adminCtx);
    expect(stats.enAttente).toBeGreaterThanOrEqual(2);
    const pending = await listOrganizations(adminCtx, { status: "en_attente", q: "caraïbes" });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ name: "Clim Caraïbes", ownerEmail: "patron@clim-caraibes.fr", memberCount: 3 });
    expect(pending[0].clientCount).toBeGreaterThanOrEqual(1);
    expect((await listOrganizations(adminCtx, { q: "jean@clim" }))[0]?.name).toBe("Clim Caraïbes");
  });

  it("valide, suspend avec motif visible par le client, et journalise", async () => {
    await setOrganizationStatus(adminCtx, owner.orgId, "active");
    const { token } = await signIn("patron@clim-caraibes.fr", "motdepasse-solide");
    expect((await getSessionContext(token))!.orgStatus).toBe("active");

    await setOrganizationStatus(adminCtx, owner.orgId, "suspendue", "Impayé de novembre");
    const s = (await getSessionContext(token))!;
    expect([s.orgStatus, s.orgStatusReason]).toEqual(["suspendue", "Impayé de novembre"]);

    await addAdminNote(adminCtx, owner.orgId, "Appelé le patron, règlement prévu lundi");
    const { events, members } = await getOrganizationForAdmin(adminCtx, owner.orgId);
    expect(events.map((e) => e.action)).toEqual(["note", "suspension", "validation"]);
    expect(members.find((m) => m.role === "proprietaire")?.email).toBe("patron@clim-caraibes.fr");
  });

  it("un client ne peut pas valider son propre espace, même par une requête directe", async () => {
    await expect(
      withTenant(other.orgId, (tx) => tx.execute(sql`update organizations set status = 'active' where id = ${other.orgId}`)),
    ).rejects.toThrow();
    // Il peut en revanche modifier ses informations.
    await expect(
      withTenant(other.orgId, (tx) => tx.execute(sql`update organizations set phone = '0590000000' where id = ${other.orgId}`)),
    ).resolves.toBeTruthy();
  });
});
