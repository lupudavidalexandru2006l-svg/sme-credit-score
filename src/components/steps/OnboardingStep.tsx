"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, CircleAlert, ListChecks, LoaderCircle, ShieldAlert } from "lucide-react";
import { CLIENT_SHARE_BUCKETS, PAYMENT_TERM_BUCKETS, quizTruthFromMetrics, supplierOptions } from "@/lib/scoringEngine";
import { useAssessment } from "../AssessmentProvider";
import { CompanyForm } from "../CompanyForm";
import { LegalPanel } from "../LegalPanel";
import { SequentialQuiz } from "../SequentialQuiz";
import { PageHeader } from "../Shell";
import { Badge, cx, inputCls, Segmented } from "../ui";

const LEVEL_TONE = { ridicat: "emerald", bun: "blue", partial: "amber", deconectat: "red" } as const;

function QuestionShell({ n, points, title, children }: { n: number; points: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          <span className="mr-2 text-faint">{n}.</span>
          {title}
        </p>
        <Badge tone="navy">{points} p</Badge>
      </div>
      {children}
    </div>
  );
}

export function OnboardingStep() {
  const { quiz, setQuiz, assessment, markVisited } = useAssessment();
  const truth = quizTruthFromMetrics(assessment.metrics);
  const q = assessment.quiz;
  const [revenueText, setRevenueText] = useState(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");

  useEffect(() => markVisited("onboarding"), [markVisited]);
  // Keep the formatted text in sync when answers change elsewhere (demo).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external changes into the text input
    setRevenueText(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");
  }, [quiz.revenueEstimate]);

  return (
    <div className="animate-rise">
      <PageHeader
        step={1}
        title="Onboarding & factor uman"
        subtitle="Datele firmei, verificarea juridică automată și quiz-ul de cunoștințe financiare validat automat pe datele e-Factura."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <CompanyForm />

        <LegalPanel />
      </div>

      <SequentialQuiz
        kind="quiz"
        icon={<ListChecks size={18} />}
        title="Quiz de cunoștințe financiare"
        subtitle="5 întrebări, 100 de puncte. Răspunsurile sunt verificate automat față de facturile e-Factura și se re-validează la fiecare XML încărcat."
        intro={
          !assessment.dataStatus.hasInvoices && (
            <p className="mb-4 rounded-xl bg-amber-soft px-4 py-3 text-xs font-medium text-amber">
              Quiz-ul se verifică pe facturile reale ale firmei. Poți răspunde acum, dar punctajul apare după ce încarci facturile e-Factura în Pasul 2.
            </p>
          )
        }
        steps={[
          {
            key: "revenue",
            answered: quiz.revenueEstimate != null,
            content: (
              <QuestionShell n={1} points={35} title="Care a fost cifra de afaceri facturată în ultimele 3 luni (fără TVA)?">
                <div className="relative">
                  <input
                    inputMode="numeric"
                    className={cx(inputCls, "pr-14 text-base font-semibold")}
                    placeholder="ex. 1.500.000"
                    value={revenueText}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setRevenueText(digits ? Number(digits).toLocaleString("ro-RO") : "");
                      setQuiz({ revenueEstimate: digits ? Number(digits) : null });
                    }}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-faint">RON</span>
                </div>
                <p className="mt-2 text-[11px] text-muted">≤ 10% abatere: 35 p · 10–20%: 24 p · 20–35%: 10 p · peste 35%: 0 p</p>
              </QuestionShell>
            ),
          },
          {
            key: "term",
            answered: quiz.paymentTerm != null,
            content: (
              <QuestionShell n={2} points={25} title="Care este termenul mediu de plată oferit clienților?">
                <Segmented name="Termen de plată" options={PAYMENT_TERM_BUCKETS} value={quiz.paymentTerm} onChange={(v) => setQuiz({ paymentTerm: v })} />
                <p className="mt-2 text-[11px] text-muted">Potrivire exactă: 25 p · interval vecin: 12 p</p>
              </QuestionShell>
            ),
          },
          {
            key: "share",
            answered: quiz.topClientShare != null,
            content: (
              <QuestionShell n={3} points={20} title="Ce pondere are cel mai mare client în totalul vânzărilor?">
                <Segmented name="Pondere client principal" options={CLIENT_SHARE_BUCKETS} value={quiz.topClientShare} onChange={(v) => setQuiz({ topClientShare: v })} />
                <p className="mt-2 text-[11px] text-muted">Potrivire exactă: 20 p · prag vecin: 10 p</p>
              </QuestionShell>
            ),
          },
          {
            key: "supplier",
            answered: Boolean(quiz.mainSupplier),
            content: (
              <QuestionShell n={4} points={12} title="Cine este principalul tău furnizor (după valoarea achizițiilor)?">
                <div role="radiogroup" aria-label="Furnizor principal" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {supplierOptions(truth).map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={quiz.mainSupplier === name}
                      onClick={() => setQuiz({ mainSupplier: name })}
                      className={cx(
                        "rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                        quiz.mainSupplier === name ? "border-navy bg-navy text-white" : "border-line-strong bg-white hover:border-navy-3",
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Furnizorul #1 din facturile primite: 12 p · #2 sau #3: 6 p</p>
              </QuestionShell>
            ),
          },
          {
            key: "credit-notes",
            answered: quiz.hasSignificantCreditNotes !== null,
            content: (
              <QuestionShell n={5} points={8} title="Ai avut facturi stornate semnificative (> 5% din total) în ultimele 3 luni?">
                <Segmented
                  name="Stornări"
                  options={[
                    { value: "da", label: "Da" },
                    { value: "nu", label: "Nu" },
                  ]}
                  value={quiz.hasSignificantCreditNotes === null ? null : quiz.hasSignificantCreditNotes ? "da" : "nu"}
                  onChange={(v) => setQuiz({ hasSignificantCreditNotes: v === "da" })}
                />
                <p className="mt-2 text-[11px] text-muted">Verificat pe facturile cu InvoiceTypeCode 381.</p>
              </QuestionShell>
            ),
          },
        ]}
        result={
          <div className="rounded-xl border border-line bg-canvas p-5">
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="text-[11px] font-semibold text-faint">Scor quiz</p>
                <p className="text-4xl font-medium text-ink">
                  {q.total}
                  <span className="text-lg text-faint">/100</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-faint">S_Uman</p>
                <p className="text-2xl font-medium text-ink">{assessment.final.pillars.human.score}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-faint">Scor final</p>
                <p className="text-2xl font-medium text-ink">{assessment.final.finalScore}</p>
              </div>
              <div className="flex-1">
                <Badge tone={LEVEL_TONE[q.level]}>{q.levelLabel}</Badge>
                <p className="mt-1.5 text-[11px] text-muted">Praguri: 85–100 control ridicat · 35–84 bun / parțial · 0–34 deconectare (kill-switch)</p>
                {q.flags.map((f) => (
                  <p key={f} className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
                    <CircleAlert size={13} className="mt-0.5 shrink-0" /> {f}
                  </p>
                ))}
              </div>
            </div>
            {!assessment.dataStatus.hasInvoices && (
              <p className="mt-4 text-xs font-medium text-amber">Punctajul devine final după ce încarci facturile e-Factura în Pasul 2.</p>
            )}
            {assessment.final.quizKillSwitch && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-semibold text-red">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" /> Alertă de guvernanță: kill-switch activ (quiz 0–34) — se scad 10 puncte (-10 pct) din scorul final.
              </p>
            )}
            <details className="group mt-4" open>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-navy-3">
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" /> Rezumat pe întrebări (validare față de e-Factura)
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-faint">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Întrebare</th>
                      <th className="py-2 pr-3 font-semibold">Răspunsul tău</th>
                      <th className="py-2 pr-3 font-semibold">e-Factura</th>
                      <th className="py-2 text-right font-semibold">Puncte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.items.map((i) => (
                      <tr key={i.id} className="border-t border-line align-top">
                        <td className="py-2.5 pr-3 font-medium text-ink">
                          {i.question}
                          <p className="font-normal text-muted">{i.detail}</p>
                        </td>
                        <td className="py-2.5 pr-3">{i.userAnswer}</td>
                        <td className="py-2.5 pr-3">{i.truthAnswer}</td>
                        <td className={cx("py-2.5 text-right font-semibold", i.points === i.maxPoints ? "text-emerald-strong" : i.points === 0 ? "text-red" : "text-amber")}>
                          {i.points}/{i.maxPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        }
      />

      <ContinueToAnalysis />
    </div>
  );
}

/**
 * "Continuă" to step 2: an unsaved company form is saved first (same rules as the Save button), so step 2
 * always shows the company typed here. Navigation never blocks: without a valid form it just goes on.
 */
function ContinueToAnalysis() {
  const { pendingDraft, saveCompany } = useAssessment();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try {
      if (pendingDraft) {
        const r = await saveCompany(pendingDraft);
        if (!r.ok) setNote(r.message);
      }
    } finally {
      setBusy(false);
      router.push("/analiza");
    }
  };
  return (
    <div className="no-print mt-10 flex flex-wrap items-center justify-end gap-3">
      {note && <p className="text-xs text-amber">{note}</p>}
      {pendingDraft && <p className="text-xs text-muted">Modificările din formularul firmei se salvează automat.</p>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-medium text-white hover:bg-navy-2 disabled:opacity-60"
      >
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
        Analiză business <ArrowRight size={15} />
      </button>
    </div>
  );
}
