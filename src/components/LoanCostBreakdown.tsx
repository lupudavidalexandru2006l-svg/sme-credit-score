"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/bcr-formulas";
import { loanCostBreakdown, VAT_OPTIONS } from "@/lib/loan-math";
import { num, ron } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { Card, CardHeader, cx, Field, inputCls } from "./ui";

function Line({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3 py-2", strong && "border-t border-line font-medium")}>
      <dt className={cx("text-sm", strong ? "text-ink" : "text-muted")}>
        {label}
        {hint && <span className="block text-[11px] font-normal text-faint">{hint}</span>}
      </dt>
      <dd className={cx("shrink-0 text-right text-sm", strong ? "text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

/**
 * Transparent cost of the requested loan: VAT, own contribution, financed amount, the annuity
 * R = P·r(1+r)^n / ((1+r)^n − 1), average principal and interest per month, total interest and total repaid.
 */
export function LoanCostBreakdown() {
  const { investment, setInvestment } = useAssessment();
  const [vatRate, setVatRate] = useState<number>(VAT_OPTIONS[0].rate);
  const [ratePct, setRatePct] = useState<number>(LOAN_ANNUAL_RATE * 100);
  const [financeVat, setFinanceVat] = useState(false);
  const amount = investment.requestedAmount ?? 0;
  const months = investment.termMonths ?? LOAN_MONTHS;
  const b = loanCostBreakdown({ netAmount: amount, vatRate, ownContributionPct: investment.ownContributionPct ?? 0, annualRatePct: ratePct, months, financeVat });

  return (
    <Card className="mt-5 break-inside-avoid">
      <CardHeader
        icon={<Receipt size={18} />}
        title="Costul creditului: TVA, aport, rată și dobândă pe lună"
        subtitle="Formula anuității R = P · r(1+r)ⁿ / ((1+r)ⁿ − 1), cu r = dobânda anuală / 12 și n = numărul de luni."
      />
      {amount <= 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-3 text-xs text-muted">Completează suma solicitată (fără TVA) în formularul de mai sus ca să vezi defalcarea costului.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-4">
            <Field label="TVA aplicabil investiției">
              <select className={inputCls} value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}>
                {VAT_OPTIONS.map((o) => (
                  <option key={o.label} value={o.rate}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dobândă anuală (%)" hint="Orientativ IMM România: 8,2–13,5%/an (ROBOR/IRCC + marjă). Vezi cardurile bancare pentru fiecare pachet.">
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                className={inputCls}
                value={ratePct}
                onChange={(e) => setRatePct(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
              />
            </Field>
            <Field label="Durata (luni)">
              <select className={inputCls} value={months} onChange={(e) => setInvestment({ termMonths: Number(e.target.value) })}>
                {[12, 24, 36, 48, 60, 72, 84].map((m) => (
                  <option key={m} value={m}>
                    {m} luni
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={financeVat} onChange={(e) => setFinanceVat(e.target.checked)} />
              Banca finanțează și TVA-ul (firmă neplătitoare de TVA). Plătitorii de TVA îl recuperează de la stat, deci banca finanțează de regulă valoarea fără TVA.
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <dl className="rounded-2xl border border-line p-4">
              <p className="mb-1 text-[11px] font-semibold text-faint">Investiția</p>
              <Line label="Suma solicitată (fără TVA)" value={ron(b.netAmount)} />
              <Line label={`TVA ${num(vatRate * 100)}%`} value={ron(b.vat)} />
              <Line label="Total investiție cu TVA" value={ron(b.totalWithVat)} strong />
              <Line label="Aport propriu" value={`${ron(b.ownContribution)} (${num(b.ownContributionPct)}%)`} hint="procent din totalul cu TVA" />
              <Line label="Suma finanțată de bancă" value={ron(b.financed)} strong />
            </dl>
            <dl className="rounded-2xl border border-emerald/30 bg-emerald-soft/30 p-4">
              <p className="mb-1 text-[11px] font-semibold text-faint">Rambursarea</p>
              <Line label="Rata lunară estimată" value={`${ron(b.monthlyInstallment)} / lună`} strong />
              <Line label="Principal mediu / lună" value={ron(b.avgPrincipalPerMonth)} />
              <Line label="Dobândă medie / lună" value={ron(b.avgInterestPerMonth)} hint={`prima lună: ${ron(b.firstMonthInterest)}`} />
              <Line label="Dobândă anuală" value={`${num(b.annualRatePct)}%`} />
              <Line label={`Total dobândă (${b.months} luni)`} value={ron(b.totalInterest)} />
              <Line label="Total de rambursat" value={ron(b.totalRepaid)} strong />
            </dl>
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] text-faint">Calcul orientativ, fără comisioane de analiză / administrare și fără asigurări; costul final apare în oferta băncii (DAE).</p>
    </Card>
  );
}
