/**
 * Lot B — Réglages de l'entreprise.
 * Les valeurs par défaut (TVA de la zone, numérotation, mentions) sont créées à la première lecture.
 */
import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type Tx } from "@/db";
import { companyLogos, companySettings, numberSeries, organizations, taxRates } from "@/db/schema";
import { assertCan } from "@/lib/permissions";
import { defaultTaxRates } from "@/lib/tax";
import {
  DEFAULT_SERIES,
  DOC_TYPES,
  formatDocNumber,
  localYearMonth,
  nextCounter,
  validatePattern,
  type DocType,
} from "@/lib/numbering";
import type {
  BrandingInput,
  IdentityInput,
  PaymentInput,
  SeriesInput,
  TaxRateInput,
  TaxSettingsInput,
} from "@/lib/validation";
import { NotFoundError, type Ctx } from "./clients";

export class SettingsError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export const DEFAULT_LATE_PENALTY =
  "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles dès le lendemain de la date d'échéance.";
export const DEFAULT_EARLY_DISCOUNT = "Escompte pour paiement anticipé : néant.";

/** Crée les réglages par défaut manquants (idempotent). */
export async function ensureDefaults(tx: Tx, orgId: string, timezone: string) {
  await tx
    .insert(companySettings)
    .values({ orgId, latePenaltyText: DEFAULT_LATE_PENALTY, earlyPaymentDiscountText: DEFAULT_EARLY_DISCOUNT })
    .onConflictDoNothing({ target: companySettings.orgId });

  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(taxRates).where(eq(taxRates.orgId, orgId));
  if (n === 0) {
    await tx.insert(taxRates).values(defaultTaxRates(timezone).map((r, i) => ({ ...r, orgId, position: i })));
  }

  await tx
    .insert(numberSeries)
    .values(DOC_TYPES.map((d) => ({ orgId, docType: d.key, ...DEFAULT_SERIES[d.key] })))
    .onConflictDoNothing({ target: [numberSeries.orgId, numberSeries.docType] });
}

async function loadBundle(tx: Tx, orgId: string) {
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new NotFoundError("Entreprise introuvable");
  await ensureDefaults(tx, orgId, org.timezone);
  const [settings] = await tx.select().from(companySettings).where(eq(companySettings.orgId, orgId));
  const rates = await tx.select().from(taxRates).where(eq(taxRates.orgId, orgId)).orderBy(asc(taxRates.position), asc(taxRates.createdAt));
  const series = await tx.select().from(numberSeries).where(eq(numberSeries.orgId, orgId));
  const [logo] = await tx
    .select({ sha256: companyLogos.sha256, width: companyLogos.width, height: companyLogos.height, mime: companyLogos.mime })
    .from(companyLogos)
    .where(eq(companyLogos.orgId, orgId));
  const order = DOC_TYPES.map((d) => d.key);
  series.sort((a, b) => order.indexOf(a.docType) - order.indexOf(b.docType));
  return { org, settings, taxRates: rates, series, logo: logo ?? null };
}

export type SettingsBundle = Awaited<ReturnType<typeof loadBundle>>;

export async function getSettings(ctx: Ctx): Promise<SettingsBundle> {
  assertCan(ctx, "reglages.gerer");
  return withTenant(ctx.orgId, (tx) => loadBundle(tx, ctx.orgId));
}

// ─── Identité légale et assurance ─────────────────────────────────────────

export async function updateIdentity(ctx: Ctx, input: IdentityInput): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    await tx
      .update(organizations)
      .set({
        name: input.name,
        siret: input.siret,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        postalCode: input.postalCode,
        city: input.city,
        fluidCapacityCertificate: input.fluidCapacityCertificate,
      })
      .where(eq(organizations.id, ctx.orgId));
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org.timezone);
    await tx
      .update(companySettings)
      .set({
        legalForm: input.legalForm,
        tradeName: input.tradeName,
        shareCapitalCents: input.shareCapitalCents,
        registration: input.registration,
        vatNumber: input.vatNumber,
        nafCode: input.nafCode,
        website: input.website,
        insurerName: input.insurerName,
        insurerAddress: input.insurerAddress,
        insurancePolicy: input.insurancePolicy,
        insuranceCoverage: input.insuranceCoverage,
      })
      .where(eq(companySettings.orgId, ctx.orgId));
  });
}

// ─── TVA ──────────────────────────────────────────────────────────────────

export async function updateTaxSettings(ctx: Ctx, input: TaxSettingsInput): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    await tx
      .update(companySettings)
      .set({ vatRegime: input.vatRegime, vatOnDebits: input.vatRegime === "reel" && input.vatOnDebits })
      .where(eq(companySettings.orgId, ctx.orgId));
  });
}

export async function saveTaxRate(ctx: Ctx, input: TaxRateInput): Promise<{ id: string }> {
  assertCan(ctx, "reglages.gerer");
  return withTenant(ctx.orgId, async (tx) => {
    const values = {
      label: input.label,
      rateBp: input.rateBp,
      kind: input.kind,
      mention: input.mention,
      requiresAttestation: input.requiresAttestation,
    };
    if (input.id) {
      const updated = await tx
        .update(taxRates)
        .set(values)
        .where(and(eq(taxRates.id, input.id), eq(taxRates.orgId, ctx.orgId)))
        .returning({ id: taxRates.id });
      if (updated.length === 0) throw new NotFoundError("Taux introuvable");
      return { id: input.id };
    }
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${taxRates.position}), -1)::int` })
      .from(taxRates)
      .where(eq(taxRates.orgId, ctx.orgId));
    const [row] = await tx
      .insert(taxRates)
      .values({ ...values, orgId: ctx.orgId, position: max + 1 })
      .returning({ id: taxRates.id });
    return row;
  });
}

export async function setDefaultTaxRate(ctx: Ctx, id: string): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const [rate] = await tx.select().from(taxRates).where(and(eq(taxRates.id, id), eq(taxRates.orgId, ctx.orgId)));
    if (!rate) throw new NotFoundError("Taux introuvable");
    await tx.update(taxRates).set({ isDefault: false }).where(and(eq(taxRates.orgId, ctx.orgId), eq(taxRates.isDefault, true)));
    await tx.update(taxRates).set({ isDefault: true, active: true }).where(eq(taxRates.id, id));
  });
}

export async function setTaxRateActive(ctx: Ctx, id: string, active: boolean): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const [rate] = await tx.select().from(taxRates).where(and(eq(taxRates.id, id), eq(taxRates.orgId, ctx.orgId)));
    if (!rate) throw new NotFoundError("Taux introuvable");
    if (!active && rate.isDefault) throw new SettingsError("Choisissez d'abord un autre taux par défaut avant de désactiver celui-ci.");
    await tx.update(taxRates).set({ active }).where(eq(taxRates.id, id));
  });
}

/** Désactive les taux actuels et recrée ceux de la zone (les anciens restent pour l'historique). */
export async function resetTaxRates(ctx: Ctx): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await tx.update(taxRates).set({ active: false, isDefault: false }).where(eq(taxRates.orgId, ctx.orgId));
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${taxRates.position}), -1)::int` })
      .from(taxRates)
      .where(eq(taxRates.orgId, ctx.orgId));
    await tx
      .insert(taxRates)
      .values(defaultTaxRates(org.timezone).map((r, i) => ({ ...r, orgId: ctx.orgId, position: max + 1 + i })));
  });
}

// ─── Numérotation ─────────────────────────────────────────────────────────

export async function updateSeries(ctx: Ctx, input: SeriesInput): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  const error = validatePattern(input.pattern, input.padding, input.reset);
  if (error) throw new SettingsError(error, "pattern");
  await withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org.timezone);
    const [series] = await tx
      .select()
      .from(numberSeries)
      .where(and(eq(numberSeries.orgId, ctx.orgId), eq(numberSeries.docType, input.docType)));
    if (series.lockedAt) {
      throw new SettingsError(
        "Des documents ont déjà été numérotés avec ce format : il ne peut plus être modifié, pour garantir une suite continue.",
        "pattern",
      );
    }
    await tx
      .update(numberSeries)
      .set({ pattern: input.pattern, padding: input.padding, reset: input.reset })
      .where(eq(numberSeries.id, series.id));
  });
}

/**
 * Attribue le numéro suivant d'une série, dans la transaction de création du document.
 * Verrou de ligne : deux émissions simultanées ne peuvent pas obtenir le même numéro.
 * Utilisé par les devis/factures (lot D).
 */
export async function allocateNumber(
  tx: Tx,
  orgId: string,
  type: DocType,
  issueDate: Date,
  timezone: string,
): Promise<string> {
  await ensureDefaults(tx, orgId, timezone);
  const rows = await tx.execute(
    sql`select id from number_series where org_id = ${orgId} and doc_type = ${type} for update`,
  );
  const id = (rows as unknown as { rows: { id: string }[] }).rows[0]?.id;
  if (!id) throw new NotFoundError("Série de numérotation introuvable");
  const [series] = await tx.select().from(numberSeries).where(eq(numberSeries.id, id));
  const { year } = localYearMonth(issueDate, timezone);
  const n = nextCounter(series, year);
  await tx
    .update(numberSeries)
    .set({ lastNumber: n, lastYear: year, lockedAt: series.lockedAt ?? new Date() })
    .where(eq(numberSeries.id, id));
  return formatDocNumber(series.pattern, n, { padding: series.padding, date: issueDate, timeZone: timezone });
}

// ─── Paiement, CGV et mise en page ────────────────────────────────────────

export async function updatePayment(ctx: Ctx, input: PaymentInput): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org.timezone);
    await tx.update(companySettings).set(input).where(eq(companySettings.orgId, ctx.orgId));
  });
}

export async function updateBranding(ctx: Ctx, input: BrandingInput): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, async (tx) => {
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, ctx.orgId));
    await ensureDefaults(tx, ctx.orgId, org.timezone);
    await tx.update(companySettings).set(input).where(eq(companySettings.orgId, ctx.orgId));
  });
}

const MAX_LOGO_BYTES = 400 * 1024;

function sniffImage(data: Buffer): "image/png" | "image/jpeg" | null {
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}

export async function saveLogo(ctx: Ctx, input: { data: Buffer; width: number; height: number }): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  const mime = sniffImage(input.data);
  if (!mime) throw new SettingsError("Le logo doit être une image PNG ou JPEG.", "logo");
  if (input.data.length > MAX_LOGO_BYTES) throw new SettingsError("Logo trop lourd (400 Ko maximum).", "logo");
  if (input.width < 16 || input.height < 16 || input.width > 2000 || input.height > 2000) {
    throw new SettingsError("Dimensions du logo invalides.", "logo");
  }
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  await withTenant(ctx.orgId, async (tx) => {
    await tx
      .insert(companyLogos)
      .values({ orgId: ctx.orgId, mime, data: input.data, width: input.width, height: input.height, sha256 })
      .onConflictDoUpdate({
        target: companyLogos.orgId,
        set: { mime, data: input.data, width: input.width, height: input.height, sha256 },
      });
  });
}

export async function deleteLogo(ctx: Ctx): Promise<void> {
  assertCan(ctx, "reglages.gerer");
  await withTenant(ctx.orgId, (tx) => tx.delete(companyLogos).where(eq(companyLogos.orgId, ctx.orgId)));
}

/** Logo de l'entreprise de l'appelant (affichage et PDF). */
export async function getLogo(ctx: Pick<Ctx, "orgId">) {
  return withTenant(ctx.orgId, async (tx) => {
    const [logo] = await tx.select().from(companyLogos).where(eq(companyLogos.orgId, ctx.orgId));
    return logo ?? null;
  });
}
