"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, CircleCheck, LoaderCircle, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import type { CourtCase, PortalSimulationScenario, SeverityLevel } from "@/types/scoring";
import { MINOR_DEDUCTION_CAP } from "@/lib/scoringEngine";
import { useAssessment, type LegalMode } from "./AssessmentProvider";
import { Badge, Button, Card, CardHeader, cx } from "./ui";

const LEVEL_TONE: Record<SeverityLevel, "emerald" | "blue" | "amber" | "red"> = { 0: "emerald", 1: "blue", 2: "amber", 3: "red", 4: "red" };

const SCENARIOS: { value: PortalSimulationScenario; label: string }[] = [
  { value: "clean", label: "Fără dosare" },
  { value: "minor", label: "Dosare minore" },
  { value: "many", label: "Mai multe dosare" },
  { value: "critical", label: "Dosar critic" },
];

function CaseItem({ c }: { c: CourtCase }) {
  return (
    <li className={cx("rounded-xl border p-4", c.severity >= 3 ? "border-red/30 bg-red-soft/40" : "border-line bg-canvas/60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-ink">{c.numar}</p>
          <p className="text-[11px] text-muted">
            {c.institutie} · {c.categorie} {c.stadiu && `· ${c.stadiu}`} · după {c.matchedBy === "firma" ? "firmă" : "administrator"}
          </p>
        </div>
        <Badge tone={LEVEL_TONE[c.severity]}>
          {c.severity === 4 && <ShieldAlert size={12} />}
          Nivel {c.severity} · {c.severityLabel} · {c.severity === 4 ? "scor legal 0" : `-${c.deduction} p`}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-navy-3">{c.kindLabel}</p>
      <p className="text-sm text-ink">{c.obiect || "—"}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{c.outcomeLabel}</p>
      <p className="text-[11px] text-muted">
        Calitate: {c.partyRoles.join(" / ") || "necunoscută"}
        {c.nextHearing && (
          <span className="ml-2 inline-flex items-center gap-1">
            <CalendarClock size={11} /> termen {c.nextHearing}
          </span>
        )}
      </p>
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-navy-3">
          <ChevronDown size={13} className="transition-transform group-open:rotate-180" /> De ce acest nivel
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
          {c.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </details>
    </li>
  );
}

export function LegalPanel() {
  const { legal, legalLoading, runLegalCheck, company } = useAssessment();
  const [mode, setMode] = useState<LegalMode>({ kind: "live" });
  const stale = legal && (legal.query.companyName !== company.name.trim() || legal.query.ceoName !== company.ceoName.trim());
  const relevant = legal?.cases.filter((c) => c.deduction > 0 || c.severity === 4) ?? [];

  return (
    <Card>
      <CardHeader
        icon={<Scale size={18} />}
        title="Verificare automată portal.just.ro"
        subtitle="Interogare SOAP gratuită (portalquery.just.ro) după numele firmei și al administratorului. 50% din pilonul Factor uman."
        action={
          legal && (
            <Badge tone={legal.source === "portal.just.ro" ? "emerald" : legal.source === "simulation" ? "amber" : "red"}>
              {legal.source === "portal.just.ro" ? "Live" : legal.source === "simulation" ? "Simulat" : "Fallback"}
            </Badge>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Mod verificare"
          className="rounded-xl border border-line-strong bg-white px-3 py-2 text-sm font-semibold"
          value={mode.kind === "live" ? "live" : mode.scenario}
          onChange={(e) => setMode(e.target.value === "live" ? { kind: "live" } : { kind: "simulation", scenario: e.target.value as PortalSimulationScenario })}
        >
          <option value="live">Live (fallback automat la timeout)</option>
          {SCENARIOS.map((s) => (
            <option key={s.value} value={s.value}>
              Simulat — {s.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => runLegalCheck(mode)} disabled={legalLoading || (!company.name && !company.ceoName)}>
          {legalLoading ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {legal ? "Reverifică" : "Verifică acum"}
        </Button>
      </div>

      {stale && !legalLoading && <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-xs font-semibold text-amber">Numele s-au schimbat după ultima verificare — apasă „Reverifică”.</p>}

      {legalLoading && !legal && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle size={16} className="animate-spin" /> Interoghez portal.just.ro…
        </p>
      )}

      {legal && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-canvas p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Scor legal</p>
              <p className={cx("text-3xl font-extrabold", legal.legalScore >= 80 ? "text-emerald-strong" : legal.legalScore >= 50 ? "text-amber" : "text-red")}>
                {legal.legalScore}
                <span className="text-base text-faint">/100</span>
              </p>
            </div>
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
              <p>
                <strong className="text-ink">{legal.totalFound}</strong> dosare pe numele exact
                {legal.excludedCount > 0 && <> · {legal.excludedCount} omonime parțiale excluse</>}
                {legal.minorCapApplied && <> · penalizările minore plafonate la {MINOR_DEDUCTION_CAP} p</>}
              </p>
              <p className="mt-1">{legal.message}</p>
            </div>
          </div>

          {legal.integrityKillSwitch && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-semibold text-red">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" /> Dosar critic (insolvență / infracțiune economică): scorul legal devine 0.
            </p>
          )}

          {legal.totalFound === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-strong">
              <CircleCheck size={17} /> Fără litigii, insolvențe sau executări silite pe numele căutate → 100 p.
            </p>
          ) : (
            <details className="group mt-3" open={relevant.length > 0}>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-bold text-navy-3">
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                Vezi dosarele ({legal.totalFound}) și penalizarea progresivă
              </summary>
              <ul className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {legal.cases.map((c) => (
                  <CaseItem key={`${c.numar}-${c.institutie}-${c.matchedBy}`} c={c} />
                ))}
              </ul>
            </details>
          )}
          <p className="mt-3 text-[11px] text-faint">
            Penalizare: nivel 1 = -3 p (plafon {MINOR_DEDUCTION_CAP} p) · nivel 2 = -8 p · nivel 3 = -20 p · nivel 4 = scor 0. Dosarele unde firma e creditor/reclamant nu se penalizează.
          </p>
        </div>
      )}
    </Card>
  );
}
