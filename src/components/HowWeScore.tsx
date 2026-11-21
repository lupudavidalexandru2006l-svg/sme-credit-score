"use client";

import { Info } from "lucide-react";
import {
  BUSINESS_WEIGHTS,
  CONCENTRATION_BANDS,
  CV_BANDS,
  DSCR_BANDS,
  DSO_BANDS,
  LOAN_RATE_RANGE_PCT,
  QUIZ_KILL_SWITCH_MAX,
  QUIZ_KILL_SWITCH_PENALTY,
  RESILIENCE_BANDS,
  STORNO_PENALTY,
  STORNO_PENALTY_THRESHOLD_PCT,
  type Band,
} from "@/lib/bcr-formulas";
import { num } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { Card, CardHeader, cx, Disclaimer } from "./ui";

function Bands({ bands, active }: { bands: Band[]; active: number }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {bands.map((b) => (
        <span
          key={b.label}
          className={cx(
            "rounded-full border px-2 py-0.5 text-[10px]",
            b.points === active ? "border-navy bg-navy text-white" : "border-line bg-white/70 text-muted",
          )}
        >
          {b.label} → {b.points} p
        </span>
      ))}
    </div>
  );
}

/** "Cum calculăm scorul": every formula and threshold, with the active company's values highlighted. */
export function HowWeScore() {
  const { assessment } = useAssessment();
  const { business: b, final: f, quiz: q, investment: inv, benchmark: bench } = assessment;
  const item = (id: string) => b.items.find((i) => i.id === id)!;
  const rows = [
    { id: "stability", w: BUSINESS_WEIGHTS.stability, bands: CV_BANDS, formula: "CV = σ / μ al vânzărilor lunare nete (12 luni)" },
    {
      id: "repayment",
      w: BUSINESS_WEIGHTS.repayment,
      bands: DSCR_BANDS,
      formula: `R = P · r(1+r)ⁿ / ((1+r)ⁿ − 1), r = ${num(b.loan.annualRatePct)}% / 12, n = ${b.loan.months}; DSCR = EBITDA lunar / (rate existente + R)`,
    },
    {
      id: "payments",
      w: BUSINESS_WEIGHTS.payments,
      bands: DSO_BANDS,
      formula: `DSO real ponderat cu valoarea facturilor; stornări 381 > ${STORNO_PENALTY_THRESHOLD_PCT}% (3 luni) → −${STORNO_PENALTY} p`,
    },
    { id: "concentration", w: BUSINESS_WEIGHTS.concentration, bands: CONCENTRATION_BANDS, formula: "Ponderea clientului #1 în vânzările pe 12 luni" },
    {
      id: "seasonality",
      w: BUSINESS_WEIGHTS.seasonality,
      bands: RESILIENCE_BANDS,
      formula: "Marja brută medie din cele mai slabe 3 luni / (cheltuieli fixe + rate existente + rata nouă)",
    },
  ];

  return (
    <Card className="mt-5" id="cum-calculam">
      <CardHeader
        icon={<Info size={18} />}
        title="Cum calculăm scorul"
        subtitle="Formula este publică, aliniată criteriilor de underwriting IMM din România, și identică pe client și pe server (lib/scoring.ts, lib/bcr-formulas.ts)."
      />

      <div className="rounded-xl bg-canvas p-4 font-mono text-xs leading-relaxed text-ink">
        <p>ScorFinal = 0,70 × S_Business + 0,15 × S_Uman + 0,15 × S_Investiție (limitat 0–100)</p>
        <p className="text-muted">
          = 0,70 × {num(f.pillars.business.score)} + 0,15 × {num(f.pillars.human.score)} + 0,15 × {num(f.pillars.investment.score)} = {num(f.rawScore)}
          {f.quizKillSwitch && <span className="text-red"> − {QUIZ_KILL_SWITCH_PENALTY} (kill-switch) = {num(f.finalScore)}</span>}
        </p>
        <p className={cx("mt-1", f.quizKillSwitch ? "text-red" : "text-muted")}>
          Kill-switch guvernanță: ScorQuiz ≤ {QUIZ_KILL_SWITCH_MAX} → −{QUIZ_KILL_SWITCH_PENALTY} p din ScorFinal (acum Quiz = {q.total}
          {f.quizKillSwitch ? ", ACTIV" : ", inactiv"})
        </p>
      </div>

      <h3 className="mt-5 text-sm font-medium text-ink">
        S_Business · 70% <span className="text-xs font-normal text-muted">= {num(b.score)} / 100</span>
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-faint">
            <tr>
              <th className="py-2 pr-3 font-semibold">Sub-indicator</th>
              <th className="py-2 pr-3 font-semibold">Pondere</th>
              <th className="py-2 pr-3 font-semibold">Formulă și praguri</th>
              <th className="py-2 text-right font-semibold">Firma activă</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const it = item(r.id);
              const base = r.id === "payments" && b.stornoPenaltyApplied ? it.score + STORNO_PENALTY : it.score;
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 font-medium text-ink">{it.label}</td>
                  <td className="py-2.5 pr-3">{Math.round(r.w * 100)}%</td>
                  <td className="py-2.5 pr-3 text-muted">
                    {r.formula}
                    <Bands bands={r.bands} active={Math.min(100, base)} />
                  </td>
                  <td className="py-2.5 text-right">
                    <p className="font-semibold text-ink">{num(it.score)} p</p>
                    <p className="text-[11px] text-muted">{it.value}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 text-xs leading-relaxed text-muted md:grid-cols-2">
        <div className="rounded-xl bg-canvas p-4">
          <p className="mb-1 text-sm font-semibold text-ink">S_Uman · 15% = {num(f.pillars.human.score)}</p>
          {f.pillars.human.externalScore !== undefined ? (
            <>
              S_Uman = 0,50 × ScorQuiz + 0,50 × ScorVerificariExterne = 0,5 × {q.total} + 0,5 × {num(f.pillars.human.externalScore)}. Quiz: 5 întrebări (35 + 25 + 20 + 12 + 8 = 100 p)
              validate automat pe facturile e-Factura încărcate. Verificări externe: media ponderată a surselor reale care au răspuns — portal.just.ro 30%
              {assessment.legalScore !== null ? ` (scor legal ${num(assessment.legalScore)})` : " (indisponibil)"}, ANAF 25%, stare juridică ONRC 20%, bilanț 15%, VIES 10%. O sursă care
              nu răspunde sau cere CUI nu primește un punctaj inventat: este scoasă din medie.
            </>
          ) : (
            <>
              S_Uman = 0,50 × ScorQuiz + 0,50 × ScorVerificariExterne. Nicio sursă externă nu a răspuns încă
              {assessment.legalPending ? " (portal.just.ro neverificat)" : ""}: scorul rămâne incomplet până la prima verificare reușită — nu folosim un punctaj neutru.
            </>
          )}
        </div>
        <div className="rounded-xl bg-canvas p-4">
          <p className="mb-1 text-sm font-semibold text-ink">S_Investiție · 15% = {num(f.pillars.investment.score)}</p>
          S_Investiție = 0,50 × ScorFormular + 0,50 × ScorComparațieIndustrie = 0,5 × {inv.total} + 0,5 × {num(bench.score)}. Formular: destinație 50 p + aport 30 p + sumă / CA anualizată
          20 p. Comparație cu sectorul „{bench.sector.shortLabel}”
          {assessment.sectorSource === "caen" ? " (din codul CAEN)" : assessment.sectorSource === "manual" ? " (ales manual)" : " (implicit, fără CAEN)"}: DSO, concentrare, stornări,
          sezonalitate, marjă vs. p25 / mediană / p75 (valori de referință orientative, nu statistici oficiale).
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Dobândă orientativă IMM în România: {num(LOAN_RATE_RANGE_PCT[0])}–{num(LOAN_RATE_RANGE_PCT[1])}%/an; scorul folosește capătul inferior și maturitatea de {b.loan.months} de luni.
        EBITDA lunar estimat = vânzări medii − achiziții medii (din facturile e-Factura) − cheltuieli fixe declarate de tine în Pasul 2. DSCR include și ratele existente, ca în analiza de credit a băncii.
      </p>
      <Disclaimer className="mt-4" />
    </Card>
  );
}
