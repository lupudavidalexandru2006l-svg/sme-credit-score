"use client";

import { useEffect, useState } from "react";
import { Layers, Target } from "lucide-react";
import { INVESTMENT_PURPOSES, LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/scoringEngine";
import { num, pct, ron } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { BenchmarkRow } from "../charts";
import { LoanSimulator } from "../LoanSimulator";
import { LoanCostBreakdown } from "../LoanCostBreakdown";
import { StressTestPanel } from "../StressTestPanel";
import { ProductComparator } from "../ProductComparator";
import { SequentialQuiz } from "../SequentialQuiz";
import { GatedFooter, PageHeader, StepDoneNote } from "../Shell";
import { Card, CardHeader, cx, inputCls } from "../ui";

export function InvestmentStep() {
  const { company, investment, setInvestment, assessment, markVisited, completedSteps, quizCompleted } = useAssessment();
  const m = assessment.metrics;
  const ev = assessment.investment;
  const bench = assessment.benchmark;
  const [amountText, setAmountText] = useState(investment.requestedAmount ? investment.requestedAmount.toLocaleString("ro-RO") : "");
  useEffect(() => markVisited("investitie"), [markVisited]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external changes (demo fill) into the text input
    setAmountText(investment.requestedAmount ? investment.requestedAmount.toLocaleString("ro-RO") : "");
  }, [investment.requestedAmount]);

  const ratio = Number.isFinite(ev.leverageRatio) ? ev.leverageRatio : 0;
  const ratioTone = ratio <= 0.25 ? "bg-emerald" : ratio <= 0.5 ? "bg-amber" : "bg-red";
  const own = investment.ownContributionPct;

  return (
    <div className="animate-rise">
      <PageHeader
        step={3}
        title="Scopul investiției & comparație cu sectorul"
        subtitle="Trei întrebări despre finanțare și poziționarea firmei față de alte firme cu același cod CAEN. Pilonul cântărește 15% din scorul final."
      />

      <div>
        <SequentialQuiz
          kind="investment"
          className=""
          icon={<Target size={18} />}
          title="Formularul de investiție"
          subtitle="3 întrebări despre finanțare. Rezultatul va fi calculat la final (Pasul 4)."
          steps={[
            {
              key: "purpose",
              answered: investment.purpose != null,
              content: (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">1. Destinația principală a finanțării</p>
                  </div>
                  <div role="radiogroup" aria-label="Destinația finanțării" className="grid gap-2 sm:grid-cols-2">
                    {INVESTMENT_PURPOSES.map((p) => {
                      const active = investment.purpose === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setInvestment({ purpose: p.value })}
                          className={cx("rounded-xl border p-3.5 text-left transition-colors", active ? "border-navy bg-navy text-white" : "border-line-strong bg-white hover:border-navy-3")}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{p.label}</span>
                            <span className={cx("text-xs font-semibold", active ? "text-emerald-soft" : "text-faint")}>{p.points} p</span>
                          </span>
                          <span className={cx("mt-0.5 block text-xs", active ? "text-white/70" : "text-muted")}>{p.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ),
            },
            {
              key: "own",
              answered: own != null,
              content: (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">2. Aport propriu (avans)</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={own ?? 0}
                      onChange={(e) => setInvestment({ ownContributionPct: Number(e.target.value) })}
                      className="flex-1"
                      aria-label="Aport propriu în procente"
                    />
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={cx(inputCls, "pr-7 text-right font-semibold")}
                        value={own ?? ""}
                        placeholder="—"
                        onChange={(e) => setInvestment({ ownContributionPct: e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-faint">%</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">peste 20%: 30 p · 10–20%: 20 p · sub 10%: 5 p</p>
                </div>
              ),
            },
            {
              key: "amount",
              answered: (investment.requestedAmount ?? 0) > 0,
              content: (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">3. Suma solicitată</p>
                  </div>
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      className={cx(inputCls, "pr-14 text-base font-semibold")}
                      placeholder="ex. 900.000"
                      value={amountText}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setAmountText(digits ? Number(digits).toLocaleString("ro-RO") : "");
                        setInvestment({ requestedAmount: digits ? Number(digits) : null });
                      }}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-faint">RON</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-canvas p-4">
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      <span className="text-muted">
                        CA anualizată din e-Factura (media lunară × 12): <strong className="text-ink">{assessment.dataStatus.hasInvoices ? ron(m.annualizedRevenue) : "fără facturi încărcate"}</strong>
                      </span>
                      <span className="font-semibold text-ink">{pct(ratio * 100)} din CA</span>
                    </div>
                    <div className="relative mt-2 h-2.5 rounded-full bg-white">
                      <div className={cx("h-full rounded-full transition-all duration-500", ratioTone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                      <span className="absolute top-[-3px] h-4 w-0.5 bg-navy-3" style={{ left: "25%" }} title="25%" />
                      <span className="absolute top-[-3px] h-4 w-0.5 bg-red" style={{ left: "50%" }} title="50%" />
                    </div>
                    <div className="mt-1 flex text-[10px] text-faint">
                      <span className="w-1/4">≤ 25%: 20 p</span>
                      <span className="w-1/4">25–50%: 12 p</span>
                      <span>&gt; 50%: 0 p · alertă supraîndatorare</span>
                    </div>
                    {(investment.requestedAmount ?? 0) > 0 && (
                      <p className="mt-3 text-xs text-muted">
                        Rată estimată: <strong className="text-ink">{ron(assessment.business.loanInstallment)}/lună</strong> ({LOAN_ANNUAL_RATE * 100}%/an, {investment.termMonths ?? LOAN_MONTHS} luni) → DSCR{" "}
                        <strong className={assessment.business.dscr < 1.25 ? "text-red" : "text-ink"}>{num(assessment.business.dscr)}×</strong> (prag BCR 1,25×; influențează și pilonul Business).
                      </p>
                    )}
                    {ev.overLeveragedRequest && <p className="mt-2 text-xs font-semibold text-red">Alertă de supraîndatorare: suma depășește 50% din CA anualizată.</p>}
                  </div>
                </div>
              ),
            },
          ]}
          result={<StepDoneNote text="Formular de investiție finalizat — Rezultatul va fi calculat la final (Pasul 4)." />}
        />
      </div>

      <LoanSimulator />

      <LoanCostBreakdown />

      <StressTestPanel />

      <ProductComparator />

      <Card className="mt-5">
        <CardHeader
          icon={<Layers size={18} />}
          title={`Firma ta vs. sectorul ${bench.sector.shortLabel}`}
          subtitle={`${assessment.sectorSource === "caen" ? `mapat din CAEN ${company.caenCode}` : assessment.sectorSource === "manual" ? "sector ales manual (fără CAEN)" : "implicit General IMM (fără CAEN)"} · ${bench.sector.label} · valori de referință orientative (nu statistici oficiale)`}
        />
        <div className="divide-y divide-line">
          {bench.items.map((i) => (
            <BenchmarkRow key={i.id} item={i} />
          ))}
        </div>
      </Card>

      <GatedFooter prev="/analiza" next="/profil" label="Vezi Profilul & Planul Final" error={!completedSteps.step2 ? "Finalizează întâi Pașii 1 și 2." : !quizCompleted.investment ? "Finalizează Formularul de Investiție (toate cele 3 întrebări) înainte de a continua." : null} />
    </div>
  );
}
