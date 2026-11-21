"use client";

import { useEffect, useState } from "react";
import { Landmark, Layers, Target } from "lucide-react";
import { INVESTMENT_PURPOSES, LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/scoringEngine";
import { num, pct, ron } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { BenchmarkRow, ScoreRing } from "../charts";
import { LoanSimulator } from "../LoanSimulator";
import { LoanCostBreakdown } from "../LoanCostBreakdown";
import { StressTestPanel } from "../StressTestPanel";
import { ProductComparator } from "../ProductComparator";
import { SequentialQuiz } from "../SequentialQuiz";
import { PageHeader, StepFooter } from "../Shell";
import { Badge, Card, CardHeader, cx, inputCls } from "../ui";

export function InvestmentStep() {
  const { company, investment, setInvestment, assessment, markVisited } = useAssessment();
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
  const pts = (id: string) => ev.items.find((i) => i.id === id)?.points ?? 0;

  return (
    <div className="animate-rise">
      <PageHeader
        step={3}
        title="Scopul investiției & comparație cu sectorul"
        subtitle="Trei întrebări despre finanțare și poziționarea firmei față de alte firme cu același cod CAEN. Pilonul cântărește 15% din scorul final."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SequentialQuiz
          kind="investment"
          className=""
          icon={<Target size={18} />}
          title="Formularul de investiție"
          subtitle={`Scor formular: ${ev.total}/100 · 50% din S_Investiție`}
          steps={[
            {
              key: "purpose",
              answered: investment.purpose != null,
              content: (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">1. Destinația principală a finanțării</p>
                    <Badge tone="navy">{pts("purpose")}/50 p</Badge>
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
                    <Badge tone="navy">{pts("ownContribution")}/30 p</Badge>
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
                    <Badge tone="navy">{pts("leverage")}/20 p</Badge>
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
          result={
            <div className="rounded-xl border border-line bg-canvas p-5">
              <div className="flex flex-wrap items-center gap-5">
                <div>
                  <p className="text-[11px] font-semibold text-faint">Scor formular</p>
                  <p className="text-4xl font-medium text-ink">
                    {ev.total}
                    <span className="text-lg text-faint">/100</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-faint">S_Investiție</p>
                  <p className="text-2xl font-medium text-ink">{assessment.final.pillars.investment.score}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-faint">Scor final</p>
                  <p className="text-2xl font-medium text-ink">{assessment.final.finalScore}</p>
                </div>
                <div className="flex-1">
                  <Badge tone={ev.total >= 70 ? "emerald" : ev.total >= 40 ? "amber" : "red"}>
                    {ev.total >= 70 ? "Finanțare bine fundamentată" : ev.total >= 40 ? "Fundamentare parțială" : "Fundamentare slabă"}
                  </Badge>
                  <p className="mt-1.5 text-[11px] text-muted">Praguri: 70–100 bine fundamentată · 40–69 parțială · 0–39 slabă</p>
                  {ev.overLeveragedRequest && <p className="mt-1.5 text-xs font-semibold text-red">Alertă de supraîndatorare: suma depășește 50% din CA anualizată.</p>}
                </div>
              </div>
              <ul className="mt-4 space-y-3 border-t border-line pt-4">
                {ev.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-ink">{i.question}</p>
                      <p className="text-muted">{i.detail}</p>
                    </div>
                    <span className={cx("shrink-0 font-semibold", i.points === i.maxPoints ? "text-emerald-strong" : i.points === 0 ? "text-red" : "text-amber")}>
                      {i.points}/{i.maxPoints}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          }
        />

        <div className="space-y-5">
          <Card>
            <CardHeader icon={<Landmark size={18} />} title="S_Investiție" subtitle="0,5 × formular + 0,5 × comparație cu sectorul" />
            <div className="flex items-center gap-5">
              <ScoreRing score={assessment.final.pillars.investment.score} size={132} stroke={7} />
              <div className="space-y-2 text-sm">
                <p>
                  Formular: <strong>{ev.total}</strong>/100
                </p>
                <p>
                  Benchmark sector (orientativ): <strong>{num(bench.score)}</strong>/100
                </p>
                <p className="text-xs text-muted">= {num(assessment.final.pillars.investment.points)} din 15 puncte finale</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <LoanSimulator />

      <LoanCostBreakdown />

      <StressTestPanel />

      <ProductComparator />

      <Card className="mt-5">
        <CardHeader
          icon={<Layers size={18} />}
          title={`Firma ta vs. sectorul ${bench.sector.shortLabel}`}
          subtitle={`${assessment.sectorSource === "caen" ? `mapat din CAEN ${company.caenCode}` : assessment.sectorSource === "manual" ? "sector ales manual (fără CAEN)" : "implicit General IMM (fără CAEN)"} · ${bench.sector.label} · valori de referință orientative (nu statistici oficiale) · scor ${num(bench.score)}/100 (cuartila cea mai bună = 100, mediana = 60, cuartila cea mai slabă = 25)`}
        />
        <div className="divide-y divide-line">
          {bench.items.map((i) => (
            <BenchmarkRow key={i.id} item={i} />
          ))}
        </div>
      </Card>

      <StepFooter prev="/analiza" next="/profil" nextLabel="Vezi profilul Credit Ready" />
    </div>
  );
}
