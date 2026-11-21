"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Info, Lightbulb, LoaderCircle, Printer, Save, ShieldAlert, TrendingDown } from "lucide-react";
import type { ActionItem } from "@/types/scoring";
import { LOAN_ANNUAL_RATE, LOAN_MONTHS } from "@/lib/scoringEngine";
import { num } from "@/lib/util";
import { useAssessment } from "../AssessmentProvider";
import { ScoreRing } from "../charts";
import { PageHeader, StepFooter } from "../Shell";
import { Badge, Button, Card, CardHeader, cx, Disclaimer, ProgressBar, scoreTone, TONE_TEXT } from "../ui";

const PRIORITY_TONE = { critică: "red", ridicată: "amber", medie: "navy" } as const;

function ActionCard({ a }: { a: ActionItem }) {
  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={PRIORITY_TONE[a.priority]}>Prioritate {a.priority}</Badge>
        {a.impactPoints > 0 && <Badge tone="emerald">+{num(a.impactPoints)} p potențial</Badge>}
      </div>
      <p className="mt-2 text-sm font-bold text-ink">{a.title}</p>
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

export function ProfileStep() {
  const { assessment, company, quiz, investment, legal, legalLoading, uploads, markVisited } = useAssessment();
  const { final: f, drivers, plan, quiz: q, business: b } = assessment;
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
      detail: `Quiz ${q.total}/100 (${q.levelLabel}) · portal.just.ro ${assessment.legalScore}/100${assessment.legalPending ? (legalLoading ? " (în verificare)" : " (neverificat, neutru)") : ""}`,
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
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> Printează / PDF
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Salvează evaluarea
            </Button>
          </div>
        }
      />
      {saveMsg && <p className="no-print -mt-3 mb-4 text-xs font-semibold text-navy-3">{saveMsg}</p>}

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="grid gap-0 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center bg-navy px-6 py-8 text-white">
            <ScoreRing score={f.finalScore} size={190} stroke={16} dark />
            <p className="mt-4 text-lg font-extrabold">{f.status}</p>
            <p className="text-xs text-white/60">{company.name}</p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Formula aplicată</p>
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
                    <p className="text-sm font-bold text-ink">{p.name}</p>
                    <span className="text-[11px] font-bold text-faint">{p.weight}</span>
                  </div>
                  <p className={cx("mt-1 text-2xl font-extrabold", TONE_TEXT[scoreTone(p.score)])}>{num(p.score)}</p>
                  <ProgressBar value={p.score} className="mt-1.5" />
                  <p className="mt-2 text-xs font-semibold text-ink">
                    {num(p.points)} / {p.max} puncte
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{p.detail}</p>
                </div>
              ))}
            </div>
            {f.warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {f.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-semibold text-red">
                    <ShieldAlert size={17} className="mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
            {q.answered < 5 && (
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber">
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
                  <p className="text-sm font-bold text-ink">
                    {d.label} <span className="text-[11px] font-semibold text-faint">· {d.pillar}</span>
                  </p>
                  <span className="shrink-0 text-sm font-extrabold text-red">−{num(d.lostPoints)}</span>
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
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-navy text-[10px] text-white">{h}</span>
                    {h === 30 ? "Primele 30 de zile" : h === 60 ? "Până la 60 de zile" : "Până la 90 de zile"}
                  </p>
                  {items.length ? (
                    <ul className="space-y-3">
                      {items.map((a) => (
                        <ActionCard key={a.id} a={a} />
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line p-4 text-xs text-faint">Nicio acțiune urgentă în acest interval.</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-5" id="cum-calculam">
        <CardHeader icon={<Info size={18} />} title="Cum calculăm" subtitle="Formula este publică și identică pe client și pe server (lib/assessment.ts)." />
        <div className="grid gap-4 text-xs leading-relaxed text-muted md:grid-cols-3">
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 text-sm font-bold text-ink">S_Business · 70%</p>
            Stabilitate încasări 25% (CV lunar) · Comportament de plată 25% (DSO + facturi întârziate &gt; 5 zile) · Sezonalitate 10% (lună max/min) · Concentrare 15% (client #1) · Capacitate de rambursare 25% (DSCR cu rata nouă la{" "}
            {LOAN_ANNUAL_RATE * 100}%/an, {LOAN_MONTHS} luni).
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 text-sm font-bold text-ink">S_Uman · 15%</p>
            0,5 × Quiz (5 întrebări, 100 p, validate pe e-Factura) + 0,5 × portal.just.ro (100 p, penalizare progresivă după gravitate și rol în dosar). Quiz 0–34 p → kill-switch −10 p din scorul final.
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 text-sm font-bold text-ink">S_Investiție · 15%</p>
            0,5 × formular (destinație 50 p, avans 30 p, sumă / CA anualizată 20 p) + 0,5 × benchmark sector (DSO, concentrare, stornări, sezonalitate, marjă vs. p25 / mediană / p75 CAEN).
          </div>
        </div>
        <Disclaimer className="mt-4" />
      </Card>

      <StepFooter prev="/investitie" />
    </div>
  );
}
