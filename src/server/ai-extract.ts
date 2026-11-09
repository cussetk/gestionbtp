/**
 * Lecture d'une grille de prix fournisseur (photos ou PDF) par l'IA.
 *
 * L'IA ne fait que LIRE : elle renvoie des lignes qui deviennent un brouillon d'import,
 * que l'utilisateur relit et valide avant toute modification du catalogue.
 * Aucune donnée client n'est envoyée : seulement le document fournisseur.
 *
 * Nécessite ANTHROPIC_API_KEY (désactivé sinon). Modèle réglable par AI_MODEL.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { guessUnit } from "@/lib/catalog";
import type { RawRow } from "@/lib/catalog-import";

export const AI_MAX_BYTES = 4 * 1024 * 1024;
export const AI_MAX_FILES = 6;

export class AiExtractError extends Error {}

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AiFile = { mime: string; data: Buffer; name: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lignes", "remarques"],
  properties: {
    lignes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reference", "designation", "marque", "unite", "prix_ht", "famille", "page"],
        properties: {
          reference: { type: "string", description: "Référence ou code article du fournisseur, vide si absent" },
          designation: { type: "string", description: "Désignation complète de l'article" },
          marque: { type: "string", description: "Marque, vide si absente" },
          unite: { type: "string", description: "Unité de vente telle qu'écrite (U, ML, M², pièce…), vide si absente" },
          prix_ht: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "Prix d'achat unitaire HT net en euros, null si illisible",
          },
          famille: { type: "string", description: "Titre de la rubrique ou gamme qui contient la ligne, vide si absent" },
          page: { type: "integer", description: "N° de page ou de photo (à partir de 1)" },
        },
      },
    },
    remarques: {
      type: "string",
      description: "Remarques utiles à la relecture (prix TTC, remise globale, lignes illisibles…), vide si rien",
    },
  },
} as const;

const PROMPT = `Tu lis une grille de prix (tarif) d'un fournisseur de matériel de climatisation, plomberie ou électricité, pour un artisan.
Recopie chaque ligne d'article du document, dans l'ordre, sans en inventer ni en oublier.

Règles :
- prix_ht = prix d'achat unitaire HT en euros, en nombre (1234.5). S'il y a un prix public et un prix net ou remisé, prends le prix net.
  Si seul le prix public figure et qu'une remise globale est indiquée dans le document, applique-la et signale-le dans remarques.
- Si les prix sont TTC, recopie-les tels quels et écris « Prix TTC » dans remarques.
- Ignore les en-têtes, sous-totaux, totaux, frais de port, conditions générales et mentions légales.
- Si une valeur est illisible, mets null pour le prix ou une chaîne vide pour le texte : ne devine pas.
- famille = intitulé de la rubrique (ex. « Climatiseurs muraux », « Liaisons frigorifiques ») qui contient la ligne.
- Garde la désignation telle qu'écrite (puissance, modèle, dimensions).`;

type AiLine = {
  reference: string;
  designation: string;
  marque: string;
  unite: string;
  prix_ht: number | null;
  famille: string;
  page: number;
};

export async function extractPriceGrid(files: AiFile[]): Promise<{ rows: RawRow[]; notes: string | null }> {
  if (!isAiEnabled()) throw new AiExtractError("La lecture par l'IA n'est pas activée sur ce serveur.");
  if (files.length === 0) throw new AiExtractError("Ajoutez au moins une photo ou un PDF.");
  if (files.length > AI_MAX_FILES) throw new AiExtractError(`${AI_MAX_FILES} fichiers maximum à la fois.`);
  const total = files.reduce((s, f) => s + f.data.length, 0);
  if (total > AI_MAX_BYTES) throw new AiExtractError("Fichiers trop lourds (4 Mo maximum au total). Pour une grande grille, demandez le fichier Excel au fournisseur.");

  const content: ContentBlockParam[] = [];
  for (const f of files) {
    const data = f.data.toString("base64");
    if (f.mime === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if (f.mime === "image/jpeg" || f.mime === "image/png" || f.mime === "image/webp") {
      content.push({ type: "image", source: { type: "base64", media_type: f.mime, data } });
    } else {
      throw new AiExtractError(`Format non pris en charge : ${f.name}. Utilisez une photo (JPEG, PNG) ou un PDF.`);
    }
  }
  content.push({ type: "text", text: PROMPT });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 });
  let message;
  try {
    message = await client.messages
      .stream({
        model: process.env.AI_MODEL || "claude-sonnet-5-5",
        max_tokens: 32_000,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content }],
      })
      .finalMessage();
  } catch (err) {
    console.error("[ia] lecture de grille impossible", err instanceof Error ? err.message : err);
    throw new AiExtractError("Le service de lecture ne répond pas. Réessayez dans quelques minutes, ou importez le fichier Excel du fournisseur.");
  }

  if (message.stop_reason === "refusal") throw new AiExtractError("Ce document n'a pas pu être lu.");
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new AiExtractError("Aucune ligne n'a pu être lue dans ce document.");

  let parsed: { lignes: AiLine[]; remarques: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    if (message.stop_reason === "max_tokens") {
      throw new AiExtractError("Grille trop longue pour une seule lecture : envoyez-la en plusieurs fois (quelques pages à la fois).");
    }
    throw new AiExtractError("La lecture a échoué. Réessayez avec une photo plus nette.");
  }

  const rows: RawRow[] = parsed.lignes
    .filter((l) => l.designation?.trim())
    .map((l) => {
      const warnings: string[] = [];
      const unit = guessUnit(l.unite);
      if (l.unite && !unit) warnings.push(`Unité « ${l.unite} » non reconnue : « unité » par défaut`);
      const price = typeof l.prix_ht === "number" && Number.isFinite(l.prix_ht) && l.prix_ht >= 0 ? Math.round(l.prix_ht * 100) : null;
      if (price === null) warnings.push("Prix illisible : à compléter");
      return {
        supplierRef: l.reference?.trim().slice(0, 80) || null,
        name: l.designation.trim().slice(0, 300),
        brand: l.marque?.trim().slice(0, 80) || null,
        unit: unit ?? "u",
        purchasePriceCents: price,
        category: l.famille?.trim().slice(0, 80) || null,
        sourceLine: l.page || undefined,
        warnings,
      };
    });
  const notes = [parsed.remarques?.trim(), message.stop_reason === "max_tokens" ? "Lecture interrompue : la fin de la grille manque peut-être." : null]
    .filter(Boolean)
    .join(" ");
  return { rows, notes: notes || null };
}
