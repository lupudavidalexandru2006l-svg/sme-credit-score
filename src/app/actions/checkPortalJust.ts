"use server";

import { XMLParser } from "fast-xml-parser";
import type {
  CourtCase,
  LegalCheckResult,
  PortalSimulationScenario,
} from "@/types/scoring";
import {
  detectCriticalKeywords,
  FALLBACK_LEGAL_SCORE,
  normalizeRo,
  scoreLegalCases,
} from "@/lib/scoringEngine";

const ENDPOINT = "http://portalquery.just.ro/Query.asmx";
const SOAP_ACTION = "portalquery.just.ro/CautareDosare";
const TIMEOUT_MS = 5_000;
const MAX_CASES_PER_QUERY = 50;

export interface CheckPortalJustInput {
  companyName: string;
  ceoName: string;
  simulationMode?: boolean;
  simulationScenario?: PortalSimulationScenario;
}

// ---------------------------------------------------------------------------
// SOAP helpers
// ---------------------------------------------------------------------------

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

function buildEnvelope(numeParte: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CautareDosare xmlns="portalquery.just.ro">
      <numeParte>${escapeXml(numeParte)}</numeParte>
    </CautareDosare>
  </soap:Body>
</soap:Envelope>`;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "Dosar" || name === "DosarParte",
});

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

interface RawDosar {
  numar?: unknown;
  data?: unknown;
  institutie?: unknown;
  obiect?: unknown;
  categorieCaz?: unknown;
  categorieCazNume?: unknown;
  stadiuProcesual?: unknown;
  stadiuProcesualNume?: unknown;
  parti?: { DosarParte?: { nume?: unknown; calitateParte?: unknown }[] };
}

/** Parses a CautareDosare SOAP response into CourtCase objects. */
export async function parseCautareDosareXml(
  xml: string,
  matchedBy: CourtCase["matchedBy"],
  searchedName = "",
): Promise<CourtCase[]> {
  const needle = normalizeRo(searchedName).replace(/\s+/g, " ").trim();
  const doc = parser.parse(xml);
  const body = doc?.Envelope?.Body;
  if (body?.Fault) throw new Error(`SOAP Fault: ${str(body.Fault.faultstring)}`);
  const dosare: RawDosar[] = body?.CautareDosareResponse?.CautareDosareResult?.Dosar ?? [];

  return dosare.slice(0, MAX_CASES_PER_QUERY).map((d) => {
    const obiect = str(d.obiect);
    const categorie = str(d.categorieCazNume || d.categorieCaz);
    const stadiu = str(d.stadiuProcesualNume || d.stadiuProcesual);
    const parti = d.parti?.DosarParte ?? [];
    // Role of the searched party in this case (e.g. "Debitor", "Creditor", "Pârât").
    const role = needle
      ? str(parti.find((p) => normalizeRo(str(p.nume)).includes(needle))?.calitateParte)
      : "";
    // Being a creditor in someone else's insolvency is not an integrity risk.
    const isCreditorOnly = /creditor/.test(normalizeRo(role));
    const matchedKeywords = isCreditorOnly ? [] : detectCriticalKeywords(obiect, categorie, stadiu);
    return {
      numar: str(d.numar),
      institutie: str(d.institutie).replace(/([a-z])([A-Z])/g, "$1 $2"),
      data: str(d.data).slice(0, 10),
      obiect,
      categorie,
      stadiu,
      parti: parti
        .slice(0, 6)
        .map((p) => `${str(p.nume)}${p.calitateParte ? ` (${str(p.calitateParte)})` : ""}`),
      matchedBy,
      isCritical: matchedKeywords.length > 0,
      matchedKeywords,
    };
  });
}

async function queryPortal(numeParte: string, matchedBy: CourtCase["matchedBy"]) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${SOAP_ACTION}"`,
    },
    body: buildEnvelope(numeParte),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok && !text.includes("Envelope")) {
    throw new Error(`portal.just.ro HTTP ${res.status}`);
  }
  return parseCautareDosareXml(text, matchedBy, numeParte);
}

// ---------------------------------------------------------------------------
// Simulation data (demo mode)
// ---------------------------------------------------------------------------

function simulatedCases(
  scenario: PortalSimulationScenario,
  companyName: string,
  ceoName: string,
): CourtCase[] {
  const base = (
    numar: string,
    obiect: string,
    categorie: string,
    stadiu: string,
    matchedBy: CourtCase["matchedBy"],
    institutie = "Tribunalul Cluj",
  ): CourtCase => {
    const matchedKeywords = detectCriticalKeywords(obiect, categorie, stadiu);
    return {
      numar,
      institutie,
      data: "2026-03-12",
      obiect,
      categorie,
      stadiu,
      parti: [matchedBy === "firma" ? `${companyName} (Pârât)` : `${ceoName} (Intimat)`],
      matchedBy,
      isCritical: matchedKeywords.length > 0,
      matchedKeywords,
    };
  };
  switch (scenario) {
    case "clean":
      return [];
    case "minor":
      return [
        base("4127/211/2025", "pretenții", "Civil", "Fond", "firma", "Judecătoria Cluj-Napoca"),
        base("1893/1285/2026", "acțiune în constatare", "Litigii cu profesioniștii", "Apel", "firma"),
      ];
    case "many":
      return [
        base("4127/211/2025", "pretenții", "Civil", "Fond", "firma", "Judecătoria Cluj-Napoca"),
        base("1893/1285/2026", "acțiune în constatare", "Litigii cu profesioniștii", "Apel", "firma"),
        base("772/117/2026", "ordonanță de plată - OUG 5/2001", "Civil", "Fond", "firma"),
        base("5510/211/2026", "contestație la titlu", "Civil", "Fond", "administrator", "Judecătoria Cluj-Napoca"),
      ];
    case "critical":
      return [
        base("2231/1285/2026", "procedura insolvenței - societăți cu răspundere limitată", "Faliment", "Fond", "firma"),
        base("4127/211/2025", "pretenții", "Civil", "Fond", "firma", "Judecătoria Cluj-Napoca"),
      ];
  }
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

function buildResult(
  input: CheckPortalJustInput,
  cases: CourtCase[],
  source: LegalCheckResult["source"],
  message: string,
): LegalCheckResult {
  const isFallback = source === "fallback";
  const scored = scoreLegalCases(cases);
  return {
    query: { companyName: input.companyName, ceoName: input.ceoName },
    source,
    isFallback,
    isSimulated: source === "simulation",
    cases,
    totalFound: cases.length,
    criticalCount: scored.criticalCount,
    legalScore: isFallback ? FALLBACK_LEGAL_SCORE : scored.legalScore,
    integrityKillSwitch: isFallback ? false : scored.integrityKillSwitch,
    message,
    checkedAt: new Date().toISOString(),
  };
}

export async function checkPortalJust(input: CheckPortalJustInput): Promise<LegalCheckResult> {
  const companyName = input.companyName.trim();
  const ceoName = input.ceoName.trim();
  const clean = { ...input, companyName, ceoName };

  if (input.simulationMode) {
    const scenario = input.simulationScenario ?? "clean";
    // Small delay so the demo shows the loading state.
    await new Promise((r) => setTimeout(r, 900));
    return buildResult(
      clean,
      simulatedCases(scenario, companyName, ceoName),
      "simulation",
      `Mod Simulare Portal Just — scenariu „${scenario}”. Datele nu provin de la portal.just.ro.`,
    );
  }

  try {
    const queries: Promise<CourtCase[]>[] = [];
    if (companyName) queries.push(queryPortal(companyName, "firma"));
    if (ceoName) queries.push(queryPortal(ceoName, "administrator"));
    const results = (await Promise.all(queries)).flat();

    // Deduplicate cases found by both company and administrator name.
    const unique = new Map<string, CourtCase>();
    for (const c of results) {
      const key = `${c.numar}|${c.institutie}`;
      if (!unique.has(key)) unique.set(key, c);
    }
    const cases = [...unique.values()];
    return buildResult(
      clean,
      cases,
      "portal.just.ro",
      cases.length === 0
        ? "0 litigii identificate pe portal.just.ro."
        : `${cases.length} dosare identificate pe portal.just.ro.`,
    );
  } catch (err) {
    const reason =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
        ? `serverul nu a răspuns în ${TIMEOUT_MS / 1000} secunde`
        : err instanceof Error
          ? err.message
          : "eroare necunoscută";
    return buildResult(
      clean,
      [],
      "fallback",
      `portal.just.ro indisponibil (${reason}). S-a aplicat un punctaj neutru de ${FALLBACK_LEGAL_SCORE}/100 până la re-verificare.`,
    );
  }
}
