import type { Metadata } from "next";
import { PricingSection } from "@/components/PricingSection";
import { RoiComparison } from "@/components/RoiComparison";
import { FeatureMatrix, PricingFaq } from "@/components/PricingDetails";
import { Disclaimer } from "@/components/ui";

export const metadata: Metadata = {
  title: "Prețuri și planuri — Credit Ready",
  description: "Planurile Credit Ready pentru IMM-uri și contabili, oferta B2B pentru bănci și calculatorul de economii față de consultanța clasică.",
};

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <p className="text-xs text-faint">Prețuri / Planuri</p>
        <h1 className="mt-2 text-[28px] font-normal leading-tight tracking-tight text-ink sm:text-[34px]">Pregătire de finanțare, la o fracțiune din costul unui consultant</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Începe gratuit, apoi deblochează analiza completă e-Factura, verificările oficiale și recomandarea băncilor din România.
        </p>
      </div>
      <PricingSection />
      <RoiComparison />
      <FeatureMatrix />
      <PricingFaq />
      <Disclaimer />
    </div>
  );
}
