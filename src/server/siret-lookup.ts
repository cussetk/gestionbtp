/**
 * Pré-remplissage de l'identité légale depuis l'annuaire public des entreprises
 * (recherche-entreprises.api.gouv.fr : gratuit, sans clé, données INSEE/RNE).
 * L'utilisateur relit et valide toujours avant d'enregistrer.
 */
import { legalFormFromInsee, vatNumberFromSiren } from "@/lib/company";
import { isValidSiret } from "@/lib/text";

const ENDPOINT = "https://recherche-entreprises.api.gouv.fr/search";

export type CompanyLookup = {
  name: string;
  siret: string;
  legalForm: string | null;
  vatNumber: string | null;
  nafCode: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  closed: boolean;
};

type ApiResult = {
  siren?: string;
  nom_raison_sociale?: string | null;
  nom_complet?: string | null;
  nature_juridique?: string | null;
  activite_principale?: string | null;
  etat_administratif?: string | null;
  complements?: { est_entrepreneur_individuel?: boolean };
  siege?: {
    siret?: string;
    numero_voie?: string | null;
    indice_repetition?: string | null;
    type_voie?: string | null;
    libelle_voie?: string | null;
    code_postal?: string | null;
    libelle_commune?: string | null;
    etat_administratif?: string | null;
  };
  matching_etablissements?: ApiResult["siege"][];
};

const VOIE: Record<string, string> = {
  RUE: "rue",
  AV: "avenue",
  BD: "boulevard",
  CHE: "chemin",
  RTE: "route",
  IMP: "impasse",
  PL: "place",
  ALL: "allée",
  LOT: "lotissement",
  RES: "résidence",
  CITE: "cité",
  QUAI: "quai",
  SEC: "section",
  ZA: "ZA",
  ZI: "ZI",
};

function title(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export async function lookupCompany(siretOrSiren: string): Promise<CompanyLookup | null> {
  const q = siretOrSiren.replace(/\s/g, "");
  if (!/^\d{9}$/.test(q) && !isValidSiret(q)) return null;
  try {
    const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ q, page: "1", per_page: "1" })}`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ApiResult[] };
    const r = data.results?.[0];
    if (!r?.siren || !q.startsWith(r.siren)) return null;
    // Établissement demandé (SIRET) ou siège.
    const etab = (q.length === 14 && r.matching_etablissements?.find((e) => e?.siret === q)) || r.siege || {};
    const street = [etab.numero_voie, etab.indice_repetition, etab.type_voie ? (VOIE[etab.type_voie] ?? etab.type_voie.toLowerCase()) : null, etab.libelle_voie ? title(etab.libelle_voie) : null]
      .filter(Boolean)
      .join(" ");
    const individual = r.complements?.est_entrepreneur_individuel === true;
    return {
      name: (r.nom_raison_sociale ?? r.nom_complet ?? "").trim(),
      siret: etab.siret ?? q,
      legalForm: legalFormFromInsee(r.nature_juridique, individual),
      vatNumber: vatNumberFromSiren(r.siren),
      nafCode: r.activite_principale ?? null,
      addressLine1: street ? street.charAt(0).toUpperCase() + street.slice(1) : null,
      postalCode: etab.code_postal ?? null,
      city: etab.libelle_commune ? title(etab.libelle_commune) : null,
      closed: r.etat_administratif === "C" || etab.etat_administratif === "F",
    };
  } catch {
    return null;
  }
}
