import type { Metadata } from "next";
import { loadSettingsPage } from "@/lib/settings-page";
import { formatIban } from "@/lib/company";
import { PageHeader } from "@/components/ui";
import { PaymentForm } from "@/components/settings/payment-form";

export const metadata: Metadata = { title: "Paiement et CGV" };

export default async function PaymentSettingsPage() {
  const { bundle } = await loadSettingsPage();
  const s = bundle.settings;
  return (
    <div className="lg:max-w-3xl">
      <PageHeader title="Paiement et CGV" subtitle="Conditions imprimées sur vos devis et factures" back="/reglages" />
      <PaymentForm
        methods={s.paymentMethods}
        initial={{
          quoteValidityDays: String(s.quoteValidityDays),
          depositPercent: String(s.depositPercent),
          quoteFooter: s.quoteFooter ?? "",
          paymentTermsDays: String(s.paymentTermsDays),
          latePenaltyText: s.latePenaltyText ?? "",
          earlyPaymentDiscountText: s.earlyPaymentDiscountText ?? "",
          invoiceFooter: s.invoiceFooter ?? "",
          bankName: s.bankName ?? "",
          iban: s.iban ? formatIban(s.iban) : "",
          bic: s.bic ?? "",
          cgv: s.cgv ?? "",
        }}
      />
    </div>
  );
}
