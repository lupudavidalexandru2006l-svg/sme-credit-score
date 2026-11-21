/**
 * One entry point that turns raw inputs (invoices, quiz answers, investment form,
 * legal check) into the full Credit Ready profile. Used by the UI on every change
 * and by API routes, so the score is always computed the same way.
 */
import type {
  ActionItem,
  BenchmarkResult,
  BusinessMetrics,
  BusinessScore,
  Company,
  FinalScoreResult,
  InvestmentEvaluation,
  InvestmentInput,
  Invoice,
  LegalCheckResult,
  QuizAnswers,
  QuizEvaluation,
  ScoreDriver,
} from "../types/scoring";
import { findSector } from "./data/benchmarks.ts";
import { computeMetrics } from "./metrics.ts";
import {
  calculateFinalScore,
  computeBenchmark,
  computeBusinessScore,
  CREDIT_NOTE_THRESHOLD_PCT,
  evaluateFinancialQuiz,
  evaluateInvestment,
  FALLBACK_LEGAL_SCORE,
  quizTruthFromMetrics,
} from "./scoringEngine.ts";
import { num, pct, ron, round1 } from "./util.ts";

export interface AssessmentInput {
  company: Company;
  invoices: Invoice[];
  quiz: QuizAnswers;
  investment: InvestmentInput;
  legal: LegalCheckResult | null;
}

export interface Assessment {
  metrics: BusinessMetrics;
  business: BusinessScore;
  quiz: QuizEvaluation;
  investment: InvestmentEvaluation;
  benchmark: BenchmarkResult;
  legalScore: number;
  legalPending: boolean;
  final: FinalScoreResult;
  drivers: ScoreDriver[];
  plan: ActionItem[];
}

export function computeAssessment(input: AssessmentInput): Assessment {
  const metrics = computeMetrics(input.invoices, input.company);
  const business = computeBusinessScore(metrics, input.company, input.investment.requestedAmount);
  const quiz = evaluateFinancialQuiz(input.quiz, quizTruthFromMetrics(metrics));
  const investment = evaluateInvestment(input.investment, metrics.annualizedRevenue);
  const benchmark = computeBenchmark(metrics, findSector(input.company.caenCode));
  const legalPending = input.legal === null;
  const legalScore = input.legal?.legalScore ?? FALLBACK_LEGAL_SCORE;

  const final = calculateFinalScore({
    sBusiness: business.score,
    quizScore: quiz.total,
    legalScore,
    investmentFormScore: investment.total,
    benchmarkScore: benchmark.score,
  });
  if (input.legal?.integrityKillSwitch) {
    final.warnings.push("Alertă de integritate: portal.just.ro a returnat cel puțin un dosar critic (insolvență / infracțiune economică). Scorul legal este 0.");
  }
  if (investment.overLeveragedRequest) {
    final.warnings.push(`Alertă de supraîndatorare: suma cerută reprezintă ${pct(investment.leverageRatio * 100)} din cifra de afaceri anualizată (peste 50%).`);
  }

  const a = { metrics, business, quiz, investment, benchmark, legalScore, legalPending, final };
  return { ...a, drivers: computeDrivers(a, input), plan: buildActionPlan(a, input) };
}

type Core = Omit<Assessment, "drivers" | "plan">;

// ---------------------------------------------------------------------------
// What pulls the score down: points of the FINAL score lost on each factor
// ---------------------------------------------------------------------------

function computeDrivers(a: Core, input: AssessmentInput): ScoreDriver[] {
  const drivers: ScoreDriver[] = a.business.items.map((i) => ({
    id: i.id,
    label: i.label,
    pillar: "Business",
    lostPoints: round1((100 - i.score) * i.weight * 0.7),
    detail: i.value,
  }));
  drivers.push({
    id: "quiz",
    label: "Cunoașterea cifrelor (Quiz)",
    pillar: "Factor uman",
    lostPoints: round1((100 - a.quiz.total) * 0.075 + (a.final.quizKillSwitch ? 10 : 0)),
    detail: `${a.quiz.total}/100 · ${a.quiz.levelLabel}${a.final.quizKillSwitch ? " · kill-switch -10 p" : ""}`,
  });
  drivers.push({
    id: "legal",
    label: "Verificare portal.just.ro",
    pillar: "Factor uman",
    lostPoints: round1((100 - a.legalScore) * 0.075),
    detail: input.legal ? `${a.legalScore}/100 · ${input.legal.totalFound} dosare relevante` : "neverificat — punctaj neutru provizoriu",
  });
  drivers.push({
    id: "investment",
    label: "Calitatea cererii de finanțare",
    pillar: "Investiție",
    lostPoints: round1((100 - a.investment.total) * 0.075),
    detail: `${a.investment.total}/100 · sumă = ${pct(a.investment.leverageRatio * 100)} din CA anualizată`,
  });
  drivers.push({
    id: "benchmark",
    label: "Poziționare față de sector",
    pillar: "Investiție",
    lostPoints: round1((100 - a.benchmark.score) * 0.075),
    detail: `${a.benchmark.score}/100 vs. mediana CAEN ${a.benchmark.sector.caenCode}`,
  });
  return drivers.filter((d) => d.lostPoints >= 0.5).sort((x, y) => y.lostPoints - x.lostPoints);
}

// ---------------------------------------------------------------------------
// 30-90 day action plan, generated from detected weaknesses
// ---------------------------------------------------------------------------

const PRIORITY_RANK = { critică: 0, ridicată: 1, medie: 2 } as const;

function buildActionPlan(a: Core, input: AssessmentInput): ActionItem[] {
  const m = a.metrics;
  const sub = Object.fromEntries(a.business.items.map((i) => [i.id, i]));
  /** Final-score points recovered if the sub-score regains `share` of what it lost. */
  const gain = (id: keyof typeof sub, share: number) => round1((100 - sub[id].score) * sub[id].weight * 0.7 * share);
  const actions: ActionItem[] = [];

  if (a.final.quizKillSwitch || a.quiz.total < 60) {
    actions.push({
      id: "quiz",
      title: "Instituie o rutină lunară de control financiar",
      why: `Quiz-ul financiar are ${a.quiz.total}/100 (${a.quiz.levelLabel}). Banca verifică dacă managementul își cunoaște cifrele.`,
      steps: [
        "Programează în prima zi lucrătoare a lunii o revizie de 30 de minute cu contabilul: vânzări, încasări, top 5 clienți.",
        "Exportă lunar raportul e-Factura din SPV și compară-l cu extrasele bancare.",
        "Refă quiz-ul după 30 de zile pentru a reconfirma controlul financiar.",
      ],
      horizon: 30,
      priority: a.final.quizKillSwitch ? "critică" : "ridicată",
      impactPoints: round1((60 - a.quiz.total) * 0.075 + (a.final.quizKillSwitch ? 10 : 0)),
    });
  }

  if (a.investment.overLeveragedRequest) {
    const target = m.annualizedRevenue * 0.25;
    actions.push({
      id: "amount",
      title: "Redimensionează sau etapizează suma solicitată",
      why: `Suma cerută (${ron(input.investment.requestedAmount ?? 0)}) depășește 50% din CA anualizată (${ron(m.annualizedRevenue)}).`,
      steps: [
        `Împarte investiția în etape; prima tranșă recomandată: max. ${ron(target)} (25% din CA).`,
        "Analizează leasing pentru echipamente în locul creditului clasic.",
        "Atașează la cerere un buget pe etape cu venituri suplimentare estimate.",
      ],
      horizon: 30,
      priority: "critică",
      impactPoints: round1(20 * 0.075 + gain("repayment", 0.5)),
    });
  }

  if (input.legal?.integrityKillSwitch || (input.legal && input.legal.legalScore < 80)) {
    actions.push({
      id: "legal",
      title: "Clarifică dosarele din portal.just.ro",
      why: `Verificarea juridică are ${input.legal.legalScore}/100 (${input.legal.totalFound} dosare relevante).`,
      steps: [
        "Pregătește pentru bancă o notă explicativă pe fiecare dosar activ (stadiu, sumă, provizion).",
        "Închide prin tranzacție litigiile comerciale mici, unde e posibil.",
        "Obține certificat de atestare fiscală (ANAF) fără datorii restante.",
      ],
      horizon: 60,
      priority: input.legal.integrityKillSwitch ? "critică" : "ridicată",
      impactPoints: round1((100 - input.legal.legalScore) * 0.075 * 0.6),
    });
  }

  if (m.topClientSharePct > 30) {
    actions.push({
      id: "concentration",
      title: "Diversifică portofoliul de clienți",
      why: `${m.topClients[0]?.name} generează ${pct(m.topClientSharePct)} din vânzări${m.topClientSharePct > 50 ? " — dependență critică" : ""}.`,
      steps: [
        "Țintește 3 clienți noi din același segment (HoReCa / retail regional) în următoarele 90 de zile.",
        "Semnează contract-cadru cu clientul principal (volume minime, termen 12 luni) ca să reduci riscul de pierdere bruscă.",
        `Obiectiv: clientul #1 sub 30% din vânzări (acum ${pct(m.topClientSharePct)}).`,
      ],
      horizon: 90,
      priority: m.topClientSharePct > 50 ? "critică" : "ridicată",
      impactPoints: gain("concentration", 0.5),
    });
  }

  if (m.dsoDays > 45 || m.lateSharePct > 15 || m.overdueAmount > 0) {
    actions.push({
      id: "collections",
      title: "Accelerează încasările și recuperează restanțele",
      why: `DSO ${num(m.dsoDays)} zile, ${pct(m.lateSharePct)} din valoare încasată cu întârziere, ${ron(m.overdueAmount)} restante la ${m.asOf}.`,
      steps: [
        "Trimite remindere automate la scadență, +7 și +15 zile; oprește livrările la clienții cu restanțe > 30 zile.",
        "Oferă 1–2% discount pentru plata în 7 zile clienților mari.",
        m.overdueAmount > 0 ? "Negociază un grafic de plată pentru restanțele existente sau cedează creanțele (factoring)." : "Evaluează factoringul pentru facturile cu termen de 45+ zile.",
      ],
      horizon: m.dsoDays > 45 ? 30 : 60,
      priority: m.dsoDays > 45 ? "ridicată" : "medie",
      impactPoints: gain("payments", 0.5),
    });
  }

  if (a.business.dscr < 1.2) {
    actions.push({
      id: "dscr",
      title: "Crește marja de acoperire a ratelor (DSCR)",
      why: `DSCR estimat ${num(a.business.dscr)}× — sub pragul uzual de 1,2× cerut de bănci.`,
      steps: [
        "Cere o perioadă de grație sau o maturitate mai lungă pentru creditul nou.",
        "Renegociază prețurile cu furnizorii principali pentru +1–2 pp marjă.",
        "Amână cheltuielile fixe neesențiale până după aprobare.",
      ],
      horizon: 60,
      priority: a.business.dscr < 1 ? "critică" : "ridicată",
      impactPoints: gain("repayment", 0.5),
    });
  }

  if (m.creditNotesSharePct3m > CREDIT_NOTE_THRESHOLD_PCT) {
    actions.push({
      id: "storno",
      title: "Redu stornările (facturi 381)",
      why: `Stornările reprezintă ${pct(m.creditNotesSharePct3m)} din facturare în ultimele 3 luni (prag: 5%).`,
      steps: [
        "Identifică primele 3 cauze de retur (calitate, erori de comandă, preț) și asignează un responsabil.",
        "Verifică comenzile mari înainte de facturare (dublă confirmare).",
      ],
      horizon: 60,
      priority: "medie",
      impactPoints: round1((a.benchmark.items.find((i) => i.id === "storno")?.score ?? 100) < 60 ? 1.5 : 0.8),
    });
  }

  if (m.seasonalityRatio > 1.6 || m.revenueCv > 0.2) {
    actions.push({
      id: "seasonality",
      title: "Pregătește lunile slabe: buffer de lichiditate",
      why: `Vânzările variază de ${num(m.seasonalityRatio)}× între luna de vârf și cea mai slabă.`,
      steps: [
        "Constituie o rezervă de cash egală cu 1 lună de cheltuieli fixe înainte de lunile slabe.",
        "Solicită o linie de capital de lucru sezonieră în locul acoperirii din cash-ul curent.",
      ],
      horizon: 90,
      priority: "medie",
      impactPoints: round1(gain("seasonality", 0.3) + gain("stability", 0.3)),
    });
  }

  if ((input.investment.ownContributionPct ?? 0) < 10) {
    actions.push({
      id: "own",
      title: "Mărește aportul propriu la minimum 10–20%",
      why: "Un avans sub 10% transferă aproape tot riscul către bancă.",
      steps: ["Planifică reținerea profitului din următoarele luni pentru avans.", "Verifică eligibilitatea pentru garanții FNGCIMM / programe de stat."],
      horizon: 60,
      priority: "medie",
      impactPoints: round1(15 * 0.075),
    });
  }

  if (input.investment.purpose === "refinancing") {
    actions.push({
      id: "purpose",
      title: "Reformulează cererea către o investiție productivă",
      why: "Refinanțarea sau acoperirea golurilor de lichiditate primește cel mai mic punctaj la destinație.",
      steps: ["Leagă finanțarea de un proiect măsurabil (echipament, capacitate nouă) cu venituri estimate."],
      horizon: 30,
      priority: "medie",
      impactPoints: round1(40 * 0.075),
    });
  }

  // Always useful when few weaknesses were detected.
  const fillers: ActionItem[] = [
    {
      id: "dossier",
      title: "Pregătește dosarul de credit",
      why: "Profilul este solid; un dosar complet scurtează analiza băncii.",
      steps: ["Situațiile financiare 2025 depuse, balanța ultimei luni, extrase bancare pe 6 luni.", "Certificat ANAF fără datorii, CI administrator, act constitutiv actualizat."],
      horizon: 30,
      priority: "medie",
      impactPoints: 0,
    },
    {
      id: "spv",
      title: "Sincronizează lunar e-Factura cu platforma",
      why: "Datele la zi mențin scorul actualizat și credibil în fața băncii.",
      steps: ["Încarcă XML-urile din SPV la fiecare închidere de lună.", "Urmărește evoluția scorului înainte de depunerea cererii."],
      horizon: 30,
      priority: "medie",
      impactPoints: 0,
    },
    {
      id: "monitor",
      title: "Monitorizează concentrarea și încasările lunar",
      why: "Doi indicatori care se pot degrada rapid și pe care banca îi urmărește după acordare.",
      steps: ["Alertă internă dacă un client depășește 30% din vânzări sau DSO crește peste 45 de zile."],
      horizon: 60,
      priority: "medie",
      impactPoints: 0,
    },
  ];

  actions.sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || y.impactPoints - x.impactPoints);
  const plan = actions.slice(0, 5);
  for (const f of fillers) if (plan.length < 3) plan.push(f);
  return plan;
}
