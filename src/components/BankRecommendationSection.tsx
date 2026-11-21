"use client";

import { ChevronDown, CircleAlert, CircleCheck, Info, Landmark, ShieldAlert, Trophy } from "lucide-react";
import type { BankRecommendation } from "@/lib/bank-matcher";
import { num, ron } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { LockedGate } from "./PlanGate";
import { Badge, Card, CardHeader, cx, ProgressBar } from "./ui";

const BANK_SHORT: Record<string, string> = {
  BCR: "BCR",
  "Banca Transilvania": "BT",
  "ING Bank România": "ING",
  "Raiffeisen Bank România": "RB",
  "CEC Bank": "CEC",
  "UniCredit Bank România": "UC",
};

/** Monogram badge built from UI primitives (no bank logos are copied). */
function BankMark({ bank, large }: { bank: string; large?: boolean }) {
  const initials = BANK_SHORT[bank] ?? bank.slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-xl bg-navy font-semibold tracking-tight text-white",
        large ? "h-12 w-12 text-sm" : "h-9 w-9 text-[11px]",
      )}
    >
      {initials}
    </span>
  );
}

const matchTone = (pct: number) => (pct >= 80 ? "emerald" : pct >= 60 ? "blue" : pct >= 45 ? "amber" : "red");

function Facts({ r }: { r: BankRecommendation }) {
  const facts = [
    { label: "Sumă maximă estimată", value: r.maxAmount > 0 ? ron(r.maxAmount) : "—", hint: r.maxAmountBasis },
    { label: "Maturitate orientativă", value: r.maturityLabel },
    { label: "Cost orientativ", value: r.rateLabel },
    r.dscrAtProduct !== null
      ? { label: "DSCR la acest produs", value: r.dscrAtProduct >= 99 ? "fără datorii" : `${num(r.dscrAtProduct)}×`, hint: r.monthlyCost > 0 ? `cost lunar estimat ${ron(r.monthlyCost)}` : undefined }
      : { label: "Rambursare", value: "din încasarea facturilor", hint: "fără rată lunară fixă" },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="rounded-xl border border-line/80 bg-white/60 p-3">
          <dt className="text-[11px] text-muted">{f.label}</dt>
          <dd className="mt-1 text-sm font-medium text-ink">{f.value}</dd>
          {f.hint && <dd className="mt-0.5 text-[11px] leading-snug text-faint">{f.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function ReasonLists({ r, compact }: { r: BankRecommendation; compact?: boolean }) {
  const conditions = compact ? r.conditions.slice(0, 2) : r.conditions;
  return (
    <div className={cx("grid gap-4", !compact && "md:grid-cols-2")}>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink">De ce se potrivește</p>
        <ul className="space-y-1.5">
          {r.reasons.map((x) => (
            <li key={x} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
              <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-strong" /> {x}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink">Ce trebuie rezolvat înainte de aplicare</p>
        {conditions.length ? (
          <ul className="space-y-1.5">
            {conditions.map((x) => (
              <li key={x} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-amber" /> {x}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Niciun blocaj identificat pe datele analizate.</p>
        )}
      </div>
    </div>
  );
}

function TopPick({ r }: { r: BankRecommendation }) {
  return (
    <article className="rounded-2xl border-2 border-emerald/40 bg-emerald-soft/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <BankMark bank={r.bank} large />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="emerald">
                <Trophy size={12} /> Cea mai bună potrivire
              </Badge>
              <Badge tone="neutral">{r.kindLabel}</Badge>
              <Badge tone={r.eligible ? "emerald" : "amber"}>{r.eligible ? "Criterii minime îndeplinite" : "Eligibilitate condiționată"}</Badge>
            </div>
            <h3 className="mt-2 text-lg font-medium leading-tight text-ink">{r.bank}</h3>
            <p className="text-sm text-muted">{r.product}</p>
            <p className="mt-1 text-[11px] text-faint">Ideal pentru: {r.idealFor}</p>
          </div>
        </div>
        <div className="w-40 text-right">
          <p className="text-[11px] text-muted">Potrivire</p>
          <p className="text-4xl font-light tracking-tight text-ink">
            {r.matchPct}
            <span className="text-lg text-faint">%</span>
          </p>
          <ProgressBar value={r.matchPct} tone={matchTone(r.matchPct)} className="mt-1" />
        </div>
      </div>
      <div className="mt-4">
        <Facts r={r} />
      </div>
      <div className="mt-4">
        <ReasonLists r={r} />
      </div>
    </article>
  );
}

function Alternative({ r, rank }: { r: BankRecommendation; rank: number }) {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <BankMark bank={r.bank} />
          <div className="min-w-0">
            <p className="text-[11px] text-faint">Alternativa {rank}</p>
            <p className="text-sm font-medium leading-tight text-ink">{r.bank}</p>
            <p className="text-xs leading-snug text-muted">{r.product}</p>
          </div>
        </div>
        <span className={cx("shrink-0 text-xl font-light", r.matchPct >= 80 ? "text-emerald-strong" : r.matchPct >= 60 ? "text-ink" : "text-amber")}>{r.matchPct}%</span>
      </div>
      <ProgressBar value={r.matchPct} tone={matchTone(r.matchPct)} className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{r.kindLabel}</Badge>
        <Badge tone={r.eligible ? "emerald" : "amber"}>{r.eligible ? "Criterii minime OK" : "Condiționat"}</Badge>
      </div>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Sumă max. estimată</dt>
          <dd className="text-right font-medium text-ink">{r.maxAmount > 0 ? ron(r.maxAmount) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Maturitate</dt>
          <dd className="text-right font-medium text-ink">{r.maturityLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-line pt-3">
        <ReasonLists r={r} compact />
      </div>
    </article>
  );
}

/**
 * "Recomandare bancă & pachet de finanțare": best match + 2-3 Romanian alternatives,
 * computed by lib/bank-matcher.ts from the active company's real numbers.
 */
export function BankRecommendationSection() {
  // Starter: only the top pick; alternatives + the full product table are locked (lib/pricing.ts).
  const { assessment, company } = useAssessment();
  const b = assessment.banks;

  return (
    <Card className="mt-5 break-inside-avoid" id="recomandare-banca">
      <CardHeader
        icon={<Landmark size={18} />}
        title="Recomandare bancă & pachet de finanțare (România)"
        subtitle={`Produse IMM de la BCR, Banca Transilvania, ING, Raiffeisen, CEC și UniCredit, comparate cu profilul ${company.name}: ScorFinal, DSCR, destinație, aport, sumă / CA, DSO, concentrare, sezonalitate și portal.just.ro.`}
      />

      <p
        className={cx(
          "mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
          b.creditReady ? "border-emerald/30 bg-emerald-soft text-emerald-strong" : "border-red/30 bg-red-soft font-medium text-red",
        )}
      >
        {b.creditReady ? <CircleCheck size={17} className="mt-0.5 shrink-0" /> : <ShieldAlert size={17} className="mt-0.5 shrink-0" />}
        {b.readinessNote}
      </p>

      <TopPick r={b.top} />

      <LockedGate feature="allBankRecommendations" title={`Încă ${b.alternatives.length} alternative și toate cele ${b.all.length} produse analizate`} className="mt-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {b.alternatives.map((r, i) => (
          <Alternative key={r.id} r={r} rank={i + 1} />
        ))}
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-navy-3">
          <ChevronDown size={15} className="transition-transform group-open:rotate-180" /> Toate produsele analizate ({b.all.length})
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="text-faint">
              <tr>
                <th className="py-2 pr-3 font-semibold">Bancă / pachet</th>
                <th className="py-2 pr-3 font-semibold">Tip</th>
                <th className="py-2 pr-3 text-right font-semibold">Sumă max.</th>
                <th className="py-2 pr-3 font-semibold">Maturitate</th>
                <th className="py-2 pr-3 font-semibold">Criterii minime</th>
                <th className="py-2 text-right font-semibold">Potrivire</th>
              </tr>
            </thead>
            <tbody>
              {b.all.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-ink">{r.bank}</p>
                    <p className="text-muted">{r.product}</p>
                  </td>
                  <td className="py-2 pr-3">{r.kindLabel}</td>
                  <td className="py-2 pr-3 text-right">{r.maxAmount > 0 ? ron(r.maxAmount) : "—"}</td>
                  <td className="py-2 pr-3">{r.maturityLabel}</td>
                  <td className={cx("py-2 pr-3", r.eligible ? "text-emerald-strong" : "text-amber")}>{r.eligible ? "îndeplinite" : "parțial"}</td>
                  <td className="py-2 text-right font-semibold text-ink">{r.matchPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      </LockedGate>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-line/80 bg-canvas px-4 py-3 text-[11px] leading-relaxed text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong className="font-medium text-ink">Disclaimer:</strong> {b.disclaimer}
        </span>
      </p>
    </Card>
  );
}
