/**
 * Romanian bank & financing-package matcher.
 *
 * Takes the computed Credit Ready profile of the active SRL and ranks a catalogue of SME
 * products offered in Romania (BCR, Banca Transilvania, ING, Raiffeisen, CEC, UniCredit).
 * Eligibility rules are based on PUBLIC market criteria (minimum DSCR covenants, own
 * contribution, purpose of the financing) and are orientative: this is not an offer.
 *
 * Match % = weighted fit of: ScorFinal, DSCR at the product's terms, purpose, own contribution,
 * requested amount / annualized revenue, plus product-specific signals (DSO, client concentration,
 * seasonality, volatility, size), then multiplied by a portal.just.ro factor.
 *
 * Pure module: type-only imports + bcr-formulas + util.
 */
import type { InvestmentPurpose, SectorBenchmark } from "../types/scoring";
import { annuityInstallment, CREDIT_READY_MIN_SCORE, principalForInstallment } from "./bcr-formulas.ts";
import { clamp, num, pct, ron } from "./util.ts";

export const BANK_DISCLAIMER =
  "Recomandările bancare sunt orientative, bazate pe criterii publice de eligibilitate din piața bancară din România și pe datele analizate. Aceasta nu reprezintă o ofertă fermă sau o aprobare de credit.";

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export interface BankMatchInput {
  finalScore: number;
  /** Monthly EBITDA estimate (operating cash flow before debt service), RON. */
  operatingCashFlow: number;
  /** Existing loans / leasing installments per month, RON. */
  existingMonthlyDebtService: number;
  purpose: InvestmentPurpose | null;
  ownContributionPct: number | null;
  requestedAmount: number | null;
  annualizedRevenue: number;
  dsoDays: number;
  topClientSharePct: number;
  revenueCv: number;
  seasonalityRatio: number;
  /** Off-season resilience ratio from S_Business (weak-month margin / obligations). */
  resilienceRatio: number;
  sector: SectorBenchmark;
  legalScore: number;
  legalCritical: boolean;
  legalPending: boolean;
}

export type ProductKind = "investitie" | "capital_lucru" | "factoring" | "microcredit" | "garantat" | "leasing";

export interface BankRecommendation {
  id: string;
  bank: string;
  product: string;
  kind: ProductKind;
  kindLabel: string;
  idealFor: string;
  /** 0-100. */
  matchPct: number;
  /** All hard minimums (score, DSCR, own contribution) are met. */
  eligible: boolean;
  /** Orientative maximum eligible amount, RON (rounded to 10.000). */
  maxAmount: number;
  maxAmountBasis: string;
  maturityLabel: string;
  rateLabel: string;
  /** DSCR recomputed with the requested amount at this product's terms (null for factoring). */
  dscrAtProduct: number | null;
  /** Monthly cost of the requested amount at this product's terms (installment or interest), RON. */
  monthlyCost: number;
  /** Why it fits: 2-3 arguments built from the firm's real numbers. */
  reasons: string[];
  /** What to fix before applying. */
  conditions: string[];
}

export interface BankMatchResult {
  top: BankRecommendation;
  alternatives: BankRecommendation[];
  all: BankRecommendation[];
  creditReady: boolean;
  readinessNote: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

type Repayment = "anuitate" | "dobanda" | "factoring";

interface Criterion {
  weight: number;
  /** 0-1. */
  fit: number;
  pro: string;
  con: string;
}

interface Product {
  id: string;
  bank: string;
  product: string;
  kind: ProductKind;
  idealFor: string;
  minScore: number;
  /** Minimum DSCR covenant at the product's terms (0 = not applicable, e.g. factoring). */
  minDscr: number;
  minOwnPct: number;
  purposeFit: Record<InvestmentPurpose, number>;
  rateRangePct: [number, number];
  maturityMonths: [number, number];
  maturityLabel?: string;
  rateLabel?: string;
  repayment: Repayment;
  /** Max amount as a share of annualized revenue. */
  maxRevenueShare: number;
  /** Orientative absolute cap, RON. */
  maxAbsolute: number;
  /** Product-specific signals. */
  signals: (x: BankMatchInput) => Criterion[];
}

const KIND_LABEL: Record<ProductKind, string> = {
  investitie: "Credit de investiții",
  capital_lucru: "Capital de lucru / linie de credit",
  factoring: "Factoring / scontare",
  microcredit: "Microcredit",
  garantat: "Credit cu garanție de stat",
  leasing: "Leasing / credit echipamente",
};

const PURPOSE_LABEL: Record<InvestmentPurpose, string> = {
  growth: "creștere / utilaje / tehnologie",
  working_capital: "capital de lucru",
  marketing: "marketing și digitalizare",
  refinancing: "refinanțare / lichiditate",
};

const stabilitySignal = (x: BankMatchInput, weight: number, maxCv: number): Criterion => ({
  weight,
  fit: x.revenueCv <= maxCv ? 1 : x.revenueCv <= maxCv + 0.15 ? 0.5 : 0.15,
  pro: `Încasări stabile: volatilitate lunară (CV) ${num(x.revenueCv)}, sub pragul de ${num(maxCv)} urmărit de bancă.`,
  con: `Volatilitatea veniturilor (CV ${num(x.revenueCv)}) depășește ${num(maxCv)}: netezește încasările (contracte-cadru, abonamente) înainte de aplicare.`,
});

export const BANK_PRODUCTS: Product[] = [
  {
    id: "bcr-investitii",
    bank: "BCR",
    product: "Credit de Investiții IMM / George pentru Afaceri",
    kind: "investitie",
    idealFor: "Creștere, utilaje și echipamente, cu aport propriu de minimum 15% și DSCR ≥ 1,25.",
    minScore: 68,
    minDscr: 1.25,
    minOwnPct: 15,
    purposeFit: { growth: 1, marketing: 0.55, working_capital: 0.2, refinancing: 0.1 },
    rateRangePct: [9.5, 11],
    maturityMonths: [36, 84],
    repayment: "anuitate",
    maxRevenueShare: 0.5,
    maxAbsolute: 5_000_000,
    signals: (x) => [stabilitySignal(x, 10, 0.3)],
  },
  {
    id: "bcr-capital-lucru",
    bank: "BCR",
    product: "Linie de Credit / Capital de Lucru BCR",
    kind: "capital_lucru",
    idealFor: "Stocuri sezoniere și decalaje de încasare (DSO peste 30 de zile).",
    minScore: 60,
    minDscr: 1.2,
    minOwnPct: 0,
    purposeFit: { working_capital: 1, refinancing: 0.4, marketing: 0.3, growth: 0.2 },
    rateRangePct: [9.5, 11],
    maturityMonths: [12, 12],
    maturityLabel: "12 luni, reînnoibilă anual",
    repayment: "dobanda",
    maxRevenueShare: 0.25,
    maxAbsolute: 3_000_000,
    signals: (x) => [
      {
        weight: 15,
        fit: x.dsoDays > 30 ? 1 : x.dsoDays > 20 ? 0.55 : 0.2,
        pro: `Decalaj real de încasare: DSO ${num(x.dsoDays)} zile — linia acoperă golul dintre plata furnizorilor și încasarea clienților.`,
        con: `DSO de doar ${num(x.dsoDays)} zile: nevoia de capital de lucru e mică; justifică linia prin stocuri sau contracte noi.`,
      },
      {
        weight: 10,
        fit: x.seasonalityRatio >= 1.4 ? 1 : 0.5,
        pro: `Vânzările variază de ${num(x.seasonalityRatio)}× între luna de vârf și cea mai slabă: linia finanțează stocurile de sezon.`,
        con: `Sezonalitate redusă (${num(x.seasonalityRatio)}×): argumentează nevoia de lichiditate cu un buget de stocuri.`,
      },
    ],
  },
  {
    id: "bcr-factoring",
    bank: "BCR",
    product: "Factoring / Scontare Facturi BCR",
    kind: "factoring",
    idealFor: "Clienți mari, solvabili, cu termene de plată lungi (DSO ≥ 45 de zile).",
    minScore: 50,
    minDscr: 0,
    minOwnPct: 0,
    purposeFit: { working_capital: 1, refinancing: 0.45, marketing: 0.2, growth: 0.15 },
    rateRangePct: [9.5, 11],
    maturityMonths: [1, 4],
    maturityLabel: "30–120 de zile pe factură, revolving",
    rateLabel: "dobândă orientativă 9,5–11%/an + comision de factoring",
    repayment: "factoring",
    maxRevenueShare: 0.3,
    maxAbsolute: 4_000_000,
    signals: (x) => [
      {
        weight: 30,
        fit: x.dsoDays >= 45 ? 1 : x.dsoDays >= 30 ? 0.5 : 0.1,
        pro: `Termen mediu de încasare ${num(x.dsoDays)} zile: facturile pot fi transformate în bani imediat (avans de ~80%).`,
        con: `DSO ${num(x.dsoDays)} zile, sub pragul de 45 de zile de la care factoringul devine rentabil.`,
      },
      {
        weight: 15,
        fit: x.topClientSharePct >= 30 ? 1 : x.topClientSharePct >= 20 ? 0.65 : 0.3,
        pro: `Clientul #1 generează ${pct(x.topClientSharePct)} din vânzări: riscul se mută pe un debitor mare, analizat separat de bancă.`,
        con: `Clienții sunt fragmentați (clientul #1 ${pct(x.topClientSharePct)}): factoringul pe mulți debitori mici e mai scump.`,
      },
    ],
  },
  {
    id: "bt-mic",
    bank: "Banca Transilvania",
    product: "Credit BT Mic / Microfinanțare",
    kind: "microcredit",
    idealFor: "Firme mici, scor mediu (50–70), nevoie rapidă de capital de lucru sau echipamente, fără garanții imobiliare grele.",
    minScore: 50,
    minDscr: 1.15,
    minOwnPct: 0,
    purposeFit: { working_capital: 1, growth: 0.9, marketing: 0.8, refinancing: 0.3 },
    rateRangePct: [10, 11],
    maturityMonths: [12, 60],
    repayment: "anuitate",
    maxRevenueShare: 0.3,
    maxAbsolute: 250_000,
    signals: (x) => [
      {
        weight: 15,
        fit: x.annualizedRevenue <= 5_000_000 ? 1 : x.annualizedRevenue <= 10_000_000 ? 0.55 : 0.2,
        pro: `Cifră de afaceri anualizată de ${ron(x.annualizedRevenue)}: profil de firmă mică, potrivit microfinanțării rapide.`,
        con: `CA anualizată de ${ron(x.annualizedRevenue)} depășește profilul tipic de microcredit: un credit IMM standard e mai avantajos.`,
      },
      {
        weight: 10,
        fit: x.finalScore >= 50 && x.finalScore <= 72 ? 1 : x.finalScore > 72 ? 0.5 : 0.3,
        pro: `Scorul ${num(x.finalScore)} se încadrează în banda 50–70 vizată de microfinanțare, fără garanții imobiliare grele.`,
        con: `Cu scorul ${num(x.finalScore)} firma se califică probabil pentru produse IMM standard, cu sume mai mari.`,
      },
    ],
  },
  {
    id: "bt-investitii",
    bank: "Banca Transilvania",
    product: "Credit de Investiții IMM / Linie de Credit BT",
    kind: "investitie",
    idealFor: "Firme cu istoric solid (scor ≥ 65, DSCR ≥ 1,2) care finanțează investiții sau capital de lucru.",
    minScore: 65,
    minDscr: 1.2,
    minOwnPct: 10,
    purposeFit: { growth: 1, working_capital: 0.8, marketing: 0.6, refinancing: 0.3 },
    rateRangePct: [9.5, 11],
    maturityMonths: [12, 84],
    repayment: "anuitate",
    maxRevenueShare: 0.5,
    maxAbsolute: 5_000_000,
    signals: (x) => [stabilitySignal(x, 10, 0.3)],
  },
  {
    id: "ing-afaceri",
    bank: "ING Bank România",
    product: "Credit pentru Afaceri / Linie de Credit ING",
    kind: "capital_lucru",
    idealFor: "Fluxuri digitale curate, volatilitate scăzută și clienți diversificați (client #1 sub 40%), scor ≥ 70.",
    minScore: 70,
    minDscr: 1.25,
    minOwnPct: 0,
    purposeFit: { working_capital: 1, growth: 0.8, marketing: 0.65, refinancing: 0.4 },
    rateRangePct: [9.5, 11],
    maturityMonths: [12, 60],
    repayment: "anuitate",
    maxRevenueShare: 0.3,
    maxAbsolute: 3_000_000,
    signals: (x) => [
      stabilitySignal(x, 12, 0.25),
      {
        weight: 13,
        fit: x.topClientSharePct < 40 ? 1 : x.topClientSharePct < 50 ? 0.4 : 0.1,
        pro: `Portofoliu diversificat: clientul #1 are ${pct(x.topClientSharePct)} din vânzări (prag ING: sub 40%).`,
        con: `Clientul #1 are ${pct(x.topClientSharePct)} din vânzări, peste pragul de 40%: diversifică portofoliul înainte de aplicare.`,
      },
    ],
  },
  {
    id: "raiffeisen-investitii",
    bank: "Raiffeisen Bank România",
    product: "Credit de Investiții / Capital de Lucru IMM",
    kind: "investitie",
    idealFor: "Extindere sau tehnologie, cu aport propriu solid (≥ 20%) și scor ≥ 68.",
    minScore: 68,
    minDscr: 1.25,
    minOwnPct: 20,
    purposeFit: { growth: 1, marketing: 0.7, working_capital: 0.6, refinancing: 0.2 },
    rateRangePct: [9.5, 11],
    maturityMonths: [24, 84],
    repayment: "anuitate",
    maxRevenueShare: 0.5,
    maxAbsolute: 5_000_000,
    signals: (x) => [
      {
        weight: 10,
        fit: (x.ownContributionPct ?? 0) >= 25 ? 1 : (x.ownContributionPct ?? 0) >= 20 ? 0.8 : 0.3,
        pro: `Aport propriu de ${pct(x.ownContributionPct ?? 0)}: implicarea acționarilor reduce riscul băncii și poate scădea marja.`,
        con: `Raiffeisen cere un aport solid (≥ 20%); acum ai ${pct(x.ownContributionPct ?? 0)}.`,
      },
    ],
  },
  {
    id: "cec-garantii",
    bank: "CEC Bank",
    product: "Credit IMM cu garanții de stat (FNGCIMM, ex. IMM Invest Plus / scheme active) & Capital de Lucru",
    kind: "garantat",
    idealFor: "Firme sezoniere (HoReCa, agricultură, producție) sau cu aport propriu mai mic (10–15%), scor ≥ 55.",
    minScore: 55,
    minDscr: 1.1,
    minOwnPct: 10,
    purposeFit: { working_capital: 1, growth: 0.9, refinancing: 0.55, marketing: 0.5 },
    rateRangePct: [9.5, 11],
    maturityMonths: [12, 120],
    repayment: "anuitate",
    maxRevenueShare: 0.5,
    maxAbsolute: 5_000_000,
    signals: (x) => [
      {
        weight: 15,
        fit: x.sector.seasonal ? 1 : x.seasonalityRatio >= 1.5 ? 0.75 : 0.3,
        pro: x.sector.seasonal
          ? `Sector sezonier (${x.sector.shortLabel}): schemele cu garanție de stat acceptă cash-flow-ul neuniform din extrasezon.`
          : `Sezonalitate pronunțată (${num(x.seasonalityRatio)}× vârf/minim): garanția de stat compensează lunile slabe.`,
        con: `Firma nu e sezonieră (${x.sector.shortLabel}, ${num(x.seasonalityRatio)}×): avantajul garanției de stat contează mai puțin.`,
      },
      {
        weight: 10,
        fit: (x.ownContributionPct ?? 0) >= 10 && (x.ownContributionPct ?? 0) < 20 ? 1 : (x.ownContributionPct ?? 0) >= 20 ? 0.7 : 0.4,
        pro: `Aportul propriu de ${pct(x.ownContributionPct ?? 0)} e suficient: garanția FNGCIMM acoperă până la 80–90% din credit.`,
        con: `Aportul de ${pct(x.ownContributionPct ?? 0)} e sub minimul de 10% cerut și în schemele garantate.`,
      },
    ],
  },
  {
    id: "unicredit-leasing",
    bank: "UniCredit Bank România",
    product: "Credit de Investiții / Leasing Echipamente & Auto",
    kind: "leasing",
    idealFor: "Achiziția de utilaje, echipamente sau flotă — bunul finanțat este chiar garanția.",
    minScore: 62,
    minDscr: 1.2,
    minOwnPct: 10,
    purposeFit: { growth: 1, marketing: 0.25, working_capital: 0.1, refinancing: 0.1 },
    rateRangePct: [9.5, 11],
    maturityMonths: [12, 60],
    repayment: "anuitate",
    maxRevenueShare: 0.6,
    maxAbsolute: 4_000_000,
    signals: (x) => [
      {
        weight: 15,
        fit: x.purpose === "growth" ? 1 : 0.15,
        pro: "Destinația este echipamente / utilaje: bunul finanțat servește drept garanție, fără ipotecă imobiliară.",
        con: "Leasingul se potrivește doar achiziției de echipamente, utilaje sau autovehicule.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const round10k = (n: number) => Math.max(0, Math.floor(n / 10_000) * 10_000);

/** Monthly cost of `amount` at the product's terms: annuity, interest only (revolving line) or 0 (factoring). */
function monthlyCost(p: Product, amount: number) {
  const rate = (p.rateRangePct[0] + p.rateRangePct[1]) / 200;
  if (amount <= 0 || p.repayment === "factoring") return 0;
  if (p.repayment === "dobanda") return (amount * rate) / 12;
  return annuityInstallment(amount, rate, p.maturityMonths[1]);
}

function maxEligibleAmount(p: Product, x: BankMatchInput) {
  const revenueCap = x.annualizedRevenue * p.maxRevenueShare;
  if (p.repayment === "factoring") {
    // Receivables portfolio ≈ annual revenue × DSO / 365; the factor advances ~80% of it.
    const receivables = (x.annualizedRevenue * x.dsoDays) / 365;
    const amount = Math.min(receivables * 0.8, p.maxAbsolute);
    return { amount: round10k(amount), basis: `~80% din creanțele curente (${ron(receivables)} = CA × DSO / 365)` };
  }
  const rate = (p.rateRangePct[0] + p.rateRangePct[1]) / 200;
  const covenant = Math.max(p.minDscr, 1.2);
  const freeInstallment = Math.max(0, x.operatingCashFlow / covenant - x.existingMonthlyDebtService);
  const byDscr =
    p.repayment === "dobanda" ? (freeInstallment * 12) / rate : principalForInstallment(freeInstallment, rate, p.maturityMonths[1]);
  const amount = Math.min(byDscr, revenueCap, p.maxAbsolute);
  const binding = amount === byDscr ? `capacitatea de plată la DSCR ${num(covenant)}×` : amount === revenueCap ? `${Math.round(p.maxRevenueShare * 100)}% din CA anualizată` : "plafonul orientativ al produsului";
  return { amount: round10k(amount), basis: `limitat de ${binding}` };
}

/**
 * Comfort above a minimum: 1 when value ≥ min + span (comfortable margin), 0.6 exactly at the
 * minimum (eligible but tight), linearly down to 0 at min − span (clearly below the bar).
 */
function thresholdFit(value: number, min: number, span: number) {
  if (value >= min + span) return 1;
  if (value >= min) return 0.6 + (0.4 * (value - min)) / span;
  return Math.max(0, 0.6 * (1 - (min - value) / span));
}

function evaluateProduct(p: Product, x: BankMatchInput): BankRecommendation {
  const requested = x.requestedAmount ?? 0;
  const cost = monthlyCost(p, requested);
  const debt = x.existingMonthlyDebtService + cost;
  const dscrAtProduct = p.repayment === "factoring" ? null : debt > 0 ? x.operatingCashFlow / debt : 99;
  const own = x.ownContributionPct ?? 0;
  const leverage = x.annualizedRevenue > 0 ? requested / x.annualizedRevenue : Infinity;
  const { amount: maxAmount, basis } = maxEligibleAmount(p, x);

  const criteria: Criterion[] = [
    {
      weight: 30,
      fit: thresholdFit(x.finalScore, p.minScore, 15),
      pro: `ScorFinal ${num(x.finalScore)}, confortabil peste pragul orientativ al produsului (${p.minScore}).`,
      con:
        x.finalScore >= p.minScore
          ? `ScorFinal ${num(x.finalScore)}, doar puțin peste pragul orientativ de ${p.minScore}: încă ${num(p.minScore + 15 - x.finalScore)} puncte din planul de 30–90 de zile ar da o marjă confortabilă.`
          : `ScorFinal ${num(x.finalScore)} sub pragul orientativ de ${p.minScore}: urmează planul de 30–90 de zile pentru a câștiga ${num(p.minScore - x.finalScore)} puncte.`,
    },
  ];
  if (p.minDscr > 0 && dscrAtProduct !== null) {
    const tight = dscrAtProduct >= p.minDscr;
    criteria.push({
      weight: 20,
      fit: thresholdFit(dscrAtProduct, p.minDscr, 0.35),
      pro: requested > 0 ? `DSCR ${num(dscrAtProduct)}× cu rata estimată de ${ron(cost)}/lună (minim cerut ${num(p.minDscr)}×).` : `DSCR actual ${num(dscrAtProduct)}× (minim cerut ${num(p.minDscr)}×).`,
      con: tight
        ? `DSCR ${num(dscrAtProduct)}× la limita covenant-ului de ${num(p.minDscr)}×: orice scădere a marjei îl împinge sub prag — prelungește maturitatea sau redu suma.`
        : requested > 0
          ? `DSCR ${num(dscrAtProduct)}× la suma cerută, sub covenant-ul de ${num(p.minDscr)}×: redu suma la max. ${ron(maxAmount)} sau prelungește maturitatea.`
          : `DSCR ${num(dscrAtProduct)}× sub covenant-ul de ${num(p.minDscr)}×: crește marja operațională sau redu ratele existente.`,
    });
  }
  criteria.push({
    weight: 20,
    fit: x.purpose ? p.purposeFit[x.purpose] : 0.5,
    pro: x.purpose ? `Destinația declarată (${PURPOSE_LABEL[x.purpose]}) corespunde exact acestui tip de produs.` : "Destinația nu este încă declarată.",
    con: x.purpose ? `Destinația „${PURPOSE_LABEL[x.purpose]}” nu este specifică pentru ${KIND_LABEL[p.kind].toLowerCase()}.` : "Completează destinația finanțării în pasul 3.",
  });
  if (p.minOwnPct > 0) {
    criteria.push({
      weight: 10,
      fit: own >= p.minOwnPct ? 1 : (own / p.minOwnPct) * 0.6,
      pro: `Aport propriu ${pct(own)} ≥ ${p.minOwnPct}% cerut.`,
      con: `Aport propriu ${pct(own)}, sub minimul orientativ de ${p.minOwnPct}%: completează avansul înainte de depunere.`,
    });
  }
  criteria.push({
    weight: 10,
    fit: requested <= 0 ? 0.5 : requested <= maxAmount ? 1 : clamp(1 - (requested - maxAmount) / Math.max(maxAmount, 1), 0, 1) * 0.7,
    pro:
      requested > 0
        ? `Suma cerută (${ron(requested)}, ${pct(leverage * 100)} din CA) se încadrează în plafonul estimat de ${ron(maxAmount)}.`
        : `Plafon estimat pentru firmă: ${ron(maxAmount)}.`,
    con: requested > 0 ? `Suma cerută (${ron(requested)}) depășește plafonul estimat de ${ron(maxAmount)}: etapizează finanțarea.` : "Completează suma solicitată în pasul 3.",
  });
  criteria.push(...p.signals(x));

  const weightSum = criteria.reduce((s, c) => s + c.weight, 0);
  let match = criteria.reduce((s, c) => s + c.weight * c.fit, 0) / weightSum;
  const conditions: string[] = [];
  if (x.legalCritical) {
    match *= 0.3;
    conditions.push("portal.just.ro: există un dosar critic (insolvență / infracțiune economică) — băncile resping de regulă cererea până la clarificare.");
  } else if (x.legalScore < 60) {
    match *= 0.75;
    conditions.push(`Scor juridic ${num(x.legalScore)}/100: pregătește o notă explicativă pe fiecare dosar activ din portal.just.ro.`);
  } else if (x.legalScore < 80) {
    match *= 0.92;
  }
  if (x.legalPending) conditions.push("Verificarea portal.just.ro nu a fost rulată: banca o face oricum la depunere.");

  const eligible =
    x.finalScore >= p.minScore && (p.minDscr === 0 || (dscrAtProduct ?? 0) >= p.minDscr) && own >= p.minOwnPct && !x.legalCritical;

  const reasons = criteria
    .filter((c) => c.fit >= 0.75)
    .sort((a, b) => b.weight * b.fit - a.weight * a.fit)
    .slice(0, 3)
    .map((c) => c.pro);
  conditions.unshift(
    ...criteria
      .filter((c) => c.fit < 0.75)
      .sort((a, b) => b.weight * (1 - b.fit) - a.weight * (1 - a.fit))
      .map((c) => c.con),
  );

  const [m0, m1] = p.maturityMonths;
  return {
    id: p.id,
    bank: p.bank,
    product: p.product,
    kind: p.kind,
    kindLabel: KIND_LABEL[p.kind],
    idealFor: p.idealFor,
    matchPct: Math.round(clamp(match, 0, 1) * 100),
    eligible,
    maxAmount,
    maxAmountBasis: basis,
    maturityLabel: p.maturityLabel ?? (m0 === m1 ? `${m0} luni` : `${m0}–${m1} luni`),
    rateLabel: p.rateLabel ?? `dobândă orientativă ${num(p.rateRangePct[0])}–${num(p.rateRangePct[1])}%/an`,
    dscrAtProduct: dscrAtProduct === null ? null : Math.round(dscrAtProduct * 100) / 100,
    monthlyCost: Math.round(cost),
    reasons: reasons.length ? reasons : ["Potrivire parțială: niciun criteriu nu este îndeplinit integral încă."],
    conditions,
  };
}

/** Ranks every product; the top pick plus up to 3 alternatives from other banks. */
export function matchBanks(x: BankMatchInput): BankMatchResult {
  const all = BANK_PRODUCTS.map((p) => evaluateProduct(p, x)).sort(
    (a, b) => b.matchPct - a.matchPct || Number(b.eligible) - Number(a.eligible) || b.maxAmount - a.maxAmount,
  );
  const top = all[0];
  const alternatives: BankRecommendation[] = [];
  const banks = new Set([top.bank]);
  for (const r of all.slice(1)) {
    if (alternatives.length >= 3) break;
    if (banks.has(r.bank)) continue;
    banks.add(r.bank);
    alternatives.push(r);
  }
  // Fewer than 3 distinct banks above: fill with the next best products.
  for (const r of all.slice(1)) if (alternatives.length < 3 && !alternatives.includes(r)) alternatives.push(r);

  const creditReady = x.finalScore >= CREDIT_READY_MIN_SCORE && !x.legalCritical;
  const readinessNote = creditReady
    ? `ScorFinal ${num(x.finalScore)} ≥ ${CREDIT_READY_MIN_SCORE}: firma poate pregăti dosarul pentru produsele de mai jos.`
    : x.legalCritical
      ? "Firma nu este încă „Credit Ready”: un dosar critic în portal.just.ro blochează practic orice finanțare. Clarifică-l, apoi refă evaluarea."
      : `Firma nu este încă „Credit Ready” (ScorFinal ${num(x.finalScore)} < ${CREDIT_READY_MIN_SCORE}). Parcurge întâi planul de 30–90 de zile, apoi aplică — o cerere respinsă rămâne în istoricul băncii.`;

  return { top, alternatives, all, creditReady, readinessNote, disclaimer: BANK_DISCLAIMER };
}
