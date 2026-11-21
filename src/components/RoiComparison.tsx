"use client";

import { useState } from "react";
import { Card, CardHeader, Field } from "./ui";
import { CONSULTING_BENCHMARK, computeRoi, EUR_RON, formatRon, ROI_COMPARISON } from "@/lib/pricing";

const fmt = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);

/** "De ce merită?" — traditional consultancy vs. Afghankingz Credit, with a yearly-savings calculator. */
export function RoiComparison() {
  const [files, setFiles] = useState(2);
  const [hours, setHours] = useState(12);
  const roi = computeRoi({ filesPerYear: files, hoursPerYear: hours });

  return (
    <Card>
      <CardHeader title="De ce merită? Consultanță clasică vs. Afghankingz Credit" subtitle="Prețuri reale de piață pentru pregătirea unui dosar de credit IMM în România." />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2.5 pr-4 font-normal" />
              <th className="py-2.5 pr-4 font-normal">Consultanță financiară tradițională</th>
              <th className="py-2.5 font-medium text-emerald-strong">Afghankingz Credit</th>
            </tr>
          </thead>
          <tbody>
            {ROI_COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <td className="py-3 pr-4 font-medium text-ink">{row.label}</td>
                <td className="py-3 pr-4 text-muted">{row.traditional}</td>
                <td className="py-3 text-ink">{row.creditReady}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-7 grid gap-6 rounded-2xl bg-canvas p-5 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-sm font-medium text-ink">Câte ore de consultanță sau câte dosare de finanțare estimezi pe an?</p>
          <Field label={`Dosare de finanțare pe an: ${files}`} hint={`${fmt(CONSULTING_BENCHMARK.filePrepEur.min)}–${fmt(CONSULTING_BENCHMARK.filePrepEur.max)} EUR per dosar la un consultant`}>
            <input type="range" min={0} max={10} step={1} value={files} onChange={(e) => setFiles(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label={`Ore de consultanță pe an: ${hours}`} hint={`${CONSULTING_BENCHMARK.hourlyRon.min}–${CONSULTING_BENCHMARK.hourlyRon.max} RON / oră pentru actualizări`}>
            <input type="range" min={0} max={80} step={2} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" />
          </Field>
        </div>
        <div className="rounded-2xl bg-white p-5 text-center shadow-card">
          <p className="text-xs text-muted">Economisești anual cu Afghankingz Credit Pro</p>
          <p key={roi.savingsRon} className="animate-rise mt-2 text-[40px] font-light leading-none tracking-tight text-emerald-strong">
            {formatRon(roi.savingsRon)}
          </p>
          <p className="mt-1.5 text-sm text-muted">≈ {fmt(roi.savingsEur)} EUR</p>
          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Consultanță ≈ {formatRon(roi.consultingRon)}/an vs. Pro facturat anual {formatRon(roi.platformRon)}/an
            {roi.consultingRon > 0 ? ` · ${roi.savingsPct}% mai puțin` : ""}. Medie de piață, 1 EUR = {EUR_RON} RON.
          </p>
        </div>
      </div>
    </Card>
  );
}
