"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown, CircleAlert, ExternalLink, Link2, ListChecks, ShieldAlert, Sparkles } from "lucide-react";
import type { ClientShareBucket, PaymentTermBucket, QuizAnswers } from "@/types/scoring";
import { SECTOR_BENCHMARKS } from "@/lib/data/benchmarks";
import { CLIENT_SHARE_BUCKETS, PAYMENT_TERM_BUCKETS, quizTruthFromMetrics, supplierOptions } from "@/lib/scoringEngine";
import { useAssessment } from "../AssessmentProvider";
import { LegalPanel } from "../LegalPanel";
import { PageHeader, StepFooter } from "../Shell";
import { Badge, Button, Card, CardHeader, cx, Field, inputCls, ProgressBar, Segmented } from "../ui";

const EXTERNAL_QUIZ_URL = process.env.NEXT_PUBLIC_EXTERNAL_QUIZ_URL ?? "";

const LEVEL_TONE = { ridicat: "emerald", bun: "blue", partial: "amber", deconectat: "red" } as const;

function QuestionShell({ n, points, title, children }: { n: number; points: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-ink">
          <span className="mr-2 text-faint">{n}.</span>
          {title}
        </p>
        <Badge tone="navy">{points} p</Badge>
      </div>
      {children}
    </div>
  );
}

/** Answers coming back from the external quiz site via redirect (?q1=..&q2=..) or ?quiz=<base64 JSON>. */
function answersFromUrl(): Partial<QuizAnswers> | null {
  const p = new URLSearchParams(window.location.search);
  try {
    if (p.get("quiz")) return JSON.parse(atob(p.get("quiz")!)) as Partial<QuizAnswers>;
  } catch {
    return null;
  }
  if (!p.has("q1")) return null;
  return {
    revenueEstimate: Number(p.get("q1")) || null,
    paymentTerm: (p.get("q2") as PaymentTermBucket) ?? null,
    topClientShare: (p.get("q3") as ClientShareBucket) ?? null,
    mainSupplier: p.get("q4"),
    hasSignificantCreditNotes: p.get("q5") === null ? null : p.get("q5") === "da" || p.get("q5") === "true",
  };
}

export function OnboardingStep() {
  const { company, setCompany, quiz, setQuiz, assessment, loadDemo, markVisited } = useAssessment();
  const truth = quizTruthFromMetrics(assessment.metrics);
  const q = assessment.quiz;
  const [revenueText, setRevenueText] = useState(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => markVisited("onboarding"), [markVisited]);
  // Keep the formatted text in sync when answers change elsewhere (demo, import).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external changes into the text input
    setRevenueText(quiz.revenueEstimate ? quiz.revenueEstimate.toLocaleString("ro-RO") : "");
  }, [quiz.revenueEstimate]);

  useEffect(() => {
    const fromUrl = answersFromUrl();
    if (fromUrl) {
      setQuiz(fromUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time import from the redirect URL
      setImportMsg("Răspunsuri importate din platforma de quiz-uri (redirect).");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setQuiz]);

  const importLatest = async () => {
    setImportMsg("Caut ultimul rezultat…");
    try {
      const r = await fetch(`/api/quiz?cui=${encodeURIComponent(company.cui)}`).then((x) => x.json());
      if (r.found) {
        setQuiz(r.answers);
        setImportMsg(`Importat rezultatul primit la ${new Date(r.receivedAt).toLocaleString("ro-RO")}.`);
      } else setImportMsg("Niciun rezultat primit încă prin webhook pentru acest CUI.");
    } catch {
      setImportMsg("API indisponibil.");
    }
  };

  const openExternal = () => {
    const returnUrl = `${window.location.origin}/onboarding`;
    window.open(`${EXTERNAL_QUIZ_URL}${EXTERNAL_QUIZ_URL.includes("?") ? "&" : "?"}cui=${encodeURIComponent(company.cui)}&return=${encodeURIComponent(returnUrl)}`, "_self");
  };

  return (
    <div className="animate-rise">
      <PageHeader
        step={1}
        title="Onboarding & factor uman"
        subtitle="Datele firmei, verificarea juridică automată și quiz-ul de cunoștințe financiare validat automat pe datele e-Factura."
        action={
          <Button variant="secondary" onClick={loadDemo}>
            <Sparkles size={15} /> Completează scenariul demo
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader icon={<Building2 size={18} />} title="Date firmă" subtitle="Pre-completat cu firma demo (date 100% sintetice)." />
          <div className="space-y-4">
            <Field label="Denumire firmă">
              <input className={inputCls} value={company.name} onChange={(e) => setCompany({ name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CUI" hint="Folosit la identificarea facturilor emise / primite.">
                <input className={inputCls} value={company.cui} onChange={(e) => setCompany({ cui: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Sector (cod CAEN)" hint="Pentru benchmark.">
                <select className={inputCls} value={company.caenCode} onChange={(e) => setCompany({ caenCode: e.target.value })}>
                  {SECTOR_BENCHMARKS.map((s) => (
                    <option key={s.caenCode} value={s.caenCode}>
                      {s.caenCode} — {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Administrator / CEO" hint="Căutat și el în portal.just.ro (potrivire pe numele complet).">
              <input className={inputCls} value={company.ceoName} onChange={(e) => setCompany({ ceoName: e.target.value })} />
            </Field>
          </div>
        </Card>

        <LegalPanel />
      </div>

      <Card className="mt-5">
        <CardHeader
          icon={<ListChecks size={18} />}
          title="Quiz de cunoștințe financiare"
          subtitle="5 întrebări, 100 de puncte. Răspunsurile sunt verificate automat față de facturile e-Factura și se re-validează la fiecare XML încărcat."
          action={
            <div className="w-40 text-right">
              <p className="text-xs font-bold text-muted">{q.answered}/5 răspunsuri</p>
              <ProgressBar value={q.answered * 20} tone="navy" className="mt-1" />
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <QuestionShell n={1} points={35} title="Care a fost cifra de afaceri facturată în ultimele 3 luni (fără TVA)?">
            <div className="relative">
              <input
                inputMode="numeric"
                className={cx(inputCls, "pr-14 text-base font-bold")}
                placeholder="ex. 1.500.000"
                value={revenueText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setRevenueText(digits ? Number(digits).toLocaleString("ro-RO") : "");
                  setQuiz({ revenueEstimate: digits ? Number(digits) : null });
                }}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-faint">RON</span>
            </div>
            <p className="mt-2 text-[11px] text-muted">≤ 10% abatere: 35 p · 10–20%: 24 p · 20–35%: 10 p · peste 35%: 0 p</p>
          </QuestionShell>

          <QuestionShell n={2} points={25} title="Care este termenul mediu de plată oferit clienților?">
            <Segmented name="Termen de plată" options={PAYMENT_TERM_BUCKETS} value={quiz.paymentTerm} onChange={(v) => setQuiz({ paymentTerm: v })} />
            <p className="mt-2 text-[11px] text-muted">Potrivire exactă: 25 p · interval vecin: 12 p</p>
          </QuestionShell>

          <QuestionShell n={3} points={20} title="Ce pondere are cel mai mare client în totalul vânzărilor?">
            <Segmented name="Pondere client principal" options={CLIENT_SHARE_BUCKETS} value={quiz.topClientShare} onChange={(v) => setQuiz({ topClientShare: v })} />
            <p className="mt-2 text-[11px] text-muted">Potrivire exactă: 20 p · prag vecin: 10 p</p>
          </QuestionShell>

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

          <div className="lg:col-span-2">
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
                      "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                      quiz.mainSupplier === name ? "border-navy bg-navy text-white" : "border-line-strong bg-white hover:border-navy-3",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">Furnizorul #1 din facturile primite: 12 p · #2 sau #3: 6 p</p>
            </QuestionShell>
          </div>
        </div>

        {q.answered === 5 ? (
          <div className="mt-5 rounded-xl border border-line bg-canvas p-5">
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Scor quiz</p>
                <p className="text-4xl font-extrabold text-ink">
                  {q.total}
                  <span className="text-lg text-faint">/100</span>
                </p>
              </div>
              <div className="flex-1">
                <Badge tone={LEVEL_TONE[q.level]}>{q.levelLabel}</Badge>
                {q.flags.map((f) => (
                  <p key={f} className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
                    <CircleAlert size={13} className="mt-0.5 shrink-0" /> {f}
                  </p>
                ))}
              </div>
            </div>
            {q.level === "deconectat" && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-red/30 bg-red-soft px-4 py-3 text-sm font-bold text-red">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" /> Alertă de guvernanță: kill-switch activ — se scad 10 puncte din scorul final.
              </p>
            )}
            <details className="group mt-4">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-bold text-navy-3">
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" /> Validarea automată față de e-Factura
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-faint">
                    <tr>
                      <th className="py-2 pr-3 font-bold">Întrebare</th>
                      <th className="py-2 pr-3 font-bold">Răspunsul tău</th>
                      <th className="py-2 pr-3 font-bold">e-Factura</th>
                      <th className="py-2 text-right font-bold">Puncte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.items.map((i) => (
                      <tr key={i.id} className="border-t border-line align-top">
                        <td className="py-2.5 pr-3 font-semibold text-ink">
                          {i.question}
                          <p className="font-normal text-muted">{i.detail}</p>
                        </td>
                        <td className="py-2.5 pr-3">{i.userAnswer}</td>
                        <td className="py-2.5 pr-3">{i.truthAnswer}</td>
                        <td className={cx("py-2.5 text-right font-bold", i.points === i.maxPoints ? "text-emerald-strong" : i.points === 0 ? "text-red" : "text-amber")}>
                          {i.points}/{i.maxPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted">Răspunde la toate cele 5 întrebări. Până atunci, întrebările fără răspuns valorează 0 p (scorul final este provizoriu).</p>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader
          icon={<Link2 size={18} />}
          title="Conectare cu platforma de quiz-uri existentă"
          subtitle="Quiz-ul poate fi completat și pe site-ul extern; rezultatul se întoarce aici prin webhook sau redirect și actualizează S_Uman."
        />
        <div className="grid gap-4 text-xs text-muted md:grid-cols-3">
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 font-bold text-ink">1. Redirect cu parametri</p>
            Site-ul extern trimite utilizatorul înapoi la <code className="font-mono text-navy-3">/onboarding?q1=2000000&amp;q2=30&amp;q3=15-30&amp;q4=…&amp;q5=nu</code>
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 font-bold text-ink">2. Webhook server-to-server</p>
            <code className="font-mono text-navy-3">POST /api/quiz</code> cu <code className="font-mono">{"{ cui, answers }"}</code> și header <code className="font-mono">x-quiz-secret</code>. Salvat în Supabase.
          </div>
          <div className="rounded-xl bg-canvas p-4">
            <p className="mb-1 font-bold text-ink">3. Import</p>
            Butonul de mai jos citește ultimul rezultat primit pentru CUI {company.cui}.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={importLatest}>
            Importă ultimul rezultat
          </Button>
          {EXTERNAL_QUIZ_URL ? (
            <Button onClick={openExternal}>
              Deschide quiz-ul extern <ExternalLink size={14} />
            </Button>
          ) : (
            <span className="text-[11px] text-faint">Setează NEXT_PUBLIC_EXTERNAL_QUIZ_URL în .env.local pentru butonul „Deschide quiz-ul extern”.</span>
          )}
          {importMsg && <span className="text-xs font-semibold text-navy-3">{importMsg}</span>}
        </div>
      </Card>

      <StepFooter next="/analiza" nextLabel="Analiză business" />
    </div>
  );
}
