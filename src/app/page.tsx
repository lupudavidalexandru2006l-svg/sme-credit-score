import { AssessmentWizard } from "@/components/wizard/AssessmentWizard";
import { loadCompanyAssessment } from "@/app/actions/loadCompany";
function BrandMark() {
  // Built from primitives: three rising bars inside an extruded tile.
  return (
    <span className="neu-raised-sm grid h-11 w-11 place-items-center rounded-2xl">
      <span className="flex h-5 items-end gap-[3px]">
        <span className="h-2 w-[5px] rounded-sm bg-stone/60" />
        <span className="h-3.5 w-[5px] rounded-sm bg-stone/80" />
        <span className="h-5 w-[5px] rounded-sm bg-stone" />
      </span>
    </span>
  );
}

export default async function Home() {
  const initialAssessment = await loadCompanyAssessment();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-[36px] bg-card p-4 shadow-[0_40px_90px_-20px_rgba(3,32,61,.9)] ring-1 ring-white/5 sm:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandMark />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">SME Credit Readiness</h1>
              <p className="text-xs text-muted">e-Factura · Factor uman · Scopul investiției</p>
            </div>
          </div>
          <div className="neu-pressed-sm hidden rounded-full px-4 py-2 font-mono text-[11px] text-muted sm:block">
            70% Business · 15% Uman · 15% Investiție
          </div>
        </header>
        <AssessmentWizard initialAssessment={initialAssessment} />
      </div>
      <p className="mt-6 text-center text-[11px] text-white/50">
        MVP demonstrativ · date e-Factura și S_Business simulate · verificare legală prin portalquery.just.ro
      </p>
    </main>
  );
}
