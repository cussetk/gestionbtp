/**
 * Navigation de l'application, groupée comme la journée d'un climaticien.
 * Une rubrique « ready: false » est affichée grisée (bientôt) pour que rien ne soit caché.
 */
import type { Permission } from "./permissions";
import type { IconName } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  ready: boolean;
  /** Droit nécessaire pour voir la rubrique (sinon visible par tous). */
  permission?: Permission;
  /** Préfixes d'URL considérés comme « dans » la rubrique. */
  match?: string[];
};

export type NavSection = { label: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Commercial",
    items: [
      { href: "/clients", label: "Clients", icon: "users", ready: true, permission: "clients.voir", match: ["/clients", "/sites"] },
      { href: "/devis", label: "Devis", icon: "doc", ready: false, permission: "devis.voir" },
      { href: "/factures", label: "Factures", icon: "receipt", ready: false, permission: "factures.voir" },
    ],
  },
  {
    label: "Terrain",
    items: [
      { href: "/planning", label: "Planning", icon: "calendar", ready: false },
      { href: "/parc", label: "Parc", icon: "box", ready: false },
      { href: "/fluides", label: "Fluides", icon: "drop", ready: false, permission: "fluides.registre" },
    ],
  },
  {
    label: "Achats",
    items: [
      { href: "/fournisseurs", label: "Fournisseurs", icon: "truck", ready: false, permission: "achats.gerer" },
      { href: "/stock", label: "Stock", icon: "archive", ready: false, permission: "stock.gerer" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { href: "/comptabilite", label: "Comptabilité", icon: "chart", ready: false, permission: "compta.acces" },
      { href: "/equipe", label: "Mon équipe", icon: "badge", ready: true, permission: "equipe.gerer" },
      { href: "/reglages", label: "Réglages", icon: "settings", ready: true, permission: "reglages.gerer" },
    ],
  },
];

export function visibleNav(permissions: readonly string[]): NavSection[] {
  return NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.permission || permissions.includes(i.permission)),
  })).filter((s) => s.items.length > 0);
}

export function isActive(item: Pick<NavItem, "href" | "match">, pathname: string): boolean {
  return (item.match ?? [item.href]).some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
