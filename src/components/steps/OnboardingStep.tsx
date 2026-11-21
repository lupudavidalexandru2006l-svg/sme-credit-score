"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, ListChecks, LoaderCircle } from "lucide-react";
import { CLIENT_SHARE_BUCKETS, PAYMENT_TERM_BUCKETS, quizTruthFromMetrics, supplierOptions } from "@/lib/scoringEngine";
import { useAssessment } from "../AssessmentProvider";
import { CompanyForm } from "../CompanyForm";
import { LegalPanel } from "../LegalPanel";
import { SequentialQuiz } from "../SequentialQuiz";
import { PageHeader, StepDoneNote } from "../Shell";
import { Badge, cx, inputCls, Segmented } from "../ui";

/** "Demo complet (1 click)": a ready-to-analyse company, straight to step 4. */
function DemoLoader() {
  const { loadDemo } = useAssessment();
  const router = useRouter();
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy/15 bg-white/70 p-4">
      <div>
        <p className="text-sm font-medium text-ink">Vrei să vezi direct rezultatul?</p>
        <p className="text-xs text-muted">Firmă demo completă (NORD FRESH DISTRIBUTIE SRL): facturi pe 12 luni, verificări externe, quiz și formular de investiție completate.</p>
      </div>
      <button
        type="button"
        onClick={() => {
          loadDemo();
          router.push("/profil");
        }}
        className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2"
      >
        <FlaskConical size={15} /> Încarcă Demo Complet (Date Gata de Analiză)
      </button>
    </div>
  );
}

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
  const [revenueText, setRevenueText] = useState(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");

  useEffect(() => markVisited("onboarding"), [markVisited]);
  // Keep the formatted text in sync when answers change elsewhere (demo).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external changes into the text input
    setRevenueText(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");
  }, [quiz.revenueEstimate]);

  return (
    <div className="animate-rise">
      <DemoLoader />
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
              Quiz-ul se verifică pe facturile reale ale firmei (încărcate în Pasul 2). Rezultatul îl vezi la final, în Pasul 4.
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
        result={<StepDoneNote text="Quiz Factor Uman finalizat — Rezultatul va fi calculat la final (Pasul 4)." />}
      />

      <ContinueToAnalysis />
    </div>
  );
}

/**
 * "Continuă" to step 2: an unsaved company form is saved first (same rules as the Save button), so step 2
 * always shows the company typed here. Step 2 opens only with company name + CEO saved and the quiz finished.
 */
function ContinueToAnalysis() {
  const { pendingDraft, saveCompany, company, quizCompleted } = useAssessment();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setNote(null);
    try {
      let hasCompany = Boolean(company.id && company.name && company.ceoName);
      if (pendingDraft) {
        const r = await saveCompany(pendingDraft);
        if (!r.ok) return setNote(r.message);
        hasCompany = true;
      }
      if (!hasCompany) return setNote("Completează numele firmei și numele CEO-ului (administratorului), apoi salvează firma.");
      if (!quizCompleted.quiz) return setNote("Finalizează Quiz-ul Factor Uman (toate cele 5 întrebări) înainte de a continua.");
      router.push("/analiza");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="no-print mt-10 flex flex-col items-end gap-2">
      {pendingDraft && <p className="text-xs text-muted">Modificările din formularul firmei se salvează automat.</p>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-medium text-white hover:bg-navy-2 disabled:opacity-60"
      >
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
        Continuă la Pasul 2 <ArrowRight size={15} />
      </button>
      {note && <p className="max-w-sm text-right text-xs font-medium text-red">{note}</p>}
    </div>
  );
}
