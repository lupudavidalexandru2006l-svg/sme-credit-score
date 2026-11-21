"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown } from "lucide-react";
import { num, ron } from "@/lib/util";
import { useAssessment } from "./AssessmentProvider";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./ui";

const STATUS_LABEL = { clean: "OK", warning: "Atenție", critical: "Critic", unavailable: "Indisponibil" } as const;

/** The one-page A4 "Fișă Pre-Calificare Bancă". Rendered into <body> and visible only while printing it. */
function Sheet() {
  const { assessment, company, official, verification, investment } = useAssessment();
  const f = assessment.final;
  const a = official.anaf;
  const top2 = [assessment.banks.top, ...assessment.banks.alternatives].filter(Boolean).slice(0, 2);
  const plan = [...assessment.plan].sort((x, y) => x.horizon - y.horizon || y.impactPoints - x.impactPoints).slice(0, 5);
  const generated = new Date().toLocaleString("ro-RO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rows: [string, string][] = [
    ["Denumire", a?.denumire || company.officialName || company.name],
    ["CUI", a?.cui ? `RO${a.cui.replace(/\D/g, "")}`.replace(/^RORO/, "RO") : company.cui || "—"],
    ["Nr. Reg. Com.", a?.nrRegCom || "—"],
    ["Adresă", a?.adresa || company.city || "—"],
    ["CAEN", a?.codCaen || company.caenCode || "—"],
    ["Administrator", company.ceoName || "—"],
    ["CNP administrator", company.ceoCnpMasked ?? "nedeclarat"],
  ];

  return (
    <div id="bank-report-sheet" aria-hidden>
      <div className="brs-head">
        <BrandLogo size="md" tagline />
        <div className="brs-right">
          <p className="brs-title">Fișă Pre-Calificare Bancă</p>
          <p>Generată: {generated}</p>
        </div>
      </div>
      <p className="brs-disclaimer">Raport de pre-calificare Credit Readiness — nu reprezintă aprobare bancară. Calculat pe date reale (e-Factura, ANAF, bilanț, VIES, ONRC, portal.just.ro) cu formulă publică.</p>

      <div className="brs-grid2">
        <section>
          <h3>Date oficiale ANAF</h3>
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Cele 5 surse oficiale verificate</h3>
          <table>
            <tbody>
              {verification.sources.map((s) => (
                <tr key={s.sourceId}>
                  <th>{s.name}</th>
                  <td>
                    <strong>{STATUS_LABEL[s.status]}</strong>
                    {s.score !== null ? ` · ${num(s.score)}/100` : ""} — {s.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="brs-score">
        <div className="brs-big">
          <p className="brs-label">Scor Credit Ready</p>
          <p className="brs-num">{f.complete ? num(f.finalScore) : "—"}<span>/100</span></p>
          <p className="brs-label">{f.complete ? f.status : "incomplet"}</p>
        </div>
        <div className="brs-pillars">
          {[
            ["S_Business (70%)", f.pillars.business.score],
            ["S_Uman (15%)", f.pillars.human.score],
            ["S_Investiție (15%)", f.pillars.investment.score],
          ].map(([l, v]) => (
            <div key={String(l)}>
              <p className="brs-label">{l}</p>
              <p className="brs-mid">{f.complete ? num(Number(v)) : "—"}</p>
            </div>
          ))}
          <div>
            <p className="brs-label">DSCR</p>
            <p className="brs-mid">{assessment.business.dscr >= 99 ? "fără datorii" : `${num(assessment.business.dscr)}×`}</p>
          </div>
          <div>
            <p className="brs-label">DSO</p>
            <p className="brs-mid">{num(assessment.metrics.dsoDays)} zile</p>
          </div>
          <div>
            <p className="brs-label">Concentrare client #1</p>
            <p className="brs-mid">{num(assessment.metrics.topClientSharePct)}%</p>
          </div>
          <div>
            <p className="brs-label">Rată lunară estimată</p>
            <p className="brs-mid">{assessment.business.loanInstallment > 0 ? ron(assessment.business.loanInstallment) : "—"}</p>
          </div>
          <div>
            <p className="brs-label">Suma solicitată</p>
            <p className="brs-mid">{investment.requestedAmount ? ron(investment.requestedAmount) : "—"}</p>
          </div>
        </div>
      </section>

      <div className="brs-grid2">
        <section>
          <h3>Top 2 bănci recomandate</h3>
          {top2.map((b, i) => (
            <div key={b.id} className="brs-bank">
              <p>
                <strong>
                  {i + 1}. {b.bank}
                </strong>{" "}
                — {b.product}
              </p>
              <p>
                Potrivire {b.matchPct}% · {b.eligible ? "criterii minime îndeplinite" : "eligibilitate condiționată"} · {num(b.rateRangePct[0])}–{num(b.rateRangePct[1])}%/an · {b.maturityLabel} · aport {b.minOwnLabel}
                {b.monthlyCost > 0 ? ` · rată ~${ron(b.monthlyCost)}/lună` : ""}
              </p>
            </div>
          ))}
        </section>
        <section>
          <h3>Plan de acțiune 30–90 de zile</h3>
          <ol>
            {plan.map((p) => (
              <li key={p.id}>
                <strong>{p.horizon} zile:</strong> {p.title}
                {p.impactPoints > 0 ? ` (+${num(p.impactPoints)} pct)` : ""}
              </li>
            ))}
            {plan.length === 0 && <li>Nicio acțiune urgentă identificată.</li>}
          </ol>
        </section>
      </div>
      <p className="brs-foot">Afghankingz Credit · valori bancare orientative 2025–2026 · CNP afișat doar mascat (GDPR) · Decizia de creditare aparține exclusiv băncii.</p>
    </div>
  );
}

/** "Descarcă Raportul pentru Bancă (PDF)": prints only the one-page sheet (Save as PDF in the print dialog). */
export function BankReportPrint({ onBlocked, allowed }: { allowed: boolean; onBlocked: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after hydration
    setMounted(true);
    const off = () => delete document.body.dataset.print;
    window.addEventListener("afterprint", off);
    return () => window.removeEventListener("afterprint", off);
  }, []);
  const print = () => {
    if (!allowed) return onBlocked();
    document.body.dataset.print = "bank";
    window.print();
  };
  return (
    <>
      <Button onClick={print}>
        <FileDown size={15} /> Descarcă Raportul pentru Bancă (PDF)
      </Button>
      {mounted && createPortal(<Sheet />, document.body)}
    </>
  );
}
