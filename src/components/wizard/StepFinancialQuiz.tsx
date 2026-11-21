"use client";

import { useMemo } from "react";
import { ArrowLeft, Snowflake } from "lucide-react";
import type { EFacturaGroundTruth, QuizAnswers } from "@/types/scoring";
import { CLIENT_SHARE_BUCKETS, PAYMENT_TERM_BUCKETS } from "@/lib/scoringEngine";
import { ChoiceTile, MoneyInput, NeuButton, Panel, QuestionHeader } from "@/components/ui/neu";

export const EMPTY_QUIZ: QuizAnswers = {
  revenueEstimate: null,
  paymentTerm: null,
  topClientShare: null,
  mainSupplier: null,
  hasSignificantCreditNotes: null,
};

export function StepFinancialQuiz({
  truth,
  value,
  onChange,
  onBack,
  onSubmit,
}: {
  truth: EFacturaGroundTruth;
  value: QuizAnswers;
  onChange: (v: QuizAnswers) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // Real top 5 + decoys, alphabetical so the order reveals nothing.
  const supplierOptions = useMemo(
    () =>
      [...truth.topSuppliers.map((s) => s.name), ...truth.decoySuppliers].sort((a, b) =>
        a.localeCompare(b, "ro"),
      ),
    [truth],
  );

  const answered = [
    value.revenueEstimate !== null && value.revenueEstimate > 0,
    value.paymentTerm !== null,
    value.topClientShare !== null,
    value.mainSupplier !== null,
    value.hasSignificantCreditNotes !== null,
  ].filter(Boolean).length;

  return (
    <Panel className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Quiz 1 · Cunoaștere financiară</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Răspunde din memorie. Răspunsurile tale sunt comparate cu datele reale din RO e-Factura pentru{" "}
            <span className="text-ink">{truth.companyName}</span>.
          </p>
        </div>
        <div className="neu-pressed-sm rounded-full px-4 py-2 font-mono text-xs text-muted">
          <span className="text-stone">{answered}</span>/5 răspunsuri
        </div>
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-9 lg:grid-cols-2">
        <div>
          <QuestionHeader
            index={1}
            htmlFor="revenue"
            title="Cifra de afaceri facturată în ultimele 3 luni"
            hint="Fără TVA, total facturi emise"
            maxPoints={35}
          />
          <MoneyInput
            id="revenue"
            value={value.revenueEstimate}
            onChange={(revenueEstimate) => onChange({ ...value, revenueEstimate })}
            placeholder="ex: 450.000"
          />
        </div>

        <div>
          <QuestionHeader index={2} title="Termenul mediu de plată oferit clienților" maxPoints={25} />
          <div role="radiogroup" aria-label="Termen mediu de plată" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PAYMENT_TERM_BUCKETS.map((b) => (
              <ChoiceTile
                key={b.value}
                selected={value.paymentTerm === b.value}
                onClick={() => onChange({ ...value, paymentTerm: b.value })}
                className="text-center"
              >
                {b.label}
              </ChoiceTile>
            ))}
          </div>
        </div>

        <div>
          <QuestionHeader
            index={3}
            title="Ponderea celui mai mare client în vânzări"
            hint="Cât din totalul facturat merge către clientul principal"
            maxPoints={20}
          />
          <div role="radiogroup" aria-label="Pondere client principal" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CLIENT_SHARE_BUCKETS.map((b) => (
              <ChoiceTile
                key={b.value}
                selected={value.topClientShare === b.value}
                onClick={() => onChange({ ...value, topClientShare: b.value })}
                className="text-center"
              >
                {b.label}
              </ChoiceTile>
            ))}
          </div>
        </div>

        <div>
          <QuestionHeader
            index={5}
            title="Facturi stornate semnificative în ultimele 3 luni?"
            hint="Peste 5% din totalul emis (InvoiceTypeCode 381)"
            maxPoints={8}
          />
          <div role="radiogroup" aria-label="Facturi stornate" className="grid grid-cols-2 gap-3">
            {[
              { v: true, l: "Da" },
              { v: false, l: "Nu" },
            ].map((o) => (
              <ChoiceTile
                key={o.l}
                selected={value.hasSignificantCreditNotes === o.v}
                onClick={() => onChange({ ...value, hasSignificantCreditNotes: o.v })}
                className="text-center"
              >
                {o.l}
              </ChoiceTile>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <QuestionHeader
            index={4}
            title="Principalul furnizor după valoarea achizițiilor"
            hint="Alege firma de la care ai cumpărat cel mai mult în ultimele 3 luni"
            maxPoints={12}
          />
          <div role="radiogroup" aria-label="Furnizor principal" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {supplierOptions.map((name) => (
              <ChoiceTile
                key={name}
                selected={value.mainSupplier === name}
                onClick={() => onChange({ ...value, mainSupplier: name })}
              >
                <span className="block pr-4 leading-snug">{name}</span>
              </ChoiceTile>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <NeuButton variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Înapoi
        </NeuButton>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <NeuButton onClick={onSubmit} disabled={answered < 5}>
            <Snowflake size={16} /> Îngheață răspunsurile și continuă
          </NeuButton>
          <span className="text-center text-[11px] text-muted sm:text-right">
            Scorul quiz-ului se îngheață la trimitere, ca în producție.
          </span>
        </div>
      </div>
    </Panel>
  );
}
