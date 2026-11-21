/**
 * "Demo complet (1 click)": one ready-to-analyse SME, clearly flagged as DEMO in the UI.
 * Kept only in this browser (never sent to Supabase) and never re-queried against the real sources.
 */
import type { Company, InvestmentInput, Invoice, LegalCheckResult, QuizAnswers } from "@/types/scoring";
import { computeMetrics } from "./metrics";
import { onrcBpiFrom, portalSource, REAL_SOURCE_META, type CompanyRealData, type RealSourceId, type RealSourceResult } from "./real-company-sources";

export const DEMO_COMPANY_ID = "demo-nord-fresh-0000-4000-8000-000000000001";
const CUI = "RO40000001";
const NAME = "NORD FRESH DISTRIBUTIE SRL";

const CLIENTS = [
  { name: "ALFA RETAIL SRL", cui: "RO40000011", share: 0.26 },
  { name: "VERDE MARKET SRL", cui: "RO40000012", share: 0.22 },
  { name: "CARPAT HORECA SRL", cui: "RO40000013", share: 0.19 },
  { name: "LIDO FOOD SRL", cui: "RO40000014", share: 0.18 },
  { name: "DELTA CATERING SRL", cui: "RO40000015", share: 0.15 },
];
const SUPPLIERS = [
  { name: "AGRO VEST FERMA SRL", cui: "RO40000021", share: 0.4 },
  { name: "LACTA NORD SRL", cui: "RO40000022", share: 0.3 },
  { name: "TRANS FRIG LOGISTIC SRL", cui: "RO40000023", share: 0.18 },
  { name: "PACK PRO AMBALAJE SRL", cui: "RO40000024", share: 0.12 },
];
/** Monthly sales without VAT (RON), oldest first: summer peak, January trough. */
const SEASON = [0.92, 0.95, 1.0, 1.04, 1.1, 1.18, 1.22, 1.15, 1.05, 0.98, 0.94, 0.86];
const BASE_SALES = 420_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

function invoice(dir: Invoice["direction"], n: string, date: string, partner: { name: string; cui: string }, amount: number, typeCode = "380"): Invoice {
  const supplier = dir === "issued" ? { name: NAME, cui: CUI } : partner;
  const customer = dir === "issued" ? partner : { name: NAME, cui: CUI };
  return {
    id: `${dir}:${supplier.cui}:${n}`,
    number: n,
    direction: dir,
    typeCode,
    issueDate: date,
    dueDate: addDays(date, 30),
    supplierName: supplier.name,
    supplierCui: supplier.cui,
    customerName: customer.name,
    customerCui: customer.cui,
    taxExclusiveAmount: amount,
    payableAmount: Math.round(amount * 1.19 * 100) / 100,
    currency: "RON",
    paidDate: null,
    source: "xml-upload",
  };
}

/** 12 full months ending with the previous month: 2 sales invoices per client and 1 purchase per supplier each month. */
function demoInvoices(today: string): Invoice[] {
  const now = new Date(`${today}T00:00:00Z`);
  const out: Invoice[] = [];
  let seq = 1;
  for (let i = 0; i < 12; i++) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12 + i, 1));
    const ym = iso(m).slice(0, 7);
    const sales = BASE_SALES * SEASON[i];
    for (const c of CLIENTS) {
      for (const day of ["05", "19"]) {
        out.push(invoice("issued", `NFD-${String(seq++).padStart(5, "0")}`, `${ym}-${day}`, c, Math.round((sales * c.share) / 2)));
      }
    }
    for (const s of SUPPLIERS) {
      out.push(invoice("received", `${s.cui.slice(-2)}-${ym.replace("-", "")}`, `${ym}-10`, s, Math.round(sales * 0.68 * s.share)));
    }
    // One small storno, 5 months back (outside the last 3 months).
    if (i === 7) out.push(invoice("issued", `NFD-${String(seq++).padStart(5, "0")}`, `${ym}-24`, CLIENTS[3], -Math.round(sales * 0.012), "381"));
  }
  return out;
}

const src = (sourceId: RealSourceId, status: RealSourceResult["status"], rawSummary: string, checkedAt: string): RealSourceResult => ({
  sourceId,
  ...REAL_SOURCE_META[sourceId],
  status,
  checkedAt,
  rawSummary: `[DEMO] ${rawSummary}`,
  data: null,
});

export interface DemoBundle {
  company: Company;
  uploads: Invoice[];
  legal: LegalCheckResult;
  official: CompanyRealData;
  quiz: QuizAnswers;
  investment: InvestmentInput;
}

export function buildDemo(today: string): DemoBundle {
  const checkedAt = new Date(`${today}T09:00:00Z`).toISOString();
  const company: Company = {
    id: DEMO_COMPANY_ID,
    name: NAME,
    officialName: NAME,
    cui: CUI,
    caenCode: "4639",
    sector: "4639",
    ceoName: "Andrei Popescu",
    city: "Suceava",
    county: "Suceava",
    monthlyFixedCosts: 95_000,
    existingMonthlyDebtService: 14_000,
    financialsDeclared: true,
    debts: [],
    nameSearchConsent: true,
    createdAt: checkedAt,
  };
  const uploads = demoInvoices(today);

  const legal: LegalCheckResult = {
    query: { companyName: NAME, ceoName: company.ceoName, companyCounty: "Suceava" },
    source: "portal.just.ro",
    isFallback: false,
    cases: [],
    totalFound: 0,
    excludedCount: 0,
    criticalCount: 0,
    totalDeduction: 0,
    minorCapApplied: false,
    legalScore: 100,
    integrityKillSwitch: false,
    uncertainCount: 0,
    message: "[DEMO] 0 dosare pe numele exact al firmei și al administratorului.",
    checkedAt,
  };

  const anaf = {
    cui: "40000001",
    denumire: NAME,
    nrRegCom: "J33/1234/2018",
    adresa: "Str. Demo nr. 1, Suceava",
    codCaen: "4639",
    telefon: "",
    stareInregistrare: "INREGISTRAT din data 12.03.2018",
    dataInregistrare: "2018-03-12",
    formaJuridica: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
    scpTva: true,
    tvaLaIncasare: false,
    splitTva: false,
    eFactura: true,
    inactiv: false,
    dataInactivare: "",
    dataReactivare: "",
    dataRadiere: "",
    judet: "Suceava",
    localitate: "Suceava",
  };
  const year = Number(today.slice(0, 4));
  const bilant = [
    { an: year - 1, cifraAfaceri: 4_850_000, profitNet: 312_000, datorii: 1_150_000, capitaluriProprii: 980_000, salariati: 24 },
    { an: year - 2, cifraAfaceri: 4_310_000, profitNet: 254_000, datorii: 1_240_000, capitaluriProprii: 668_000, salariati: 21 },
  ].map((b) => ({
    ...b,
    denumire: NAME,
    caen: "4639",
    denCaen: "Comerț cu ridicata nespecializat de produse alimentare",
    venituriTotale: Math.round(b.cifraAfaceri * 1.01),
    cheltuieliTotale: Math.round(b.cifraAfaceri * 1.01 - b.profitNet * 1.16),
    profitBrut: Math.round(b.profitNet * 1.16),
    pierdereBruta: 0,
    pierdereNeta: 0,
    activeImobilizate: 720_000,
    activeCirculante: 1_480_000,
    stocuri: 410_000,
    creante: 690_000,
    casaBanci: 260_000,
  }));
  const onrc = onrcBpiFrom(anaf, legal, anaf.cui, checkedAt);
  const official: CompanyRealData = {
    cui: anaf.cui,
    sources: [
      src("anaf_general", "verified", "Plătitor TVA, înregistrat în RO e-Factura, activ fiscal.", checkedAt),
      src("anaf_bilant", "verified", `Bilanțuri ${year - 2}–${year - 1} depuse; profit în ambii ani.`, checkedAt),
      portalSource(legal, checkedAt),
      src("vies_eu", "verified", "Cod TVA intracomunitar valid.", checkedAt),
      onrc.result,
    ],
    anaf,
    bilant,
    vies: { isValid: true, name: NAME, address: anaf.adresa, requestDate: today },
    onrc: onrc.data,
    checkedAt,
  };

  // Quiz answers consistent with the demo invoices (a well-informed administrator).
  const m = computeMetrics(uploads, company, today);
  const share = m.topClientSharePct;
  const quiz: QuizAnswers = {
    revenueEstimate: Math.round(m.revenueLast3Months / 10_000) * 10_000,
    paymentTerm: "30",
    topClientShare: share < 15 ? "<15" : share < 30 ? "15-30" : share < 50 ? "30-50" : ">50",
    mainSupplier: m.topSuppliers[0]?.name ?? null,
    hasSignificantCreditNotes: false,
  };
  const investment: InvestmentInput = { purpose: "growth", ownContributionPct: 25, requestedAmount: 900_000, termMonths: 60 };
  return { company, uploads, legal, official, quiz, investment };
}
