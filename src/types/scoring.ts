/**
 * Domain types for the Credit Ready platform.
 * UI components depend only on these interfaces, never on the data source
 * (synthetic generator, Supabase or uploaded UBL 2.1 XML).
 */

// ---------------------------------------------------------------------------
// e-Factura invoices & company
// ---------------------------------------------------------------------------

export type InvoiceDirection = "issued" | "received";
export type InvoiceSource = "synthetic" | "xml-upload" | "supabase";

/** One RO e-Factura document (UBL 2.1 / RO_CIUS). */
export interface Invoice {
  /** Stable key: `${direction}:${supplierCui}:${number}`. */
  id: string;
  number: string;
  direction: InvoiceDirection;
  /** UBL InvoiceTypeCode / CreditNoteTypeCode: 380 = factură, 381 = storno (credit note). */
  typeCode: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string | null;
  supplierName: string;
  supplierCui: string;
  customerName: string;
  customerCui: string;
  /** TaxExclusiveAmount as in the document (RON). A 381 is a storno; a negative amount on a 380 is treated as storno too. */
  taxExclusiveAmount: number;
  /** PayableAmount (with VAT) as in the document (RON). */
  payableAmount: number;
  currency: string;
  /** Collection date. Not part of e-Factura: synthetic bank data; null = unpaid / unknown. */
  paidDate: string | null;
  source: InvoiceSource;
}

export interface Company {
  id: string;
  name: string;
  cui: string;
  caenCode: string;
  ceoName: string;
  city: string;
  /** Salaries, rent, utilities, fuel... per month (RON). Synthetic accounting data. */
  monthlyFixedCosts: number;
  /** Existing loans and leasing installments per month (RON). */
  existingMonthlyDebtService: number;
}

export interface Dataset {
  source: "supabase" | "synthetic-local";
  company: Company;
  invoices: Invoice[];
}

// ---------------------------------------------------------------------------
// Business metrics computed from invoices
// ---------------------------------------------------------------------------

export interface MonthPoint {
  month: string; // YYYY-MM
  revenue: number; // net of storno, no VAT
  uploadedRevenue: number; // part of revenue coming from uploaded XML
  purchases: number;
  netCashFlow: number; // revenue - purchases - fixed costs - existing debt service
}

export interface PartyShare {
  name: string;
  cui: string;
  value: number;
  sharePct: number;
}

export interface BusinessMetrics {
  months: MonthPoint[];
  asOf: string;
  revenue12m: number;
  revenueLast3Months: number;
  annualizedRevenue: number; // monthly average x 12
  avgMonthlyRevenue: number;
  avgMonthlyPurchases: number;
  revenueCv: number; // coefficient of variation of monthly revenue
  seasonalityRatio: number; // best month / weakest month
  peakMonth: string;
  troughMonth: string;
  dsoDays: number; // amount-weighted days from issue to collection
  avgPaymentTermDays: number; // amount-weighted (due - issue)
  lateSharePct: number; // % of value collected >5 days late or overdue
  lateCount: number;
  overdueAmount: number;
  topClients: PartyShare[];
  topClientSharePct: number;
  topSuppliers: PartyShare[];
  creditNotesSharePct3m: number; // storno value / issued value, last 3 months
  creditNotesSharePct12m: number;
  grossMarginPct: number;
  operatingCashFlow: number; // monthly avg, before any debt service
  avgMonthlyNetCashFlow: number; // monthly avg, after existing debt service
  issuedCount: number;
  receivedCount: number;
  uploadedCount: number;
}

export interface SubScore {
  id: "stability" | "payments" | "seasonality" | "concentration" | "repayment";
  label: string;
  weight: number; // within S_Business, sums to 1
  score: number; // 0-100
  value: string; // human-readable metric
  rule: string; // transparent formula
}

export interface BusinessScore {
  score: number;
  items: SubScore[];
  loanInstallment: number;
  dscr: number;
}

// ---------------------------------------------------------------------------
// Sector benchmark
// ---------------------------------------------------------------------------

export interface SectorBenchmark {
  caenCode: string;
  label: string;
  companies: number;
  /** For each indicator: [25th percentile, median, 75th percentile]. */
  dsoDays: [number, number, number];
  topClientSharePct: [number, number, number];
  creditNotesPct: [number, number, number];
  seasonalityRatio: [number, number, number];
  grossMarginPct: [number, number, number];
}

export interface BenchmarkItem {
  id: string;
  label: string;
  unit: string;
  company: number;
  p25: number;
  median: number;
  p75: number;
  higherIsBetter: boolean;
  score: number;
  verdict: "mai bun" | "la nivel" | "mai slab";
}

export interface BenchmarkResult {
  sector: SectorBenchmark;
  items: BenchmarkItem[];
  score: number;
}

// ---------------------------------------------------------------------------
// Quiz - Financial knowledge
// ---------------------------------------------------------------------------

export type PaymentTermBucket = "0-7" | "15" | "30" | "45+";
export type ClientShareBucket = "<15" | "15-30" | "30-50" | ">50";

/** Ground truth the quiz is validated against (derived live from BusinessMetrics). */
export interface QuizGroundTruth {
  revenueLast3MonthsNoVat: number;
  avgPaymentTermDays: number;
  topClientSharePct: number;
  topClientName: string;
  topSuppliers: { name: string; cui: string; purchaseValue: number }[];
  creditNotesSharePct: number;
}

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

export type QuizLevel = "ridicat" | "bun" | "partial" | "deconectat";

export interface QuizEvaluation {
  total: number; // 0-100
  items: QuestionFeedback[];
  answered: number; // 0-5
  level: QuizLevel;
  levelLabel: string;
  flags: string[];
}

// ---------------------------------------------------------------------------
// Investment purpose
// ---------------------------------------------------------------------------

export type InvestmentPurpose = "growth" | "working_capital" | "marketing" | "refinancing";

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

/** What the case is about, derived from categorie + obiect. */
export type CaseKind =
  | "insolventa"
  | "penal_economic"
  | "penal_grav"
  | "penal_usor"
  | "penal_procedural"
  | "contraventie"
  | "executare"
  | "civil_comercial"
  | "fiscal"
  | "munca"
  | "familie_patrimoniu"
  | "altele";

/** How the case ended (or not) for the searched party. */
export type CaseOutcome =
  | "in_curs"
  | "condamnat"
  | "vinovat_fara_pedeapsa" // renunțare la aplicarea pedepsei / amânarea aplicării pedepsei
  | "incetat" // prescripție, împăcare, retragerea plângerii
  | "achitat"
  | "clasat"
  | "sanctiune_mentinuta" // contravenție: plângere respinsă
  | "sanctiune_anulata" // contravenție: plângere admisă
  | "avertisment"
  | "pierdut"
  | "castigat"
  | "inchis_fara_fond" // renunțare, perimare, anulare, declinare
  | "necunoscut";

/** 0 = fără impact, 1 = minor, 2 = moderat, 3 = grav, 4 = critic. */
export type SeverityLevel = 0 | 1 | 2 | 3 | 4;

/** One court hearing as returned by portal.just.ro. */
export interface CourtHearing {
  data: string; // ISO date
  solutie: string;
  solutieSumar: string;
  documentSedinta: string;
}

/**
 * How the searched party is involved in a case:
 *  - "vizat":      the case targets them (Debitor, Inculpat, Pârât, Suspect...)
 *  - "nevizat":    they are on the other side (Creditor, Reclamant, Parte vătămată...)
 *  - "necunoscut": role missing or ambiguous (Intimat, Petent, Apelant...) — treated conservatively
 */
export type PartyRoleCategory = "vizat" | "nevizat" | "necunoscut";

export interface CourtCase {
  numar: string;
  institutie: string;
  data: string;
  obiect: string;
  categorie: string;
  stadiu: string;
  parti: string[];
  matchedBy: "firma" | "administrator";
  /** calitateParte of every party matching the searched name (e.g. ["Debitor"]). */
  partyRoles: string[];
  roleCategory: PartyRoleCategory;
  /** Critical = severity level 4 (legal score drops to 0). */
  isCritical: boolean;
  kind: CaseKind;
  kindLabel: string;
  outcome: CaseOutcome;
  outcomeLabel: string;
  /** true = hotărâre definitivă, false = se poate ataca, null = necunoscut / în curs. */
  isFinal: boolean | null;
  /** Date of the hearing the outcome was read from (ISO). */
  decisionDate: string;
  /** Next scheduled hearing, if any (ISO). */
  nextHearing: string;
  /** Part of the court's ruling that concerns the searched party. */
  verdictExcerpt: string;
  severity: SeverityLevel;
  severityLabel: string;
  /** Points subtracted from the 100-point legal score for this case. */
  deduction: number;
  /** Step-by-step explanation of the level and deduction. */
  reasons: string[];
}

export interface LegalCheckResult {
  query: { companyName: string; ceoName: string };
  source: "portal.just.ro" | "simulation" | "fallback";
  isFallback: boolean;
  isSimulated: boolean;
  cases: CourtCase[];
  totalFound: number;
  /** Cases the portal returned where no party had exactly the searched name. */
  excludedCount: number;
  criticalCount: number;
  /** Sum of deductions before flooring at 0. */
  totalDeduction: number;
  /** True when the cap on minor (level 1) deductions kicked in. */
  minorCapApplied: boolean;
  /** 0-100 legal score. */
  legalScore: number;
  /** At least one critical (level 4) case: legal score forced to 0 and a red alert is shown. */
  integrityKillSwitch: boolean;
  message: string;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Final score & action plan
// ---------------------------------------------------------------------------

export type ScoreStatus = "Bank-Ready" | "Pregătit cu rezerve" | "Necesită optimizare" | "Risc ridicat";

export interface FinalScoreResult {
  finalScore: number; // 0-100 after kill-switch
  rawScore: number;
  status: ScoreStatus;
  pillars: {
    business: { score: number; points: number; maxPoints: 70 };
    human: { score: number; points: number; maxPoints: 15; quizScore: number; legalScore: number };
    investment: { score: number; points: number; maxPoints: 15; formScore: number; benchmarkScore: number };
  };
  quizKillSwitch: boolean;
  warnings: string[];
}

export interface ScoreDriver {
  id: string;
  label: string;
  pillar: "Business" | "Factor uman" | "Investiție";
  lostPoints: number; // points of the final score lost on this factor
  detail: string;
}

export interface ActionItem {
  id: string;
  title: string;
  why: string;
  steps: string[];
  horizon: 30 | 60 | 90;
  priority: "critică" | "ridicată" | "medie";
  impactPoints: number; // estimated gain on the final score
}
