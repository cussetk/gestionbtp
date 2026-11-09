/**
 * Autorisations des membres d'une entreprise.
 *
 * Le propriétaire a toujours tous les droits. Les autres membres reçoivent les droits
 * cochés par le propriétaire (ou par un membre ayant « Gérer l'équipe »).
 * Les droits des modules pas encore livrés sont déjà réglables : ils s'appliqueront
 * automatiquement à leur arrivée.
 */

export const PERMISSION_GROUPS = [
  {
    label: "Clients",
    permissions: [
      { key: "clients.voir", label: "Voir les clients et les sites", ready: true },
      { key: "clients.modifier", label: "Créer et modifier clients et sites", ready: true },
      { key: "clients.archiver", label: "Archiver des clients et des sites", ready: true },
    ],
  },
  {
    label: "Terrain",
    permissions: [
      { key: "interventions.realiser", label: "Réaliser ses interventions (rapport, photos, signature)", ready: false },
      { key: "planning.tous", label: "Voir et organiser le planning de toute l'équipe", ready: false },
      { key: "parc.modifier", label: "Modifier le parc d'équipements", ready: false },
      { key: "fluides.registre", label: "Tenir le registre des fluides", ready: false },
    ],
  },
  {
    label: "Ventes",
    permissions: [
      { key: "devis.voir", label: "Voir les devis", ready: false },
      { key: "devis.modifier", label: "Créer et modifier des devis", ready: false },
      { key: "devis.envoyer", label: "Valider et envoyer les devis", ready: false },
      { key: "factures.voir", label: "Voir les factures", ready: false },
      { key: "factures.emettre", label: "Émettre des factures et des avoirs", ready: false },
    ],
  },
  {
    label: "Achats et stock",
    permissions: [
      { key: "achats.gerer", label: "Fournisseurs, bons de commande, factures d'achat", ready: false },
      { key: "stock.gerer", label: "Gérer le stock et les numéros de série", ready: false },
      { key: "prix.achat", label: "Voir les prix d'achat et les marges", ready: false },
      { key: "chantiers.rentabilite", label: "Voir la rentabilité des chantiers", ready: false },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { key: "compta.acces", label: "Accéder à l'espace comptable et aux exports", ready: false },
      { key: "reglages.gerer", label: "Modifier les réglages (TVA, numérotation, mise en page…)", ready: false },
      { key: "equipe.gerer", label: "Inviter des membres et gérer leurs droits", ready: true },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

const LABELS = new Map<string, string>(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])));

export function permissionLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

export function isPermission(value: string): value is Permission {
  return LABELS.has(value);
}

/** Profils proposés pour aller vite ; le propriétaire peut ensuite cocher/décocher. */
export const PRESETS: { key: string; label: string; permissions: Permission[] }[] = [
  {
    key: "technicien",
    label: "Technicien",
    permissions: ["clients.voir", "clients.modifier", "interventions.realiser", "parc.modifier", "fluides.registre"],
  },
  {
    key: "secretariat",
    label: "Secrétariat / bureau",
    permissions: [
      "clients.voir",
      "clients.modifier",
      "planning.tous",
      "devis.voir",
      "devis.modifier",
      "devis.envoyer",
      "factures.voir",
      "factures.emettre",
      "achats.gerer",
    ],
  },
  {
    key: "comptable",
    label: "Comptable",
    permissions: ["clients.voir", "devis.voir", "factures.voir", "prix.achat", "chantiers.rentabilite", "compta.acces"],
  },
  {
    key: "administrateur",
    label: "Administrateur (tous les droits)",
    permissions: ALL_PERMISSIONS,
  },
];

/** Droits effectifs d'un membre. */
export function effectivePermissions(role: "proprietaire" | "membre", granted: readonly string[]): Permission[] {
  if (role === "proprietaire") return ALL_PERMISSIONS;
  return granted.filter(isPermission);
}

export class ForbiddenError extends Error {
  constructor(public permission?: Permission) {
    super(permission ? `Accès refusé : « ${permissionLabel(permission)} » n'est pas autorisé pour votre compte` : "Accès refusé");
  }
}

export function can(ctx: { permissions: readonly string[] }, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

export function assertCan(ctx: { permissions: readonly string[] }, permission: Permission): void {
  if (!can(ctx, permission)) throw new ForbiddenError(permission);
}
