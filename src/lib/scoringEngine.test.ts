// Run with: npm test  (Node's built-in test runner + TypeScript stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessCaseRisk,
  calculateFinalScore,
  classifyPartyRole,
  detectCriticalKeywords,
  partyNameMatches,
  evaluateFinancialQuiz,
  evaluateInvestment,
  scoreLegalCases,
  scoreRevenueEstimate,
} from "./scoringEngine.ts";
import type { EFacturaGroundTruth } from "../types/scoring";

const truth: EFacturaGroundTruth = {
  companyId: "t",
  companyName: "Test SRL",
  cui: "RO1",
  caenCode: "0000",
  caenLabel: "test",
  revenueLast3MonthsNoVat: 150_000,
  annualizedRevenue: 600_000,
  avgPaymentTermDays: 30,
  topClientSharePct: 38,
  topClientName: "Client SRL",
  topSuppliers: [
    { name: "C", cui: "3", purchaseValue: 30 },
    { name: "A", cui: "1", purchaseValue: 100 },
    { name: "B", cui: "2", purchaseValue: 50 },
    { name: "D", cui: "4", purchaseValue: 20 },
    { name: "E", cui: "5", purchaseValue: 10 },
  ],
  decoySuppliers: ["X", "Y"],
  creditNotesSharePct: 2,
  invoices: [],
};

test("Q1 revenue thresholds", () => {
  assert.equal(scoreRevenueEstimate(165_000, 150_000).points, 35); // exactly 10%
  assert.equal(scoreRevenueEstimate(140_000, 150_000).points, 35);
  assert.equal(scoreRevenueEstimate(180_000, 150_000).points, 24); // exactly 20%
  assert.equal(scoreRevenueEstimate(202_500, 150_000).points, 10); // exactly 35%
  assert.equal(scoreRevenueEstimate(203_000, 150_000).points, 0);
  assert.equal(scoreRevenueEstimate(null, 150_000).points, 0);
});

test("perfect quiz = 100", () => {
  const r = evaluateFinancialQuiz(
    { revenueEstimate: 150_000, paymentTerm: "30", topClientShare: "30-50", mainSupplier: "A", hasSignificantCreditNotes: false },
    truth,
  );
  assert.equal(r.total, 100);
});

test("quiz neighbours and suppliers", () => {
  const r = evaluateFinancialQuiz(
    { revenueEstimate: 175_000, paymentTerm: "45+", topClientShare: ">50", mainSupplier: "C", hasSignificantCreditNotes: true },
    truth,
  );
  // 24 + 12 + 10 + 6 + 0
  assert.equal(r.total, 52);
  const r2 = evaluateFinancialQuiz(
    { revenueEstimate: 1, paymentTerm: "0-7", topClientShare: "<15", mainSupplier: "X", hasSignificantCreditNotes: true },
    truth,
  );
  assert.equal(r2.total, 0);
});

test("investment scoring", () => {
  const top = evaluateInvestment({ purpose: "growth", ownContributionPct: 25, requestedAmount: 150_000 }, 600_000);
  assert.equal(top.total, 100);
  const mid = evaluateInvestment({ purpose: "working_capital", ownContributionPct: 20, requestedAmount: 300_000 }, 600_000);
  assert.equal(mid.total, 35 + 20 + 12);
  const low = evaluateInvestment({ purpose: "refinancing", ownContributionPct: 5, requestedAmount: 300_001 }, 600_000);
  assert.equal(low.total, 10 + 5 + 0);
  assert.equal(low.overLeveragedRequest, true);
});

test("legal scoring + keywords", () => {
  assert.equal(scoreLegalCases([]).legalScore, 100);
  assert.equal(scoreLegalCases([{ isCritical: false }, { isCritical: false }]).legalScore, 80);
  assert.equal(scoreLegalCases([{ isCritical: false }, { isCritical: false }, { isCritical: false }]).legalScore, 50);
  const crit = scoreLegalCases([{ isCritical: true }]);
  assert.equal(crit.legalScore, 0);
  assert.equal(crit.integrityKillSwitch, true);
  assert.deepEqual(detectCriticalKeywords("Procedura insolvenței – Legea 85/2014"), ["insolven"]);
  assert.deepEqual(detectCriticalKeywords("Înșelăciune (art. 244 NCP)"), ["inselaciune"]);
  assert.deepEqual(detectCriticalKeywords("Contestaţie la executare silită"), ["executare silit"]);
  assert.deepEqual(detectCriticalKeywords("pretenții", "Civil"), []);
});

test("final score formula, penalty and cap", () => {
  const ok = calculateFinalScore(78, 100, { legalScore: 100, integrityKillSwitch: false }, 100);
  assert.equal(ok.finalScore, 84.6); // 54.6 + 7.5 + 7.5 + 15
  assert.equal(ok.status, "Bank-Ready");
  assert.equal(ok.pillars.human.points, 15);

  const penalized = calculateFinalScore(78, 30, { legalScore: 100, integrityKillSwitch: false }, 100);
  // 54.6 + 2.25 + 7.5 + 15 = 79.35 -> -10 = 69.35
  assert.equal(penalized.finalScore, 69.4);
  assert.equal(penalized.quizControlPenaltyApplied, true);

  const capped = calculateFinalScore(95, 100, { legalScore: 0, integrityKillSwitch: true }, 100);
  assert.equal(capped.finalScore, 35);
  assert.equal(capped.integrityCapApplied, true);
  assert.equal(capped.status, "High Risk");

  const floor = calculateFinalScore(0, 0, { legalScore: 0, integrityKillSwitch: false }, 0);
  assert.equal(floor.finalScore, 0);
});

test("party name matching mirrors portal.just.ro (whole words, any order)", () => {
  assert.equal(partyNameMatches("POPESCU ION", "Ion Popescu"), true);
  assert.equal(partyNameMatches("Popescu Ion Mihai", "Ion Popescu"), true);
  assert.equal(partyNameMatches("POPESCU ION", "Ion Mihai Popescu"), false); // every word required
  assert.equal(partyNameMatches("POPESCU ION", "Popesc Ion"), false); // no partial words
  assert.equal(partyNameMatches("SC ŞTEFĂNESCU SRL", "Ștefănescu"), true); // cedilla vs comma
  assert.equal(partyNameMatches("ANY", ""), false);
});

test("party role classification", () => {
  assert.equal(classifyPartyRole("Debitor"), "vizat");
  assert.equal(classifyPartyRole("Inculpat"), "vizat");
  assert.equal(classifyPartyRole("Pârât"), "vizat");
  assert.equal(classifyPartyRole("Parte responsabilă civilmente"), "vizat");
  assert.equal(classifyPartyRole("Creditor"), "nevizat");
  assert.equal(classifyPartyRole("Parte vătămată"), "nevizat");
  assert.equal(classifyPartyRole("Reclamant"), "nevizat");
  assert.equal(classifyPartyRole("Intimat"), "necunoscut");
  assert.equal(classifyPartyRole(""), "necunoscut");
});

test("case risk combines keywords and role", () => {
  const insolv = { obiect: "procedura insolvenței", categorie: "Faliment", stadiu: "Fond" };
  assert.equal(assessCaseRisk(insolv, ["Debitor"]).isCritical, true);
  assert.equal(assessCaseRisk(insolv, ["Creditor"]).isCritical, false);
  assert.deepEqual(assessCaseRisk(insolv, ["Creditor"]).matchedKeywords, ["insolven", "faliment"]);
  assert.equal(assessCaseRisk(insolv, []).isCritical, true); // role not found -> conservative
  assert.equal(assessCaseRisk(insolv, ["Intimat"]).isCritical, true); // ambiguous -> conservative
  assert.equal(assessCaseRisk(insolv, ["Creditor", "Debitor"]).isCritical, true); // targeted wins
  const penal = { obiect: "înșelăciune (art. 244 NCP)", categorie: "Penal", stadiu: "Fond" };
  assert.equal(assessCaseRisk(penal, ["Parte vătămată"]).isCritical, false);
  assert.equal(assessCaseRisk(penal, ["Inculpat"]).isCritical, true);
  const civil = { obiect: "pretenții", categorie: "Civil", stadiu: "Fond" };
  assert.equal(assessCaseRisk(civil, ["Pârât"]).isCritical, false);
});

test("party missing from a truncated mass-case list is treated as creditor", () => {
  const insolv = { obiect: "procedura insolvenței", categorie: "Faliment", stadiu: "Fond" };
  assert.equal(assessCaseRisk(insolv, [], { partyListTruncated: true }).isCritical, false);
  assert.equal(assessCaseRisk(insolv, [], { partyListTruncated: false }).isCritical, true);
  assert.equal(assessCaseRisk(insolv, ["Debitor"], { partyListTruncated: true }).isCritical, true);
});
