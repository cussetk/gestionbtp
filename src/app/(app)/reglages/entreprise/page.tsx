import type { Metadata } from "next";
import { loadSettingsPage } from "@/lib/settings-page";
import { PageHeader } from "@/components/ui";
import { IdentityForm } from "@/components/settings/identity-form";

export const metadata: Metadata = { title: "Entreprise" };

export default async function CompanySettingsPage() {
  const { bundle } = await loadSettingsPage();
  const { org, settings: s } = bundle;
  const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Entreprise" subtitle="Identité légale, siège et assurance" back="/reglages" />
      <IdentityForm
        initial={{
          name: org.name,
          tradeName: str(s.tradeName),
          legalForm: str(s.legalForm),
          siret: str(org.siret),
          shareCapital: s.shareCapitalCents == null ? "" : String(s.shareCapitalCents / 100).replace(".", ","),
          registration: str(s.registration),
          vatNumber: str(s.vatNumber),
          nafCode: str(s.nafCode),
          website: str(s.website),
          email: str(org.email),
          phone: str(org.phone),
          addressLine1: str(org.addressLine1),
          addressLine2: str(org.addressLine2),
          postalCode: str(org.postalCode),
          city: str(org.city),
          fluidCapacityCertificate: str(org.fluidCapacityCertificate),
          insurerName: str(s.insurerName),
          insurerAddress: str(s.insurerAddress),
          insurancePolicy: str(s.insurancePolicy),
          insuranceCoverage: str(s.insuranceCoverage),
        }}
      />
    </div>
  );
}
