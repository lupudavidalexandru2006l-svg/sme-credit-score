"use client";

import { useEffect, useState } from "react";
import { ChartColumn, CircleCheck, Download, FileText, FileWarning, Gauge, Receipt, RotateCcw, Truck, Users } from "lucide-react";
import type { Invoice, PartyShare } from "@/types/scoring";
import { isStorno } from "@/lib/metrics";
import { LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/scoringEngine";
import { monthLabel, num, pct, ron } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { MonthlyChart, ScoreRing } from "../charts";
import { PageHeader, StepFooter, XmlUploadButton } from "../Shell";
import { Badge, Button, Card, CardHeader, cx, ProgressBar, scoreTone, Stat, TONE_TEXT } from "../ui";

const SAMPLES = [
  { file: "01_factura_normala.xml", label: "Factură normală", hint: "18.450 RON · client existent" },
  { file: "02_factura_storno_381.xml", label: "Factură storno 381", hint: "-85.000 RON · retur marfă" },
  { file: "03_factura_mare_concentrare.xml", label: "Factură mare", hint: "750.000 RON · clientul #1" },
];

function UploadPanel() {
  const { uploadXml, lastUploadResults, persistMessage, uploads, resetUploads } = useAssessment();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadSample = async (file: string) => {
    setBusy(file);
    try {
      const xml = await fetch(`/samples/${file}`).then((r) => r.text());
      await uploadXml([{ name: file, xml }]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-emerald/30">
      <CardHeader
        icon={<Receipt size={18} />}
        title="Încarcă facturi e-Factura (XML UBL 2.1 / RO_CIUS)"
        subtitle="Parsăm InvoiceTypeCode (inclusiv 381 storno), IssueDate, DueDate, furnizor, client, TaxExclusiveAmount și PayableAmount. Scorul se recalculează instant și factura se salvează în Supabase."
        action={
          uploads.length > 0 && (
            <Button variant="ghost" onClick={resetUploads}>
              <RotateCcw size={15} /> Elimină cele {uploads.length} încărcate
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDrag(false);
            const files = [...e.dataTransfer.files].filter((f) => f.name.toLowerCase().endsWith(".xml"));
            if (files.length) await uploadXml(await Promise.all(files.map(async (f) => ({ name: f.name, xml: await f.text() }))));
          }}
          className={cx(
            "grid place-items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            drag ? "border-emerald bg-emerald-soft" : "border-line-strong bg-canvas",
          )}
        >
          <div>
            <FileText size={28} className="mx-auto text-navy-3" />
            <p className="mt-2 text-sm font-bold text-ink">Trage fișierele XML aici</p>
            <p className="mb-3 text-xs text-muted">sau</p>
            <XmlUploadButton label="Alege fișiere XML" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-ink">Fișiere de test pentru demo (un click = upload)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SAMPLES.map((s) => (
              <div key={s.file} className="rounded-xl border border-line p-3">
                <button type="button" disabled={busy !== null} onClick={() => loadSample(s.file)} className="w-full text-left disabled:opacity-60">
                  <p className="text-sm font-bold text-navy-3 hover:underline">{busy === s.file ? "Se procesează…" : s.label}</p>
                  <p className="text-[11px] text-muted">{s.hint}</p>
                </button>
                <a href={`/samples/${s.file}`} download title={s.file} className="mt-2 flex max-w-full items-center gap-1 text-[11px] font-semibold text-faint hover:text-ink">
                  <Download size={11} className="shrink-0" /> <span className="truncate">Descarcă XML</span>
                </a>
              </div>
            ))}
          </div>
          {lastUploadResults.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {lastUploadResults.map((r) => (
                <li key={r.fileName} className={cx("rounded-lg px-3 py-2 text-xs", r.ok ? "bg-emerald-soft text-emerald-strong" : "bg-red-soft text-red")}>
                  <p className="flex items-center gap-1.5 font-bold">
                    {r.ok ? <CircleCheck size={13} /> : <FileWarning size={13} />}
                    {r.fileName}
                    {r.invoice && ` → ${r.invoice.number} · tip ${r.invoice.typeCode} · ${r.invoice.direction === "issued" ? "emisă" : "primită"} · ${ron(r.invoice.taxExclusiveAmount)}`}
                  </p>
                  {r.error && <p>{r.error}</p>}
                  {r.warnings.map((w) => (
                    <p key={w} className="text-muted">
                      {w}
                    </p>
                  ))}
                </li>
              ))}
              {persistMessage && <li className="px-1 text-[11px] font-semibold text-muted">{persistMessage}</li>}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function PartyTable({ title, icon, rows, total }: { title: string; icon: React.ReactNode; rows: PartyShare[]; total: string }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={total} />
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.cui || r.name}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-ink">
                <span className="mr-2 text-faint">#{i + 1}</span>
                {r.name}
              </span>
              <span className="shrink-0 font-bold text-ink">{pct(r.sharePct)}</span>
            </div>
            <ProgressBar value={r.sharePct} tone={i === 0 && r.sharePct > 30 ? "amber" : "navy"} />
            <p className="mt-0.5 text-[11px] text-faint">{ron(r.value)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const rows = [...invoices]
    .sort((a, b) => Number(b.source === "xml-upload") - Number(a.source === "xml-upload") || b.issueDate.localeCompare(a.issueDate))
    .slice(0, 10);
  return (
    <Card>
      <CardHeader icon={<FileText size={18} />} title="Ultimele documente e-Factura" subtitle="Facturile încărcate din XML apar primele." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-faint">
            <tr>
              <th className="py-2 pr-3 font-bold">Număr</th>
              <th className="py-2 pr-3 font-bold">Tip</th>
              <th className="py-2 pr-3 font-bold">Emisă</th>
              <th className="py-2 pr-3 font-bold">Scadență</th>
              <th className="py-2 pr-3 font-bold">Partener</th>
              <th className="py-2 pr-3 text-right font-bold">Fără TVA</th>
              <th className="py-2 text-right font-bold">Sursă</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={cx("border-t border-line", i.source === "xml-upload" && "bg-emerald-soft/40")}>
                <td className="py-2 pr-3 font-mono font-semibold text-ink">{i.number}</td>
                <td className="py-2 pr-3">
                  <Badge tone={isStorno(i) ? "red" : i.direction === "issued" ? "navy" : "neutral"}>
                    {i.typeCode} {i.direction === "issued" ? "emisă" : "primită"}
                  </Badge>
                </td>
                <td className="py-2 pr-3">{i.issueDate}</td>
                <td className="py-2 pr-3">{i.dueDate ?? "—"}</td>
                <td className="max-w-[220px] truncate py-2 pr-3">{i.direction === "issued" ? i.customerName : i.supplierName}</td>
                <td className={cx("py-2 pr-3 text-right font-bold", isStorno(i) ? "text-red" : "text-ink")}>
                  {isStorno(i) ? "-" : ""}
                  {ron(Math.abs(i.taxExclusiveAmount))}
                </td>
                <td className="py-2 text-right">{i.source === "xml-upload" ? <Badge tone="emerald">XML</Badge> : <span className="text-faint">{i.source === "supabase" ? "Supabase" : "sintetic"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AnalysisStep() {
  const { assessment, invoices, markVisited, investment } = useAssessment();
  const m = assessment.metrics;
  const b = assessment.business;
  useEffect(() => markVisited("analiza"), [markVisited]);

  return (
    <div className="animate-rise">
      <PageHeader
        step={2}
        title="Analiză business & e-Factura"
        subtitle={`Istoric pe 12 luni (${monthLabel(m.months[0].month)} – ${monthLabel(m.months[11].month)}) din facturile emise și primite. Pilonul cântărește 70% din scorul final.`}
        action={<XmlUploadButton />}
      />

      <UploadPanel />

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat key={`r12-${m.revenue12m}`} highlight={m.uploadedCount > 0} label="CA 12 luni" value={ron(m.revenue12m)} hint={`${m.issuedCount} facturi emise`} />
        <Stat key={`r3-${m.revenueLast3Months}`} highlight={m.uploadedCount > 0} label="CA ultimele 3 luni" value={ron(m.revenueLast3Months)} hint="fără TVA, net de storno" />
        <Stat key={`dso-${m.dsoDays}`} label="DSO" value={`${num(m.dsoDays)} zile`} hint={`termen mediu ${num(m.avgPaymentTermDays)} zile`} tone={m.dsoDays > 45 ? "amber" : undefined} />
        <Stat key={`top-${m.topClientSharePct}`} highlight={m.uploadedCount > 0} label="Client #1" value={pct(m.topClientSharePct)} hint={m.topClients[0]?.name} tone={m.topClientSharePct > 30 ? "amber" : undefined} />
        <Stat key={`st-${m.creditNotesSharePct3m}`} highlight={m.uploadedCount > 0} label="Stornări 3 luni" value={pct(m.creditNotesSharePct3m)} hint="prag semnificativ: 5%" tone={m.creditNotesSharePct3m > 5 ? "red" : undefined} />
        <Stat key={`dscr-${b.dscr}`} label="DSCR estimat" value={`${num(b.dscr)}×`} hint={investment.requestedAmount ? `cu rata nouă ${ron(b.loanInstallment)}` : "fără credit nou"} tone={b.dscr < 1.2 ? "red" : undefined} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={<ChartColumn size={18} />}
            title="Vânzări lunare și achiziții"
            subtitle={`Vârf în ${monthLabel(m.peakMonth)}, minim în ${monthLabel(m.troughMonth)} · cash-flow operațional mediu ${ron(m.operatingCashFlow)}/lună`}
          />
          <MonthlyChart months={m.months} />
        </Card>
        <Card className="flex flex-col">
          <CardHeader icon={<Gauge size={18} />} title="S_Business" subtitle="Media ponderată a celor 5 indicatori." />
          <div className="flex flex-1 flex-col items-center justify-center">
            <ScoreRing score={b.score} />
            <p className="mt-3 text-sm text-muted">
              = <strong className="text-ink">{num(b.score * 0.7)}</strong> din 70 de puncte ale scorului final
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {b.items.map((i) => {
          const tone = scoreTone(i.score);
          return (
            <Card key={i.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight text-ink">{i.label}</p>
                <Badge tone="neutral">{Math.round(i.weight * 100)}%</Badge>
              </div>
              <p className={cx("mt-2 text-3xl font-extrabold", TONE_TEXT[tone])}>{num(i.score)}</p>
              <ProgressBar value={i.score} className="mt-2" />
              <p className="mt-3 text-xs font-semibold text-ink">{i.value}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{i.rule}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <PartyTable title="Concentrarea pe clienți" icon={<Users size={18} />} rows={m.topClients} total={`Top 5 din vânzările pe 12 luni (${ron(m.revenue12m)})`} />
        <PartyTable title="Principalii furnizori" icon={<Truck size={18} />} rows={m.topSuppliers} total={`Top 5 din achizițiile pe 12 luni · marjă brută ${pct(m.grossMarginPct)}`} />
      </div>

      <div className="mt-5">
        <InvoiceTable invoices={invoices} />
      </div>

      <p className="mt-4 text-[11px] text-faint">
        Încasările (data plății) nu fac parte din e-Factura: provin din extrase bancare sintetice. Facturile încărcate din XML sunt considerate neîncasate. Rata nouă este estimată la {LOAN_ANNUAL_RATE * 100}%/an pe{" "}
        {LOAN_MONTHS} luni; cheltuieli fixe și rate existente din datele contabile sintetice ale firmei.
      </p>

      <StepFooter prev="/onboarding" next="/investitie" nextLabel="Scopul investiției" />
    </div>
  );
}
