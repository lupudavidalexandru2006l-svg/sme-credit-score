// Run with: npm test — end-to-end checks on the synthetic company and the demo XML files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeAssessment } from "./assessment.ts";
import { syntheticDataset } from "./data/synthetic.ts";
import { parseEFacturaXml } from "./efactura/parser.ts";
import { computeMetrics } from "./metrics.ts";
import { dscrScore, estimateInstallment, quartileScore } from "./scoringEngine.ts";
import type { InvestmentInput, Invoice, QuizAnswers } from "../types/scoring";

const { company, invoices } = syntheticDataset();
const sample = (f: string) => {
  const r = parseEFacturaXml(readFileSync(new URL(`../../public/samples/${f}`, import.meta.url), "utf8"), f, company);
  assert.ok(r.ok, r.error);
  return r.invoice!;
};
const quiz: QuizAnswers = { revenueEstimate: 2_000_000, paymentTerm: "30", topClientShare: "15-30", mainSupplier: "Lactate Transilvania SRL", hasSignificantCreditNotes: false };
const investment: InvestmentInput = { purpose: "growth", ownContributionPct: 15, requestedAmount: 900_000 };
const assess = (list: Invoice[]) => computeAssessment({ company, invoices: list, quiz, investment, legal: null });

test("synthetic data is deterministic and covers 12 months", () => {
  const m = computeMetrics(invoices, company);
  assert.equal(m.months.length, 12);
  assert.equal(m.months[0].month, "2025-11");
  assert.equal(m.asOf, "2026-10-31");
  assert.equal(m.topClients[0].name, "Mega Retail Network SRL");
  assert.equal(m.topSuppliers[0].name, "Agroalim Distribuție SA");
  assert.ok(m.topClientSharePct > 15 && m.topClientSharePct < 30);
  assert.ok(m.creditNotesSharePct3m > 2 && m.creditNotesSharePct3m < 5);
  assert.equal(computeMetrics(syntheticDataset().invoices, company).revenue12m, m.revenue12m);
});

test("UBL parser reads the demo files", () => {
  const normal = sample("01_factura_normala.xml");
  assert.equal(normal.direction, "issued");
  assert.equal(normal.typeCode, "380");
  assert.equal(normal.taxExclusiveAmount, 18450);
  assert.equal(normal.payableAmount, 20479.5);
  assert.equal(normal.dueDate, "2026-11-06");
  assert.equal(normal.customerCui, "RO40128856");

  const storno = sample("02_factura_storno_381.xml");
  assert.equal(storno.typeCode, "381");
  assert.equal(storno.dueDate, null);

  const bad = parseEFacturaXml("<root/>", "x.xml", company);
  assert.equal(bad.ok, false);
});

test("uploading the demo XML files changes the score live", () => {
  const base = assess(invoices);
  assert.equal(base.quiz.total, 94);

  const withStorno = assess([...invoices, sample("02_factura_storno_381.xml")]);
  assert.ok(withStorno.metrics.creditNotesSharePct3m > 5, "storno pushes the 3-month rate over 5%");
  assert.equal(withStorno.quiz.items.find((i) => i.id === "creditNotes")!.points, 0, "quiz answer 'Nu' becomes wrong");
  assert.ok(withStorno.final.finalScore < base.final.finalScore);

  const withBig = assess([...invoices, sample("03_factura_mare_concentrare.xml")]);
  assert.ok(withBig.metrics.topClientSharePct > 30, "big invoice moves client #1 above 30%");
  assert.equal(withBig.quiz.items.find((i) => i.id === "topClientShare")!.points, 10);
  assert.ok(withBig.plan.some((a) => a.id === "concentration"));
});

test("action plan always has 3-5 items", () => {
  const a = assess(invoices);
  assert.ok(a.plan.length >= 3 && a.plan.length <= 5);
  const bad = computeAssessment({ company, invoices, quiz: { ...quiz, revenueEstimate: 1 }, investment: { purpose: "refinancing", ownContributionPct: 0, requestedAmount: 8_000_000 }, legal: null });
  assert.ok(bad.plan.some((x) => x.id === "amount"));
  assert.ok(bad.final.warnings.some((w) => w.includes("supraîndatorare")));
});

test("helpers: installment, DSCR and quartile scoring", () => {
  assert.equal(Math.round(estimateInstallment(900_000)), 18902);
  assert.equal(dscrScore(1.0), 30);
  assert.equal(dscrScore(1.5), 90);
  assert.equal(quartileScore(30, [30, 42, 58], false), 100);
  assert.equal(quartileScore(42, [30, 42, 58], false), 60);
  assert.equal(quartileScore(19, [14, 19, 24], true), 60);
  assert.equal(quartileScore(24, [14, 19, 24], true), 100);
});
