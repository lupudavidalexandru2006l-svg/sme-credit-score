"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartColumn, CircleCheck, FileText, FileWarning, Gauge, MessageCircleQuestion, Receipt, RotateCcw, Truck, Users } from "lucide-react";
import type { Invoice, PartyShare } from "@/types/scoring";
import { isStorno } from "@/lib/metrics";
import { LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/scoringEngine";
import { monthLabel, num, pct, ron } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { MonthlyChart, ScoreRing } from "../charts";
import { BilantCard, FinancialsCard, OfficialSourcesCard } from "../OfficialData";
import { PageHeader, StepFooter, XmlUploadButton } from "../Shell";
import { SpvSyncButton } from "../SpvSyncPanel";
import { SeasonalityHeatmap } from "../SeasonalityHeatmap";
import { explain, type JargonKey } from "@/lib/jargon";
import type { Assessment } from "@/lib/assessment";
import { browserInflateRaw, invoiceXmlFromZip } from "@/lib/efactura/zip";
import { Badge, Button, Card, CardHeader, cx, ProgressBar, scoreTone, Stat, TONE_TEXT } from "../ui";

function UploadPanel() {
  const { uploadXml, lastUploadResults, persistMessage, uploads, resetUploads } = useAssessment();
  const [drag, setDrag] = useState(false);

  return (
    <Card className="border-emerald/30">
      <CardHeader
        icon={<Receipt size={18} />}
        title="Facturi e-Factura: preluare automată din SPV sau upload manual XML"
        subtitle="Parsăm InvoiceTypeCode (inclusiv 381 storno), IssueDate, DueDate, furnizor, client, TaxExclusiveAmount și PayableAmount. Scorul se recalculează instant și factura se salvează în Supabase."
        action={
          uploads.length > 0 && (
            <Button variant="ghost" onClick={resetUploads}>
              <RotateCcw size={15} /> Elimină cele {uploads.length} încărcate
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-navy/15 bg-navy-soft/50 p-4">
          <p className="text-[11px] font-semibold text-faint">Opțiunea 1 · automat</p>
          <p className="mb-3 mt-0.5 text-xs text-muted">Certificat digital → SPV ANAF → facturi emise & primite → parsare UBL 2.1 → scor recalculat.</p>
          <SpvSyncButton />
        </div>
        <div className="rounded-2xl border border-line p-4">
          <p className="text-[11px] font-semibold text-faint">Opțiunea 2 · manual</p>
          <p className="mb-3 mt-0.5 text-xs text-muted">Fișiere .xml UBL 2.1 din programul de facturare sau din SPV; recalculare live.</p>
          <XmlUploadButton variant="secondary" label="Încarcă Manual XML e-Factura" />
        </div>
      </div>
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
            const all = [...e.dataTransfer.files];
            const files = all.filter((f) => f.name.toLowerCase().endsWith(".xml"));
            // ZIP archives downloaded from SPV are unpacked in the browser (signature files are skipped).
            const zips = all.filter((f) => f.name.toLowerCase().endsWith(".zip"));
            const fromZip = (await Promise.all(zips.map(async (z) => invoiceXmlFromZip(new Uint8Array(await z.arrayBuffer()), browserInflateRaw, z.name).catch(() => [])))).flat();
            const xml = [...(await Promise.all(files.map(async (f) => ({ name: f.name, xml: await f.text() })))), ...fromZip];
            if (xml.length) await uploadXml(xml);
          }}
          className={cx(
            "grid place-items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            drag ? "border-emerald bg-emerald-soft" : "border-line-strong bg-canvas",
          )}
        >
          <div>
            <FileText size={28} className="mx-auto text-navy-3" />
            <p className="mt-2 text-sm font-semibold text-ink">Trage fișierele XML (sau arhivele ZIP din SPV) aici</p>
            <p className="mb-3 text-xs text-muted">sau</p>
            <XmlUploadButton label="Alege fișiere XML" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink">De unde iei facturile</p>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted">
            <li>Din SPV (Spațiul Privat Virtual ANAF) → e-Factura → descarcă arhiva fiecărei facturi; în arhivă e fișierul XML.</li>
            <li>Din programul de facturare sau de contabilitate (export XML UBL 2.1 / RO_CIUS).</li>
            <li>Ideal: facturile emise și primite din ultimele 12 luni. Scorul folosește doar facturile încărcate pentru firma activă.</li>
          </ul>
          {lastUploadResults.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {lastUploadResults.map((r) => (
                <li key={r.fileName} className={cx("rounded-lg px-3 py-2 text-xs", r.ok ? "bg-emerald-soft text-emerald-strong" : "bg-red-soft text-red")}>
                  <p className="flex items-center gap-1.5 font-semibold">
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
              {persistMessage && <li className="px-1 text-[11px] font-medium text-muted">{persistMessage}</li>}
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
              <span className="truncate font-medium text-ink">
                <span className="mr-2 text-faint">#{i + 1}</span>
                {r.name}
              </span>
              <span className="shrink-0 font-semibold text-ink">{pct(r.sharePct)}</span>
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
              <th className="py-2 pr-3 font-semibold">Număr</th>
              <th className="py-2 pr-3 font-semibold">Tip</th>
              <th className="py-2 pr-3 font-semibold">Emisă</th>
              <th className="py-2 pr-3 font-semibold">Scadență</th>
              <th className="py-2 pr-3 font-semibold">Partener</th>
              <th className="py-2 pr-3 text-right font-semibold">Fără TVA</th>
              <th className="py-2 text-right font-semibold">Sursă</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={cx("border-t border-line", i.source === "xml-upload" && "bg-emerald-soft/40")}>
                <td className="py-2 pr-3 font-mono font-medium text-ink">{i.number}</td>
                <td className="py-2 pr-3">
                  <Badge tone={isStorno(i) ? "red" : i.direction === "issued" ? "navy" : "neutral"}>
                    {i.typeCode} {i.direction === "issued" ? "emisă" : "primită"}
                  </Badge>
                </td>
                <td className="py-2 pr-3">{i.issueDate}</td>
                <td className="py-2 pr-3">{i.dueDate ?? "—"}</td>
                <td className="max-w-[220px] truncate py-2 pr-3">{i.direction === "issued" ? i.customerName : i.supplierName}</td>
                <td className={cx("py-2 pr-3 text-right font-semibold", isStorno(i) ? "text-red" : "text-ink")}>
                  {isStorno(i) ? "-" : ""}
                  {ron(Math.abs(i.taxExclusiveAmount))}
                </td>
                <td className="py-2 text-right">{i.source === "xml-upload" ? <Badge tone="emerald">XML</Badge> : <span className="text-faint">Supabase</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const JARGON: { key: JargonKey; label: string; value: (a: Assessment) => string }[] = [
  { key: "dscr", label: "DSCR", value: (a) => (a.business.dscr >= 99 ? "fără datorii" : `${num(a.business.dscr)}×`) },
  { key: "dso", label: "DSO", value: (a) => `${num(a.metrics.dsoDays)} zile` },
  { key: "concentration", label: "Concentrare client", value: (a) => pct(a.metrics.topClientSharePct) },
  { key: "storno", label: "Stornări", value: (a) => pct(a.metrics.creditNotesSharePct3m) },
  { key: "volatility", label: "Volatilitate", value: (a) => `CV ${num(a.metrics.revenueCv)}` },
];

/** "Pe înțelesul antreprenorului": each banking indicator in one plain sentence, from the firm's own numbers. */
function PlainLanguageCard({ a }: { a: Assessment }) {
  return (
    <Card className="mt-5">
      <CardHeader icon={<MessageCircleQuestion size={18} />} title="Traducător de jargon bancar — pe înțelesul antreprenorului" subtitle="Ce înseamnă fiecare indicator pentru firma ta, calculat din cifrele ei reale." />
      <ul className="divide-y divide-line">
        {JARGON.map((j) => (
          <li key={j.key} className="grid gap-1 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <p className="text-sm font-medium text-ink">
              {j.label} <span className="font-normal text-muted">· {j.value(a)}</span>
            </p>
            <p className="text-sm leading-relaxed text-ink">{explain(j.key, a)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AnalysisStep() {
  const { assessment, invoices, markVisited, investment, company } = useAssessment();
  const m = assessment.metrics;
  const b = assessment.business;
  const hasInvoices = assessment.dataStatus.hasInvoices;
  useEffect(() => markVisited("analiza"), [markVisited]);

  if (!company.id) {
    return (
      <div className="animate-rise">
        <PageHeader step={2} title="Analiză business & e-Factura" subtitle="Analiza se face pe datele reale ale firmei introduse în Pasul 1." />
        <Card>
          <p className="text-sm text-ink">Nu ai adăugat încă nicio firmă.</p>
          <p className="mt-1 text-xs text-muted">Completează numele firmei, administratorul și, ideal, CUI-ul: aducem automat datele oficiale (ANAF, bilanț, VIES, portal.just.ro).</p>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2">
            Adaugă firma în Pasul 1
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <PageHeader
        step={2}
        title={`Analiză business — ${company.officialName || company.name}`}
        subtitle={
          hasInvoices
            ? `Istoric pe 12 luni (${monthLabel(m.months[0].month)} – ${monthLabel(m.months[11].month)}) din facturile e-Factura încărcate, plus datele oficiale ale firmei. Pilonul cântărește 70% din scorul final.`
            : "Datele oficiale ale firmei sunt mai jos. Pentru pilonul Business (70%) încarcă facturile e-Factura ale firmei — nu folosim date generate."
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <OfficialSourcesCard />
        <FinancialsCard />
      </div>

      <div className="mt-5">
        <BilantCard />
      </div>

      <div className="mt-5">
        <UploadPanel />
      </div>

      {hasInvoices ? (
        <>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat key={`r12-${m.revenue12m}`} highlight={m.uploadedCount > 0} label="CA 12 luni" value={ron(m.revenue12m)} hint={`${m.issuedCount} facturi emise`} />
        <Stat key={`r3-${m.revenueLast3Months}`} highlight={m.uploadedCount > 0} label="CA ultimele 3 luni" value={ron(m.revenueLast3Months)} hint="fără TVA, net de storno" />
        <Stat key={`dso-${m.dsoDays}`} label="DSO" value={`${num(m.dsoDays)} zile`} hint={`termen mediu ${num(m.avgPaymentTermDays)} zile`} tone={m.dsoDays > 45 ? "amber" : undefined} />
        <Stat key={`top-${m.topClientSharePct}`} highlight={m.uploadedCount > 0} label="Client #1" value={pct(m.topClientSharePct)} hint={m.topClients[0]?.name} tone={m.topClientSharePct > 30 ? "amber" : undefined} />
        <Stat key={`st-${m.creditNotesSharePct3m}`} highlight={m.uploadedCount > 0} label="Stornări 3 luni" value={pct(m.creditNotesSharePct3m)} hint="prag semnificativ: 5%" tone={m.creditNotesSharePct3m > 5 ? "red" : undefined} />
        <Stat key={`dscr-${b.dscr}`} label="DSCR estimat" value={b.dscr >= 99 ? "fără datorii" : `${num(b.dscr)}×`} hint={investment.requestedAmount ? `cu rata nouă ${ron(b.loanInstallment)}` : "fără credit nou"} tone={b.dscr < 1.25 ? "red" : undefined} />
      </div>

      <PlainLanguageCard a={assessment} />

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
            <ScoreRing score={b.score} stroke={8} />
            <p className="mt-3 text-sm text-muted">
              = <strong className="text-ink">{num(b.score * 0.7)}</strong> din 70 de puncte ale scorului final
            </p>
          </div>
        </Card>
      </div>

      <SeasonalityHeatmap />

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {b.items.map((i) => {
          const tone = scoreTone(i.score);
          return (
            <Card key={i.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight text-ink">{i.label}</p>
                <Badge tone="neutral">{Math.round(i.weight * 100)}%</Badge>
              </div>
              <p className={cx("mt-2 text-3xl font-medium", TONE_TEXT[tone])}>{num(i.score)}</p>
              <ProgressBar value={i.score} className="mt-2" />
              <p className="mt-3 text-xs font-medium text-ink">{i.value}</p>
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
        </>
      ) : (
        <Card className="mt-5">
          <p className="text-sm font-medium text-ink">Încă nu există facturi e-Factura pentru {company.name}.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Stabilitatea încasărilor, DSO, concentrarea clienților, sezonalitatea și DSCR se calculează doar din facturile reale ale firmei. Până le încarci, pilonul Business și
            scorul final rămân „incomplete” — nu le estimăm din date inventate.
          </p>
        </Card>
      )}

      <p className="mt-4 text-[11px] text-faint">
        Data încasării nu face parte din e-Factura: fără extrase bancare, DSO se calculează pe termenul de plată din factură (scadență − emitere). Rata nouă este estimată la {LOAN_ANNUAL_RATE * 100}
        %/an pe {investment.termMonths ?? LOAN_MONTHS} luni; cheltuielile fixe și ratele existente sunt cele declarate de tine mai sus.
      </p>

      <StepFooter prev="/onboarding" next="/investitie" nextLabel="Scopul investiției" />
    </div>
  );
}
