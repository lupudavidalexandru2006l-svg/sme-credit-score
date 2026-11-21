/**
 * Domain types for the SME Credit Readiness Score.
 * UI components depend only on these interfaces, never on the data source,
 * so mock data can later be swapped for Supabase / a UBL 2.1 parser.
 */

// ---------------------------------------------------------------------------
// Buckets used by the financial quiz
// ---------------------------------------------------------------------------

export type PaymentTermBucket = "0-7" | "15" | "30" | "45+";
export type ClientShareBucket = "<15" | "15-30" | "30-50" | ">50";

/** UBL 2.1 InvoiceTypeCode: 380 = commercial invoice, 381 = credit note (storno). */
export type InvoiceTypeCode = "380" | "381";

export interface Supplier {
  name: string;
  cui: string;
  /** Total purchase value (RON, no VAT) over the analysed period. */
  purchaseValue: number;
}

export interface EFacturaInvoice {
  id: string;
  issueDate: string; // ISO date
  customerName: string;
  amountNoVat: number;
  invoiceTypeCode: InvoiceTypeCode;
  source: "efactura-sync" | "simulated-upload";
}

// ---------------------------------------------------------------------------
// Ground truth extracted from RO e-Factura
// ---------------------------------------------------------------------------

export interface EFacturaGroundTruth {
  companyId: string;
  companyName: string;
  cui: string;
  caenCode: string;
  caenLabel: string;
  /** Invoiced revenue in the last 3 months, without VAT (RON). */
  revenueLast3MonthsNoVat: number;
  /** Annualised revenue (RON) = last 3 months x 4. */
  annualizedRevenue: number;
  /** Weighted average payment term granted to clients (days). */
  avgPaymentTermDays: number;
  /** Share (%) of the biggest client in total sales. */
  topClientSharePct: number;
  topClientName: string;
  /** Top 5 suppliers by purchase value (any order; engine sorts). */
  topSuppliers: Supplier[];
  /** Plausible names that are NOT real suppliers (quiz traps). */
  decoySuppliers: string[];
  /** Share (%) of credit notes (InvoiceTypeCode 381) in total issued, last 3 months. */
  creditNotesSharePct: number;
  /** Recent invoices (sample + simulated uploads). */
  invoices: EFacturaInvoice[];
}

/** Mock S_Business: 75% own e-Factura metrics + 25% CAEN industry benchmark. */
export interface SBusinessMock {
  /** 0-100. TODO: replace with real metrics engine over e-Factura data. */
  ownMetricsScore: number;
  /** 0-100. TODO: replace with CAEN sector benchmark comparison. */
  industryBenchmarkScore: number;
}

export interface CompanyAssessment {
  groundTruth: EFacturaGroundTruth;
  sBusinessMock: SBusinessMock;
}

// ---------------------------------------------------------------------------
// Quiz 1 - Financial knowledge
// ---------------------------------------------------------------------------

export interface QuizAnswers {
  revenueEstimate: number | null;
  paymentTerm: PaymentTermBucket | null;
  topClientShare: ClientShareBucket | null;
  mainSupplier: string | null;
  hasSignificantCreditNotes: boolean | null;
}

export interface QuestionFeedback {
  id: string;
  question: string;
  userAnswer: string;
  truthAnswer: string;
  detail: string;
  points: number;
  maxPoints: number;
}

export interface QuizEvaluation {
  total: number; // 0-100
  items: QuestionFeedback[];
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Quiz 2 - Investment purpose
// ---------------------------------------------------------------------------

export type InvestmentPurpose =
  | "growth"
  | "working_capital"
  | "marketing"
  | "refinancing";

export interface InvestmentInput {
  purpose: InvestmentPurpose | null;
  ownContributionPct: number | null;
  requestedAmount: number | null;
}

export interface InvestmentEvaluation {
  total: number; // 0-100
  items: QuestionFeedback[];
  leverageRatio: number; // requested / annualized revenue
  overLeveragedRequest: boolean;
}

// ---------------------------------------------------------------------------
// Legal check - portal.just.ro
// ---------------------------------------------------------------------------

export type PortalSimulationScenario = "clean" | "minor" | "many" | "critical";

export interface CourtCase {
  numar: string;
  institutie: string;
  data: string;
  obiect: string;
  categorie: string;
  stadiu: string;
  parti: string[];
  matchedBy: "firma" | "administrator";
  isCritical: boolean;
  matchedKeywords: string[];
}

export interface LegalCheckResult {
  query: { companyName: string; ceoName: string };
  source: "portal.just.ro" | "simulation" | "fallback";
  isFallback: boolean;
  isSimulated: boolean;
  cases: CourtCase[];
  totalFound: number;
  criticalCount: number;
  /** 0-100 legal score. */
  legalScore: number;
  integrityKillSwitch: boolean;
  message: string;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Final score
// ---------------------------------------------------------------------------

export type ScoreStatus =
  | "Bank-Ready"
  | "Pregătit cu rezerve"
  | "Necesită optimizare"
  | "High Risk";

export interface FinalScoreResult {
  finalScore: number; // 0-100 after penalties / caps
  rawScore: number; // before penalties / caps
  status: ScoreStatus;
  pillars: {
    business: { score: number; points: number; maxPoints: 70 };
    human: {
      score: number;
      points: number;
      maxPoints: 15;
      quizPoints: number; // max 7.5
      legalPoints: number; // max 7.5
    };
    investment: { score: number; points: number; maxPoints: 15 };
  };
  quizControlPenaltyApplied: boolean;
  integrityCapApplied: boolean;
  warnings: string[];
}
