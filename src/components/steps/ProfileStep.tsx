"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, CircleAlert, CircleCheck, Lightbulb, LoaderCircle, Printer, Save, Scale, ShieldAlert, TrendingDown, UserRound } from "lucide-react";
import type { ActionItem, CourtCase, LegalCheckResult } from "@/types/scoring";
import { caseImpact, CONFIDENCE_LABEL, impactLabel, scoreLegalImpact } from "@/lib/scoringEngine";
import { num } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { ConsultantReport } from "../ConsultantReport";
import { BankRecommendationSection } from "../BankRecommendationSection";
import { UNLOCK_LABEL, useCan } from "../PlanGate";
import { gateActionPlan } from "@/lib/pricing";
import { HowWeScore } from "../HowWeScore";
import { ScoreRing } from "../charts";
import { PageHeader, StepFooter } from "../Shell";
import { Badge, Button, Card, CardHeader, cx, ProgressBar, scoreTone, TONE_TEXT } from "../ui";

const PRIORITY_TONE = { critică: "red", ridicată: "amber", medie: "navy" } as const;

function ActionCard({ a }: { a: ActionItem }) {
  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={PRIORITY_TONE[a.priority]}>Prioritate {a.priority}</Badge>
        {a.impactPoints > 0 && <Badge tone="emerald">+{num(a.impactPoints)} p potențial</Badge>}
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{a.title}</p>
      <p className="mt-1 text-xs text-muted">{a.why}</p>
      <ul className="mt-3 space-y-1.5">
        {a.steps.map((s) => (
          <li key={s} className="flex items-start gap-2 text-xs text-ink">
            <span className="mt-1 h-3 w-3 shrink-0 rounded border border-line-strong" />
            {s}
          </li>
        ))}
      </ul>
    </li>
  );
}

const SOURCE_LABEL: Record<LegalCheckResult["source"], string> = { "portal.just.ro": "Live", fallback: "Indisponibil" };

/** Printable court report for one searched party (always expanded, unlike the step-1 card). */
function LegalPartyReport({ icon, title, name, cases }: { icon: React.ReactNode; title: string; name: string; cases: CourtCase[] }) {
  const { legalScore, totalDeduction, integrityKillSwitch } = scoreLegalImpact(cases);
  return (
    <div className="break-inside-avoid rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-soft text-navy-3">{icon}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-faint">{title}</p>
            <p className="truncate text-sm font-medium text-ink">{name || "nespecificat"}</p>
          </div>
        </div>
        {name && (
          <Badge tone={integrityKillSwitch ? "red" : totalDeduction === 0 ? "emerald" : legalScore >= 80 ? "blue" : "amber"}>
            {cases.length} dosare · {integrityKillSwitch ? "dosar critic" : `-${totalDeduction} p`} · {legalScore}/100
          </Badge>
        )}
      </div>
      {!name ? (
        <p className="mt-3 text-xs text-muted">Numele nu a fost completat, deci nu a fost căutat.</p>
      ) : cases.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-strong">
          <CircleCheck size={16} /> Fără litigii, insolvențe sau executări silite pe acest nume.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {cases.map((c) => (
            <li key={`${c.numar}-${c.institutie}`} className="break-inside-avoid py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-ink">{c.numar}</p>
                <span className={cx("text-xs font-medium", caseImpact(c).severity >= 3 ? "text-red" : caseImpact(c).severity === 2 ? "text-amber" : "text-muted")}>
                  Nivel {c.severity} · {c.severityLabel} · {impactLabel(c)}
                </span>
              </div>
              <p className="text-xs text-ink">
                {c.kindLabel}: {c.obiect || "—"}
              </p>
              <p className="text-[11px] text-muted">
                {c.outcomeLabel} · {c.partyRoles.join(" / ") || "rol necunoscut"} · {c.institutie}
                {c.confidence &&
                  ` · ${c.userVerdict === "confirmat" ? "confirmat de client" : c.userVerdict === "contestat" ? "contestat de client (omonim, de verificat după CNP)" : CONFIDENCE_LABEL[c.confidence].toLowerCase()}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfileStep() {
  const { assessment, company, quiz, investment, legal, legalLoading, uploads, markVisited, plan: activePlan, showUpgrade } = useAssessment();
  const { final: f, drivers, plan, quiz: q, business: b } = assessment;
  const canExport = useCan("exportPdf");
  // Starter: preview of the top 2 actions, the rest blurred.
  const lockedActions = new Set(gateActionPlan(activePlan.planTier, plan).locked.map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  useEffect(() => markVisited("profil"), [markVisited]);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, quiz, investment, legal, uploads }),
      }).then((x) => x.json());
      setSaveMsg(r.saved ? `Evaluare salvată în Supabase (scor recalculat pe server: ${r.finalScore}).` : (r.error ?? r.message));
    } catch {
      setSaveMsg("API indisponibil.");
    } finally {
      setSaving(false);
    }
  };

  const pillars = [
    {
      name: "Business",
      weight: "70%",
      score: f.pillars.business.score,
      points: f.pillars.business.points,
      max: 70,
      detail: b.items.map((i) => `${i.label}: ${num(i.score)}`).join(" · "),
    },
    {
      name: "Factor uman",
      weight: "15%",
      score: f.pillars.human.score,
      points: f.pillars.human.points,
      max: 15,
      detail:
        f.pillars.human.externalScore !== undefined
          ? `Quiz ${q.total}/100 (${q.levelLabel}) · surse oficiale reale ${num(f.pillars.human.externalScore)}/100 (portal.just.ro ${assessment.legalScore ?? "indisponibil"}${assessment.legalScore !== null ? "/100" : ""})`
          : `Quiz ${q.total}/100 (${q.levelLabel}) · verificări externe ${legalLoading ? "în curs" : "fără răspuns încă (nu intră în scor)"}`,
    },
    {
      name: "Investiție",
      weight: "15%",
      score: f.pillars.investment.score,
      points: f.pillars.investment.points,
      max: 15,
      detail: `Formular ${f.pillars.investment.formScore}/100 · benchmark sector ${num(f.pillars.investment.benchmarkScore)}/100`,
    },
  ];
  const maxLost = Math.max(...drivers.map((d) => d.lostPoints), 1);

  return (
    <div className="animate-rise">
      <PageHeader
        step={4}
        title="Profil Credit Ready & plan 30–90 de zile"
        subtitle="Scorul final explicat pe piloni, factorii care îl trag în jos și acțiunile concrete, prioritizate, pentru următoarele 90 de zile."
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                canExport ? window.print() : showUpgrade("Exportul Raportului „Gata de Bancă” (Print/PDF) este inclus în Planul Pro, împreună cu planul complet de 30–90 de zile.")
              }
            >
              <Printer size={15} /> Printează / PDF
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Salvează evaluarea
            </Button>
          </div>
        }
      />
      {saveMsg && <p className="no-print -mt-3 mb-4 text-xs font-medium text-navy-3">{saveMsg}</p>}

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="grid gap-0 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center border-b border-line bg-canvas/50 px-6 py-8 xl:border-b-0 xl:border-r">
            {f.complete ? (
              <ScoreRing score={f.finalScore} size={180} stroke={8} />
            ) : (
              <div className="grid h-[180px] w-[180px] place-items-center rounded-full border-8 border-line text-center">
                <div>
                  <p className="text-4xl font-light text-faint">—</p>
                  <p className="text-xs text-faint">scor incomplet</p>
                </div>
              </div>
            )}
            <p className="mt-4 text-lg font-medium">{f.complete ? f.status : "Date reale lipsă"}</p>
            {!f.complete && <p className="mt-1 max-w-[240px] text-center text-[11px] text-muted">Lipsesc: {(f.missing ?? []).join("; ")}.</p>}
            <p className="text-xs text-muted">{company.name}</p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-semibold text-faint">Formula aplicată</p>
            <p className="mt-2 font-mono text-sm leading-relaxed text-ink">
              0,70 × {num(f.pillars.business.score)} + 0,15 × {num(f.pillars.human.score)} + 0,15 × {num(f.pillars.investment.score)} = {num(f.rawScore)}
              {f.quizKillSwitch && (
                <>
                  {" "}
                  <span className="text-red">− 10 (kill-switch)</span> = {num(f.finalScore)}
                </>
              )}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {pillars.map((p) => (
                <div key={p.name} className="rounded-xl border border-line p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-ink">{p.name}</p>
                    <span className="text-[11px] font-semibold text-faint">{p.weight}</span>
                  </div>
                  <p className={cx("mt-1 text-2xl font-medium", TONE_TEXT[scoreTone(p.score)])}>{num(p.score)}</p>
                  <ProgressBar value={p.score} className="mt-1.5" />
                  <p className="mt-2 text-xs font-medium text-ink">
                    {num(p.points)} / {p.max} puncte
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{p.detail}</p>
                </div>
              ))}
            </div>
            {f.warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {f.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-medium text-red">
                    <ShieldAlert size={17} className="mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
            {q.answered < 5 && (
              <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber">
                <CircleAlert size={14} /> Quiz incomplet ({q.answered}/5) — scorul este provizoriu.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader icon={<TrendingDown size={18} />} title="Ce trage scorul în jos" subtitle="Puncte pierdute din scorul final, pe fiecare factor." />
          <ul className="space-y-3.5">
            {drivers.slice(0, 6).map((d) => (
              <li key={d.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">
                    {d.label} <span className="text-[11px] font-medium text-faint">· {d.pillar}</span>
                  </p>
                  <span className="shrink-0 text-sm font-medium text-red">−{num(d.lostPoints)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-red/70" style={{ width: `${(d.lostPoints / maxLost) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted">{d.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={<Lightbulb size={18} />} title="Plan de acțiune 30–90 de zile" subtitle="Generat automat din punctele slabe detectate; se actualizează la fiecare factură încărcată." />
          <div className="grid gap-4 md:grid-cols-3">
            {([30, 60, 90] as const).map((h) => {
              const items = plan.filter((a) => a.horizon === h);
              return (
                <div key={h}>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-navy-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-line-strong text-[10px] text-ink">{h}</span>
                    {h === 30 ? "Primele 30 de zile" : h === 60 ? "Până la 60 de zile" : "Până la 90 de zile"}
                  </p>
                  {items.length ? (
                    <ul className="space-y-3">
                      {items.map((a) =>
                        lockedActions.has(a.id) ? (
                          <div key={a.id} aria-hidden className="pointer-events-none select-none blur-[5px] saturate-50">
                            <ActionCard a={a} />
                          </div>
                        ) : (
                          <ActionCard key={a.id} a={a} />
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line p-4 text-xs text-faint">Nicio acțiune urgentă în acest interval.</p>
                  )}
                </div>
              );
            })}
          </div>
          {lockedActions.size > 0 && (
            <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
              <p className="text-xs text-muted">
                Previzualizare: vezi top 2 acțiuni. Încă {lockedActions.size} acțiuni din planul de 30–90 de zile sunt în Planul Pro.
              </p>
              <Link href="/pricing" className="rounded-full bg-navy px-4 py-2 text-xs font-medium text-white hover:bg-navy-2">
                {UNLOCK_LABEL}
              </Link>
            </div>
          )}
        </Card>
      </div>

      <BankRecommendationSection />

      <ConsultantReport />

      <Card className="mt-5 break-inside-avoid">
        <CardHeader
          icon={<Scale size={18} />}
          title="Verificare juridică portal.just.ro"
          subtitle={
            legal
              ? `Scor legal ${legal.legalScore}/100 (intră 50% în Factor uman) · sursă: ${SOURCE_LABEL[legal.source]} · ${new Date(legal.checkedAt).toLocaleString("ro-RO")}`
              : "Neverificat — nu intră în scor până la un răspuns al portalului. Rulează verificarea din pasul 1."
          }
          action={legal && <Badge tone={legal.source === "portal.just.ro" ? "emerald" : "red"}>{SOURCE_LABEL[legal.source]}</Badge>}
        />
        {legal && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <LegalPartyReport icon={<Building2 size={16} />} title="Firmă" name={legal.query.companyName} cases={legal.cases.filter((c) => c.matchedBy === "firma")} />
              <LegalPartyReport icon={<UserRound size={16} />} title="Administrator" name={legal.query.ceoName} cases={legal.cases.filter((c) => c.matchedBy !== "firma")} />
            </div>
            {legal.integrityKillSwitch && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-medium text-red">
                <ShieldAlert size={17} className="mt-0.5 shrink-0" /> Dosar critic (insolvență / infracțiune economică): scorul legal devine 0.
              </p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              {legal.message} Scorul legal combină firma și administratorul; un dosar găsit pe ambele nume apare o singură dată, la firmă.
            </p>
          </>
        )}
      </Card>

      <HowWeScore />

      <StepFooter prev="/investitie" />
    </div>
  );
}
