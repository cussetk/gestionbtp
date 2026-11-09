import type { Metadata } from "next";
import { loadSettingsPage } from "@/lib/settings-page";
import { PageHeader } from "@/components/ui";
import { BrandingForm } from "@/components/settings/branding-form";

export const metadata: Metadata = { title: "Mise en page" };

export default async function DocumentsSettingsPage() {
  const { bundle } = await loadSettingsPage();
  const s = bundle.settings;
  return (
    <>
      <PageHeader title="Mise en page" subtitle="Vos devis et factures à votre image" back="/reglages" />
      <BrandingForm
        logo={bundle.logo}
        initial={{ primaryColor: s.primaryColor, accentColor: s.accentColor, template: s.template, logoPosition: s.logoPosition, font: s.font }}
      />
    </>
  );
}
