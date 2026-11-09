import "server-only";
import { cache } from "react";
import { requirePermission, toCtx } from "./session";
import { getSettings } from "@/server/settings";
import { checkCompliance } from "./compliance";

/** Réglages et contrôle de conformité de la requête (dédupliqués entre la mise en page et la page). */
export const loadSettingsPage = cache(async () => {
  const session = await requirePermission("reglages.gerer");
  const bundle = await getSettings(toCtx(session));
  const issues = checkCompliance({
    org: bundle.org,
    settings: bundle.settings,
    activeTaxRates: bundle.taxRates.filter((r) => r.active).length,
    hasLogo: !!bundle.logo,
  });
  return { session, bundle, issues };
});
