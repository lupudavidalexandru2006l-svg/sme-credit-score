"use client";

import { CheckSquare, ClipboardList, FileCheck2, MessagesSquare, Route, Square, TrendingUp } from "lucide-react";
import { bankQuestions, consultantConclusion, documentsFor, financingInstruments, type ConsultantInput } from "@/lib/consultant";
import { gateActionPlan, gateBanks } from "@/lib/pricing";
import { num, ron } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { Badge, Card, CardHeader, cx } from "./ui";

/**
 * Step 4 consultant layer: the conclusion, the right financing instrument, the questions the bank will ask,
 * the credit-file checklist and the progress on the action plan. Respects the plan gating of banks / actions.
 */
export function ConsultantReport() {
  const { assessment, company, investment, legal, official, docs, toggleDoc, doneActions, toggleAction, history, plan } = useAssessment();
  if (!company.id) return null;
  const input: ConsultantInput = { company, investment, legal, bilant: official.bilant, ageMonths: official.onrc?.vechimeLuni ?? null };
  const conclusion = consultantConclusion(assessment, input);
  const instruments = financingInstruments(assessment, input);
  const questions = bankQuestions(assessment, input);
  const documents = documentsFor(input);
  const haveDocs = documents.filter((d) => docs[d.id]).length;
  const visibleBanks = gateBanks(plan.planTier, assessment.banks.all.filter((b) => b.eligible)).visible.slice(0, 3);
  const visibleActions = gateActionPlan(plan.planTier, assessment.plan).visible;
  const doneCount = visibleActions.filter((a) => doneActions.includes(a.id)).length;

  return (
    <div className="mt-5 space-y-5">
      <Card className="break-inside-avoid">
        <CardHeader icon={<ClipboardList size={18} />} title="Concluzia consultantului" subtitle={`${company.officialName || company.name} · pe datele reale încărcate și verificate`} />
        <p className={cx("rounded-xl px-4 py-3 text-sm leading-relaxed", conclusion.ready ? "bg-canvas text-ink" : "bg-amber-soft text-amber")}>{conclusion.text}</p>
        {conclusion.ready && visibleBanks.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Unde să depui întâi:{" "}
            {visibleBanks.map((b, i) => (
              <span key={b.id}>
                {i > 0 && " · "}
                <strong className="text-ink">{b.bank}</strong> — {b.product} ({b.matchPct}% potrivire, până la {ron(b.maxAmount)})
              </span>
            ))}
          </p>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader icon={<Route size={18} />} title="Instrumentul de finanțare potrivit" subtitle="Nu orice nevoie se rezolvă cu un credit clasic." />
          <ul className="space-y-2.5">
            {instruments.map((i) => (
              <li key={i.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{i.title}</p>
                  <Badge tone={i.fit === "recomandat" ? "emerald" : "neutral"}>{i.fit}</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{i.why}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader icon={<MessagesSquare size={18} />} title="Ce te va întreba banca" subtitle="Întrebările care decurg din profilul tău și ce să pregătești." />
          <ol className="space-y-2.5">
            {questions.map((q, i) => (
              <li key={q.q} className="rounded-xl bg-canvas p-3">
                <p className="text-sm font-medium text-ink">
                  <span className="mr-1.5 text-faint">{i + 1}.</span>
                  {q.q}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">Pregătește: {q.prep}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader
            icon={<FileCheck2 size={18} />}
            title="Dosarul de credit"
            subtitle="Bifează ce ai deja; lista se salvează pe firmă."
            action={<Badge tone={haveDocs === documents.length ? "emerald" : "amber"}>{`${haveDocs}/${documents.length}`}</Badge>}
          />
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => toggleDoc(d.id)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-canvas">
                  {docs[d.id] ? <CheckSquare size={16} className="mt-0.5 shrink-0 text-emerald-strong" /> : <Square size={16} className="mt-0.5 shrink-0 text-faint" />}
                  <span>
                    <span className={cx("block text-sm", docs[d.id] ? "text-muted line-through" : "text-ink")}>{d.label}</span>
                    <span className="block text-[11px] text-faint">{d.where}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader
            icon={<TrendingUp size={18} />}
            title="Progres pe planul de acțiune"
            subtitle="Bifează acțiunile făcute; scorul complet se salvează zilnic."
            action={<Badge tone="navy">{`${doneCount}/${visibleActions.length}`}</Badge>}
          />
          <ul className="space-y-1.5">
            {visibleActions.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => toggleAction(a.id)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-canvas">
                  {doneActions.includes(a.id) ? <CheckSquare size={16} className="mt-0.5 shrink-0 text-emerald-strong" /> : <Square size={16} className="mt-0.5 shrink-0 text-faint" />}
                  <span className={cx("text-sm", doneActions.includes(a.id) ? "text-muted line-through" : "text-ink")}>
                    {a.title} <span className="text-[11px] text-faint">· {a.horizon} zile</span>
                  </span>
                </button>
              </li>
            ))}
            {visibleActions.length === 0 && <li className="text-xs text-faint">Nicio acțiune în plan.</li>}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-medium text-ink">Istoricul scorului</p>
            {history.length === 0 ? (
              <p className="mt-1 text-[11px] text-faint">Apare după primul scor complet (cu facturi, date declarate și verificări externe).</p>
            ) : (
              <div className="mt-2 flex items-end gap-1.5" aria-label="Istoricul scorului">
                {history.slice(-14).map((p) => (
                  <div key={p.date} className="flex flex-col items-center gap-1" title={`${p.date}: ${num(p.score)}`}>
                    <div className="w-5 rounded-t bg-navy/70" style={{ height: `${Math.max(4, p.score * 0.6)}px` }} />
                    <span className="text-[9px] text-faint">{p.date.slice(8, 10)}.{p.date.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
