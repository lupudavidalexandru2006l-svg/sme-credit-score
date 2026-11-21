"use client";

import { useState } from "react";
import { Banknote, Building, CircleAlert, Landmark, LoaderCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import type { DebtKind, DebtLine } from "@/types/scoring";
import { effectiveDebtService } from "@/lib/company";
import { grossResult, netResult, type BilantYear } from "@/lib/real-company-sources";
import { num, pct, ron } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { Badge, Button, Card, CardHeader, cx, Field, inputCls } from "./ui";

const STATUS_TONE = { clean: "emerald", warning: "amber", critical: "red", unavailable: "neutral" } as const;
const AVAILABILITY_LABEL = { verified: "verificat", not_found: "fără înregistrări", requires_cui: "necesită CUI", unavailable: "indisponibil" } as const;

/** The 5 real sources of the ACTIVE company, with what each one actually answered. */
export function OfficialSourcesCard() {
  const { company, verification, verificationLoading, legalLoading, runMultiSourceCheck } = useAssessment();
  const busy = verificationLoading || legalLoading;
  return (
    <Card>
      <CardHeader
        icon={<Landmark size={18} />}
        title="Date oficiale din 5 surse publice"
        subtitle={`ANAF, bilanțuri, portal.just.ro, VIES și starea juridică ONRC pentru ${company.officialName || company.name}. O sursă fără răspuns nu primește punctaj inventat.`}
        action={
          <Button variant="secondary" onClick={() => runMultiSourceCheck()} disabled={busy || !company.id}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />} Reinterogează
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-3 text-sm">
        <span className="text-muted">ScorVerificariExterne</span>
        <span className="text-2xl font-medium text-ink">{verification.aggregateScore === null ? "—" : `${num(verification.aggregateScore)}/100`}</span>
        <span className="text-xs text-faint">
          {Math.round(verification.coverage * 100)}% din ponderi au răspuns · intră 50% în Factor uman
        </span>
        {verification.hasCriticalFlag && <Badge tone="red">semnal critic</Badge>}
      </div>
      <ul className="space-y-2">
        {verification.sources.map((s) => (
          <li key={s.sourceId} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">
                {s.name} <span className="text-[11px] font-normal text-faint">· {s.institution} · pondere {Math.round(s.weight * 100)}%</span>
              </p>
              <span className="flex items-center gap-1.5">
                <Badge tone="neutral">{AVAILABILITY_LABEL[s.availability]}</Badge>
                <Badge tone={STATUS_TONE[s.status]}>{s.score === null ? "nu intră în scor" : `${s.score}/100`}</Badge>
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{s.summary}</p>
            {s.details.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] font-medium text-navy-3">Detalii</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
                  {s.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      {!company.cui && <p className="mt-3 text-xs text-amber">Fără CUI, ANAF, bilanțul, VIES și ONRC nu pot fi interogate. Completează CUI-ul în Pasul 1.</p>}
    </Card>
  );
}

function ratio(a: number, b: number) {
  return b > 0 ? a / b : null;
}

/** Balance-sheet analysis: what a consultant reads first (equity, leverage, margin, trend). */
export function BilantCard() {
  const { official, assessment } = useAssessment();
  const years: BilantYear[] = official.bilant;
  if (years.length === 0) return null;
  const [y, prev] = years;
  const margin = ratio(netResult(y), y.cifraAfaceri);
  const leverage = ratio(y.datorii, y.capitaluriProprii);
  const liquidity = ratio(y.activeCirculante, y.datorii);
  const trend = prev && prev.cifraAfaceri > 0 ? (y.cifraAfaceri - prev.cifraAfaceri) / prev.cifraAfaceri : null;
  const eFacturaAnnual = assessment.dataStatus.hasInvoices ? assessment.metrics.annualizedRevenue : null;
  const gap = eFacturaAnnual !== null && y.cifraAfaceri > 0 ? (eFacturaAnnual - y.cifraAfaceri) / y.cifraAfaceri : null;
  const rows: [string, (b: BilantYear) => string][] = [
    ["Cifră de afaceri netă", (b) => ron(b.cifraAfaceri)],
    ["Venituri totale", (b) => ron(b.venituriTotale)],
    ["Cheltuieli totale", (b) => ron(b.cheltuieliTotale)],
    ["Rezultat brut", (b) => ron(grossResult(b))],
    ["Rezultat net", (b) => ron(netResult(b))],
    ["Capitaluri proprii", (b) => ron(b.capitaluriProprii)],
    ["Datorii", (b) => ron(b.datorii)],
    ["Active circulante", (b) => ron(b.activeCirculante)],
    ["Casa și conturi la bănci", (b) => ron(b.casaBanci)],
    ["Salariați (medie)", (b) => num(b.salariati)],
  ];
  return (
    <Card>
      <CardHeader icon={<Building size={18} />} title={`Bilanț oficial ${y.an}${prev ? ` vs. ${prev.an}` : ""}`} subtitle={`Depus la ANAF / Ministerul Finanțelor · ${y.denCaen || "CAEN " + y.caen}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicator label="Marjă netă" value={margin === null ? "—" : pct(margin * 100)} bad={margin !== null && margin < 0} hint="rezultat net / cifră de afaceri" />
        <Indicator label="Datorii / capitaluri" value={leverage === null ? "capital ≤ 0" : `${num(Math.round(leverage * 10) / 10)}×`} bad={leverage === null || leverage > 3} hint="băncile preferă sub 3×" />
        <Indicator label="Lichiditate" value={liquidity === null ? "—" : `${num(Math.round(liquidity * 100) / 100)}×`} bad={liquidity !== null && liquidity < 1} hint="active circulante / datorii" />
        <Indicator label="Evoluție cifră de afaceri" value={trend === null ? "—" : `${trend >= 0 ? "+" : ""}${pct(trend * 100)}`} bad={trend !== null && trend < -0.2} hint={prev ? `față de ${prev.an}` : "un singur an depus"} />
      </div>
      {y.capitaluriProprii < 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-soft px-3.5 py-2.5 text-xs font-medium text-red">
          <CircleAlert size={14} className="mt-0.5 shrink-0" /> Capitaluri proprii negative: majoritatea băncilor resping dosarul până la majorarea capitalului social sau
          conversia creanțelor asociaților.
        </p>
      )}
      {gap !== null && Math.abs(gap) > 0.25 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-soft px-3.5 py-2.5 text-xs font-medium text-amber">
          <CircleAlert size={14} className="mt-0.5 shrink-0" /> Cifra de afaceri anualizată din facturile încărcate ({ron(eFacturaAnnual!)}) diferă cu {pct(Math.abs(gap) * 100)} de
          bilanțul {y.an}. Banca va cere explicația (facturi lipsă, vânzări B2C cu bon fiscal sau creștere reală).
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="text-faint">
            <tr>
              <th className="py-2 pr-3 font-semibold">Indicator</th>
              {years.map((b) => (
                <th key={b.an} className="py-2 pr-3 text-right font-semibold">
                  {b.an}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fmt]) => (
              <tr key={label} className="border-t border-line">
                <td className="py-2 pr-3 text-muted">{label}</td>
                {years.map((b) => (
                  <td key={b.an} className="py-2 pr-3 text-right font-medium text-ink">
                    {fmt(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Indicator({ label, value, hint, bad }: { label: string; value: string; hint: string; bad?: boolean }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-white/60 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("mt-1.5 text-xl font-normal tracking-tight", bad ? "text-red" : "text-ink")}>{value}</p>
      <p className="mt-0.5 text-[11px] text-faint">{hint}</p>
    </div>
  );
}

const DEBT_KINDS: { value: DebtKind; label: string }[] = [
  { value: "credit", label: "Credit" },
  { value: "leasing", label: "Leasing" },
  { value: "linie", label: "Linie de credit" },
  { value: "card", label: "Card de credit" },
  { value: "altele", label: "Altele" },
];

const newDebt = (): DebtLine => ({ id: Math.random().toString(36).slice(2), lender: "", kind: "credit", balance: 0, monthlyInstallment: 0, maturity: "", daysLate: 0 });
const digits = (v: string) => Number(v.replace(/\D/g, "")) || 0;

/**
 * Data that is not in e-Factura and must be DECLARED: monthly fixed costs and existing debt.
 * The debt lines are copied from the free report of the Centrala Riscului de Credit (BNR) or Biroul de Credit.
 * Until saved, DSCR and the final score stay "incomplete" (nothing is assumed).
 */
export function FinancialsCard() {
  const { company, setCompany } = useAssessment();
  const [fixed, setFixed] = useState(company.financialsDeclared ? String(company.monthlyFixedCosts) : "");
  const [installments, setInstallments] = useState(company.financialsDeclared && !company.debts?.length ? String(company.existingMonthlyDebtService) : "");
  const [debts, setDebts] = useState<DebtLine[]>(company.debts ?? []);
  const [saved, setSaved] = useState<string | null>(null);
  const [syncedId, setSyncedId] = useState(company.id);
  if (syncedId !== company.id) {
    setSyncedId(company.id);
    setFixed(company.financialsDeclared ? String(company.monthlyFixedCosts) : "");
    setInstallments(company.financialsDeclared && !company.debts?.length ? String(company.existingMonthlyDebtService) : "");
    setDebts(company.debts ?? []);
    setSaved(null);
  }
  if (!company.id) return null;

  const patchDebt = (id: string, patch: Partial<DebtLine>) => setDebts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const total = debts.length ? debts.reduce((s, d) => s + d.monthlyInstallment, 0) : digits(installments);
  const save = () => {
    const clean = debts.filter((d) => d.lender.trim() || d.monthlyInstallment > 0 || d.balance > 0);
    setCompany({ monthlyFixedCosts: digits(fixed), existingMonthlyDebtService: clean.length ? clean.reduce((s, d) => s + d.monthlyInstallment, 0) : digits(installments), debts: clean, financialsDeclared: true });
    setDebts(clean);
    setSaved(`Salvat pentru ${company.name}: cheltuieli fixe ${ron(digits(fixed))}/lună, rate existente ${ron(clean.length ? clean.reduce((s, d) => s + d.monthlyInstallment, 0) : digits(installments))}/lună.`);
  };

  return (
    <Card>
      <CardHeader
        icon={<Banknote size={18} />}
        title="Date declarate: cheltuieli fixe și datorii existente"
        subtitle="Nu apar în e-Factura. Fără ele DSCR-ul nu se poate calcula, iar scorul rămâne incomplet."
        action={company.financialsDeclared ? <Badge tone="emerald">declarate</Badge> : <Badge tone="amber">nedeclarate</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cheltuieli fixe lunare (RON)" hint="Salarii cu contribuții, chirie, utilități, abonamente, combustibil.">
          <input className={inputCls} inputMode="numeric" value={fixed ? Number(digits(fixed)).toLocaleString("ro-RO") : ""} placeholder="ex. 45.000" onChange={(e) => setFixed(e.target.value)} />
        </Field>
        <Field label="Rate lunare existente (RON)" hint={debts.length ? "Calculat din liniile de mai jos." : "Sau adaugă fiecare credit din raportul CRC mai jos."}>
          <input className={inputCls} inputMode="numeric" disabled={debts.length > 0} value={debts.length ? total.toLocaleString("ro-RO") : installments ? digits(installments).toLocaleString("ro-RO") : ""} placeholder="0 dacă nu ai credite" onChange={(e) => setInstallments(e.target.value)} />
        </Field>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-ink">Credite din raportul CRC / Biroul de Credit</p>
        <p className="mt-0.5 text-[11px] text-muted">
          Raportul Centralei Riscului de Credit (BNR) e gratuit: se cere de la orice bancă sau de la BNR. Banca îl verifică oricum; o restanță peste 90 de zile blochează de regulă dosarul.
        </p>
        {debts.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-faint">
                <tr>
                  <th className="py-1.5 pr-2 font-semibold">Creditor</th>
                  <th className="py-1.5 pr-2 font-semibold">Tip</th>
                  <th className="py-1.5 pr-2 font-semibold">Sold (RON)</th>
                  <th className="py-1.5 pr-2 font-semibold">Rată / lună</th>
                  <th className="py-1.5 pr-2 font-semibold">Scadență finală</th>
                  <th className="py-1.5 pr-2 font-semibold">Zile întârziere</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.id} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      <input aria-label="Creditor" className={inputCls} value={d.lender} placeholder="ex. BCR" onChange={(e) => patchDebt(d.id, { lender: e.target.value })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select aria-label="Tip" className={inputCls} value={d.kind} onChange={(e) => patchDebt(d.id, { kind: e.target.value as DebtKind })}>
                        {DEBT_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input aria-label="Sold" className={inputCls} inputMode="numeric" value={d.balance ? d.balance.toLocaleString("ro-RO") : ""} onChange={(e) => patchDebt(d.id, { balance: digits(e.target.value) })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input aria-label="Rată lunară" className={inputCls} inputMode="numeric" value={d.monthlyInstallment ? d.monthlyInstallment.toLocaleString("ro-RO") : ""} onChange={(e) => patchDebt(d.id, { monthlyInstallment: digits(e.target.value) })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input aria-label="Scadență" type="month" className={inputCls} value={d.maturity} onChange={(e) => patchDebt(d.id, { maturity: e.target.value })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input aria-label="Zile întârziere" className={cx(inputCls, d.daysLate > 30 && "border-red text-red")} inputMode="numeric" value={d.daysLate || ""} placeholder="0" onChange={(e) => patchDebt(d.id, { daysLate: digits(e.target.value) })} />
                    </td>
                    <td className="py-1.5">
                      <button type="button" aria-label="Șterge linia" onClick={() => setDebts((list) => list.filter((x) => x.id !== d.id))} className="rounded-full p-2 text-faint hover:bg-red-soft hover:text-red">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setDebts((list) => [...list, newDebt()])}>
            <Plus size={14} /> Adaugă credit / leasing
          </Button>
          <Button onClick={save} disabled={!fixed.trim()}>
            <Save size={15} /> Salvează datele declarate
          </Button>
          {company.financialsDeclared && <span className="text-[11px] text-faint">În calcul acum: rate existente {ron(effectiveDebtService(company))}/lună.</span>}
        </div>
        {saved && <p className="mt-2 rounded-xl bg-emerald-soft px-3.5 py-2 text-xs text-emerald-strong">{saved}</p>}
      </div>
    </Card>
  );
}
