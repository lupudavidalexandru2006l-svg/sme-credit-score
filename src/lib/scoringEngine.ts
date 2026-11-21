/**
 * Pure scoring functions. No I/O, no React, no Next.js — easy to unit test
 * and reuse server-side (e.g. inside a Supabase edge function later).
 *
 * Only type imports here (relative path) so `node --test` can run this file
 * directly with Node's built-in TypeScript stripping.
 */
import type {
  ClientShareBucket,
  CourtCase,
  EFacturaGroundTruth,
  FinalScoreResult,
  InvestmentEvaluation,
  InvestmentInput,
  InvestmentPurpose,
  LegalCheckResult,
  PaymentTermBucket,
  QuestionFeedback,
  QuizAnswers,
  QuizEvaluation,
  ScoreStatus,
} from "../types/scoring";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

export const PAYMENT_TERM_BUCKETS: { value: PaymentTermBucket; label: string }[] = [
  { value: "0-7", label: "0-7 zile" },
  { value: "15", label: "15 zile" },
  { value: "30", label: "30 zile" },
  { value: "45+", label: "45+ zile" },
];

export const CLIENT_SHARE_BUCKETS: { value: ClientShareBucket; label: string }[] = [
  { value: "<15", label: "sub 15%" },
  { value: "15-30", label: "15-30%" },
  { value: "30-50", label: "30-50%" },
  { value: ">50", label: "peste 50%" },
];

export const INVESTMENT_PURPOSES: {
  value: InvestmentPurpose;
  label: string;
  hint: string;
  points: number;
}[] = [
  { value: "growth", label: "Creștere / eficiență măsurabilă", hint: "Utilaje, echipamente, tehnologie", points: 50 },
  { value: "working_capital", label: "Capital de lucru", hint: "Contracte ferme sau stocuri sezoniere", points: 35 },
  { value: "marketing", label: "Marketing și digitalizare", hint: "Campanii, software, reamenajare spațiu", points: 25 },
  { value: "refinancing", label: "Refinanțare / lichiditate", hint: "Datorii existente sau goluri de cash", points: 10 },
];

/** Significant storno threshold (% of total issued). */
export const CREDIT_NOTE_THRESHOLD_PCT = 5;
/** Neutral score used when portal.just.ro is unreachable. */
export const FALLBACK_LEGAL_SCORE = 80;
export const QUIZ_CONTROL_THRESHOLD = 35;
export const QUIZ_CONTROL_PENALTY = 10;
export const INTEGRITY_CAP = 35;

export const round1 = (n: number) => Math.round(n * 10) / 10;

const ron = (n: number) =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n)} RON`;
const pct = (n: number) =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(n)}%`;

export function paymentTermToBucket(days: number): PaymentTermBucket {
  if (days <= 10) return "0-7";
  if (days <= 22) return "15";
  if (days <= 37) return "30";
  return "45+";
}

export function clientShareToBucket(sharePct: number): ClientShareBucket {
  if (sharePct < 15) return "<15";
  if (sharePct <= 30) return "15-30";
  if (sharePct <= 50) return "30-50";
  return ">50";
}

export function rankSuppliers(truth: EFacturaGroundTruth) {
  return [...truth.topSuppliers].sort((a, b) => b.purchaseValue - a.purchaseValue);
}

const labelOf = <T extends string>(list: { value: T; label: string }[], v: T | null) =>
  v === null ? "—" : (list.find((x) => x.value === v)?.label ?? v);

const indexOf = <T extends string>(list: { value: T }[], v: T) =>
  list.findIndex((x) => x.value === v);

// ---------------------------------------------------------------------------
// Quiz 1 — Financial knowledge (0-100)
// ---------------------------------------------------------------------------

export function scoreRevenueEstimate(estimate: number | null, actual: number) {
  if (estimate === null || !Number.isFinite(estimate) || actual <= 0) {
    return { points: 0, relativeError: null as number | null };
  }
  const relativeError = Math.abs(estimate - actual) / actual;
  // Compare on a rounded basis to avoid float noise exactly at thresholds.
  const e = Math.round(relativeError * 1e6) / 1e6;
  const points = e <= 0.1 ? 35 : e <= 0.2 ? 24 : e <= 0.35 ? 10 : 0;
  return { points, relativeError };
}

function scoreBucketDistance(distance: number, exact: number, neighbour: number) {
  if (distance === 0) return exact;
  if (distance === 1) return neighbour;
  return 0;
}

export function evaluateFinancialQuiz(
  answers: QuizAnswers,
  groundTruth: EFacturaGroundTruth,
): QuizEvaluation {
  const items: QuestionFeedback[] = [];

  // Q1 — revenue last 3 months (max 35)
  const actualRev = groundTruth.revenueLast3MonthsNoVat;
  const q1 = scoreRevenueEstimate(answers.revenueEstimate, actualRev);
  items.push({
    id: "revenue",
    question: "Cifra de afaceri facturată în ultimele 3 luni (fără TVA)",
    userAnswer: answers.revenueEstimate === null ? "—" : ron(answers.revenueEstimate),
    truthAnswer: ron(actualRev),
    detail:
      q1.relativeError === null
        ? "Nicio estimare validă."
        : `Ai estimat ${ron(answers.revenueEstimate!)} vs. ${ron(actualRev)} în e-Factura — abatere ${pct(q1.relativeError * 100)}`,
    points: q1.points,
    maxPoints: 35,
  });

  // Q2 — average payment term (max 25)
  const truthTerm = paymentTermToBucket(groundTruth.avgPaymentTermDays);
  let q2 = 0;
  let q2Detail = "Niciun răspuns.";
  if (answers.paymentTerm) {
    const d = Math.abs(
      indexOf(PAYMENT_TERM_BUCKETS, answers.paymentTerm) - indexOf(PAYMENT_TERM_BUCKETS, truthTerm),
    );
    q2 = scoreBucketDistance(d, 25, 12);
    q2Detail =
      d === 0
        ? `Potrivire exactă — termen mediu real ${groundTruth.avgPaymentTermDays} zile`
        : `${d === 1 ? "Interval vecin" : `La ${d} intervale distanță`} — termen mediu real ${groundTruth.avgPaymentTermDays} zile`;
  }
  items.push({
    id: "paymentTerm",
    question: "Termenul mediu de plată oferit clienților",
    userAnswer: labelOf(PAYMENT_TERM_BUCKETS, answers.paymentTerm),
    truthAnswer: labelOf(PAYMENT_TERM_BUCKETS, truthTerm),
    detail: q2Detail,
    points: q2,
    maxPoints: 25,
  });

  // Q3 — top client share (max 20)
  const truthShare = clientShareToBucket(groundTruth.topClientSharePct);
  let q3 = 0;
  let q3Detail = "Niciun răspuns.";
  if (answers.topClientShare) {
    const d = Math.abs(
      indexOf(CLIENT_SHARE_BUCKETS, answers.topClientShare) - indexOf(CLIENT_SHARE_BUCKETS, truthShare),
    );
    q3 = scoreBucketDistance(d, 20, 10);
    q3Detail = `${d === 0 ? "Potrivire exactă" : d === 1 ? "Prag vecin" : `La ${d} praguri distanță`} — ${groundTruth.topClientName} are ${pct(groundTruth.topClientSharePct)} din vânzări`;
  }
  items.push({
    id: "topClientShare",
    question: "Ponderea celui mai mare client în totalul vânzărilor",
    userAnswer: labelOf(CLIENT_SHARE_BUCKETS, answers.topClientShare),
    truthAnswer: labelOf(CLIENT_SHARE_BUCKETS, truthShare),
    detail: q3Detail,
    points: q3,
    maxPoints: 20,
  });

  // Q4 — main supplier (max 12)
  const ranked = rankSuppliers(groundTruth);
  const rank = answers.mainSupplier ? ranked.findIndex((s) => s.name === answers.mainSupplier) : -1;
  const q4 = rank === 0 ? 12 : rank === 1 || rank === 2 ? 6 : 0;
  items.push({
    id: "mainSupplier",
    question: "Principalul furnizor după valoarea achizițiilor",
    userAnswer: answers.mainSupplier ?? "—",
    truthAnswer: ranked[0]?.name ?? "—",
    detail:
      rank === 0
        ? `Corect — ${ron(ranked[0].purchaseValue)} achiziții`
        : rank > 0
          ? `Furnizorul ales este #${rank + 1} în e-Factura (${ron(ranked[rank].purchaseValue)})`
          : answers.mainSupplier
            ? "Acest nume nu apare în top furnizori e-Factura"
            : "Niciun răspuns.",
    points: q4,
    maxPoints: 12,
  });

  // Q5 — significant credit notes (max 8)
  const truthStorno = groundTruth.creditNotesSharePct > CREDIT_NOTE_THRESHOLD_PCT;
  const q5 = answers.hasSignificantCreditNotes === truthStorno ? 8 : 0;
  items.push({
    id: "creditNotes",
    question: "Facturi stornate semnificative (>5%, cod 381) în ultimele 3 luni",
    userAnswer:
      answers.hasSignificantCreditNotes === null ? "—" : answers.hasSignificantCreditNotes ? "Da" : "Nu",
    truthAnswer: truthStorno ? "Da" : "Nu",
    detail: `Stornările reprezintă ${pct(groundTruth.creditNotesSharePct)} din totalul emis`,
    points: q5,
    maxPoints: 8,
  });

  return {
    total: items.reduce((s, i) => s + i.points, 0),
    items,
    evaluatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Quiz 2 — Investment purpose (0-100)
// ---------------------------------------------------------------------------

export function evaluateInvestment(
  input: InvestmentInput,
  annualizedRevenue: number,
): InvestmentEvaluation {
  const items: QuestionFeedback[] = [];

  const purpose = INVESTMENT_PURPOSES.find((p) => p.value === input.purpose);
  items.push({
    id: "purpose",
    question: "Destinația principală a finanțării",
    userAnswer: purpose?.label ?? "—",
    truthAnswer: "Creștere / eficiență măsurabilă",
    detail: purpose ? purpose.hint : "Niciun răspuns.",
    points: purpose?.points ?? 0,
    maxPoints: 50,
  });

  const own = input.ownContributionPct;
  const q2 = own === null ? 0 : own > 20 ? 30 : own >= 10 ? 20 : 5;
  items.push({
    id: "ownContribution",
    question: "Aportul propriu / avans",
    userAnswer: own === null ? "—" : pct(own),
    truthAnswer: "peste 20%",
    detail: own === null ? "Niciun răspuns." : own > 20 ? "Implicare puternică a acționarilor" : own >= 10 ? "Aport moderat (10-20%)" : "Aport sub 10% — risc transferat integral băncii",
    points: q2,
    maxPoints: 30,
  });

  const amount = input.requestedAmount ?? 0;
  const ratio = annualizedRevenue > 0 ? amount / annualizedRevenue : Number.POSITIVE_INFINITY;
  const r = Math.round(ratio * 1e6) / 1e6;
  const q3 = amount > 0 && r <= 0.25 ? 20 : amount > 0 && r <= 0.5 ? 12 : 0;
  const overLeveragedRequest = amount > 0 && r > 0.5;
  items.push({
    id: "leverage",
    question: "Suma solicitată vs. cifra de afaceri anualizată",
    userAnswer: input.requestedAmount === null ? "—" : ron(amount),
    truthAnswer: `max. 25% = ${ron(annualizedRevenue * 0.25)}`,
    detail:
      amount > 0 && Number.isFinite(ratio)
        ? `${ron(amount)} reprezintă ${pct(ratio * 100)} din CA anualizată (${ron(annualizedRevenue)})${overLeveragedRequest ? " — cerere supra-îndatorată" : ""}`
        : "Sumă invalidă.",
    points: q3,
    maxPoints: 20,
  });

  return {
    total: items.reduce((s, i) => s + i.points, 0),
    items,
    leverageRatio: ratio,
    overLeveragedRequest,
  };
}

// ---------------------------------------------------------------------------
// Legal check — portal.just.ro (0-100)
// ---------------------------------------------------------------------------

export const CRITICAL_KEYWORDS = [
  "insolven",
  "faliment",
  "executare silit",
  "penal",
  "evaziune",
  "inselaciune",
  "atragere raspundere",
];

/** Lowercase + strip diacritics (ă, â, î, ș/ş, ț/ţ). */
export function normalizeRo(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function detectCriticalKeywords(...fields: string[]) {
  const haystack = normalizeRo(fields.join(" | "));
  return CRITICAL_KEYWORDS.filter((k) => haystack.includes(k));
}

export function scoreLegalCases(cases: Pick<CourtCase, "isCritical">[]) {
  const criticalCount = cases.filter((c) => c.isCritical).length;
  if (criticalCount > 0) return { legalScore: 0, integrityKillSwitch: true, criticalCount };
  if (cases.length === 0) return { legalScore: 100, integrityKillSwitch: false, criticalCount };
  if (cases.length <= 2) return { legalScore: 80, integrityKillSwitch: false, criticalCount };
  return { legalScore: 50, integrityKillSwitch: false, criticalCount };
}

// ---------------------------------------------------------------------------
// Final score (0-100)
// ---------------------------------------------------------------------------

export function statusForScore(score: number): ScoreStatus {
  if (score >= 80) return "Bank-Ready";
  if (score >= 60) return "Pregătit cu rezerve";
  if (score >= 40) return "Necesită optimizare";
  return "High Risk";
}

export function calculateFinalScore(
  sBusiness: number,
  frozenQuizScore: number,
  legalResult: Pick<LegalCheckResult, "legalScore" | "integrityKillSwitch">,
  investmentScore: number,
): FinalScoreResult {
  const businessPoints = 0.7 * sBusiness;
  const quizPoints = 0.075 * frozenQuizScore;
  const legalPoints = 0.075 * legalResult.legalScore;
  const humanScore = 0.5 * frozenQuizScore + 0.5 * legalResult.legalScore;
  const investmentPoints = 0.15 * investmentScore;

  const rawScore = businessPoints + quizPoints + legalPoints + investmentPoints;
  let score = rawScore;
  const warnings: string[] = [];

  const quizControlPenaltyApplied = frozenQuizScore < QUIZ_CONTROL_THRESHOLD;
  if (quizControlPenaltyApplied) {
    score = Math.max(0, score - QUIZ_CONTROL_PENALTY);
    warnings.push(
      `Avertisment de guvernanță: scorul la Quiz-ul financiar (${frozenQuizScore}/100) este sub ${QUIZ_CONTROL_THRESHOLD}. Conducerea nu cunoaște indicatorii de bază ai firmei — penalizare -${QUIZ_CONTROL_PENALTY} puncte.`,
    );
  }

  const integrityCapApplied = legalResult.integrityKillSwitch && score > INTEGRITY_CAP;
  if (legalResult.integrityKillSwitch) {
    score = Math.min(score, INTEGRITY_CAP);
    warnings.push(
      `Integrity Kill-Switch: portal.just.ro a returnat dosare cu risc critic. Scorul final este plafonat la ${INTEGRITY_CAP}/100.`,
    );
  }

  const finalScore = round1(score);
  return {
    finalScore,
    rawScore: round1(rawScore),
    status: statusForScore(finalScore),
    pillars: {
      business: { score: round1(sBusiness), points: round1(businessPoints), maxPoints: 70 },
      human: {
        score: round1(humanScore),
        points: round1(quizPoints + legalPoints),
        maxPoints: 15,
        quizPoints: round1(quizPoints),
        legalPoints: round1(legalPoints),
      },
      investment: { score: round1(investmentScore), points: round1(investmentPoints), maxPoints: 15 },
    },
    quizControlPenaltyApplied,
    integrityCapApplied,
    warnings,
  };
}
