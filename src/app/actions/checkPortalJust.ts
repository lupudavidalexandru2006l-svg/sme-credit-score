"use server";

import { XMLParser } from "fast-xml-parser";
import type {
  CourtCase,
  CourtHearing,
  LegalCheckResult,
  PortalSimulationScenario,
} from "@/types/scoring";
import { analyzeCase, FALLBACK_LEGAL_SCORE, partyNameExact, scoreLegalCases } from "@/lib/scoringEngine";

const ENDPOINT = "http://portalquery.just.ro/Query.asmx";
const SOAP_ACTION = "portalquery.just.ro/CautareDosare";
// Common names return ~17 MB (1000 cases) and take 5+ seconds.
const TIMEOUT_MS = 15_000;
const MAX_CASES_PER_QUERY = 50;
/** portal.just.ro never returns more than this many cases per search. */
const PORTAL_RESULT_LIMIT = 1000;

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
  isArray: (name) => name === "Dosar" || name === "DosarParte" || name === "DosarSedinta",
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
  sedinte?: {
    DosarSedinta?: { data?: unknown; solutie?: unknown; solutieSumar?: unknown; documentSedinta?: unknown }[];
  };
}

export interface ParsedPortalResponse {
  cases: CourtCase[];
  /** Cases returned by the portal where no party has exactly the searched name. */
  excluded: number;
  /** Portal hit its 1000-result limit: exact matches beyond it are not visible. */
  truncated: boolean;
}

/**
 * Parses a CautareDosare SOAP response into CourtCase objects.
 * Keeps ONLY cases where a party has exactly the searched full name.
 */
export async function parseCautareDosareXml(
  xml: string,
  matchedBy: CourtCase["matchedBy"],
  searchedName = "",
): Promise<ParsedPortalResponse> {
  const doc = parser.parse(xml);
  const body = doc?.Envelope?.Body;
  if (body?.Fault) throw new Error(`SOAP Fault: ${str(body.Fault.faultstring)}`);
  const dosare: RawDosar[] = body?.CautareDosareResponse?.CautareDosareResult?.Dosar ?? [];
  const nameType = matchedBy === "firma" ? "firma" : "persoana";

  const cases: CourtCase[] = [];
  let excluded = 0;
  for (const d of dosare) {
    const parti = d.parti?.DosarParte ?? [];
    const isMe = (p: { nume?: unknown }) => partyNameExact(str(p.nume), searchedName, nameType);
    const mine = parti.filter(isMe);
    if (mine.length === 0) {
      excluded++;
      continue;
    }
    if (cases.length >= MAX_CASES_PER_QUERY) continue;

    const obiect = str(d.obiect);
    const categorie = str(d.categorieCazNume || d.categorieCaz);
    const stadiu = str(d.stadiuProcesualNume || d.stadiuProcesual);
    const partyRoles = mine.map((p) => str(p.calitateParte).replace(/\s+/g, " ").trim()).filter(Boolean);
    const hearings: CourtHearing[] = (d.sedinte?.DosarSedinta ?? []).map((h) => ({
      data: str(h.data),
      solutie: str(h.solutie),
      solutieSumar: str(h.solutieSumar),
      documentSedinta: str(h.documentSedinta),
    }));
    const analysis = analyzeCase({ obiect, categorie, stadiu, partyRoles, hearings, searchedName });
    // Searched party first so it is visible in the UI.
    const sortedParti = [...mine, ...parti.filter((p) => !isMe(p))];
    cases.push({
      numar: str(d.numar),
      institutie: str(d.institutie).replace(/([a-z])([A-Z])/g, "$1 $2"),
      data: str(d.data).slice(0, 10),
      obiect,
      categorie,
      stadiu,
      parti: sortedParti
        .slice(0, 6)
        .map((p) => `${str(p.nume)}${p.calitateParte ? ` (${str(p.calitateParte)})` : ""}`),
      matchedBy,
      partyRoles,
      ...analysis,
    });
  }
  return { cases, excluded, truncated: dosare.length >= PORTAL_RESULT_LIMIT };
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

interface SimCase {
  numar: string;
  obiect: string;
  categorie: string;
  stadiu: string;
  matchedBy: CourtCase["matchedBy"];
  role: string;
  institutie: string;
  /** [date, solutie, solutieSumar]; "{nume}" is replaced with the searched name. */
  hearings: [string, string, string][];
}

const SIM_CASES: Record<PortalSimulationScenario, SimCase[]> = {
  clean: [],
  minor: [
    {
      numar: "5194/211/2025",
      obiect: "plângere contravenţională P.V. seria PBW nr. 794840",
      categorie: "Civil",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Petent",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [
        ["2025-11-04", "Respinge plângerea", "Respinge ca neîntemeiată plângerea formulată de petentul {nume} împotriva procesului-verbal. Cu drept de apel în 30 de zile."],
      ],
    },
    {
      numar: "6724/211/2025",
      obiect: "anulare proces verbal de contravenţie",
      categorie: "Civil",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Petent",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [["2025-09-16", "Admite plângerea", "Admite plângerea formulată de petentul {nume}. Anulează procesul-verbal de contravenţie. Definitivă."]],
    },
    {
      numar: "4127/211/2026",
      obiect: "pretenţii",
      categorie: "Civil",
      stadiu: "Fond",
      matchedBy: "firma",
      role: "Pârât",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [
        ["2027-01-20", "", ""],
        ["2026-10-14", "Amână cauza", "Pentru lipsă de procedură."],
      ],
    },
  ],
  many: [
    {
      numar: "1893/1285/2025",
      obiect: "pretenţii",
      categorie: "Litigii cu profesioniştii",
      stadiu: "Fond",
      matchedBy: "firma",
      role: "Pârât",
      institutie: "Tribunalul Cluj",
      hearings: [
        ["2026-04-08", "Admite cererea", "Admite cererea formulată de reclamanta SC Exemplu Partener SRL. Obligă pârâta {nume} la plata sumei de 48.200 lei. Cu drept de apel."],
      ],
    },
    {
      numar: "772/211/2026",
      obiect: "contestaţie la executare",
      categorie: "Civil",
      stadiu: "Fond",
      matchedBy: "firma",
      role: "Contestator",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [["2026-06-02", "Respinge cererea", "Respinge contestaţia la executare formulată de contestatoarea {nume}, ca neîntemeiată. Definitivă."]],
    },
    {
      numar: "645/211/2024",
      obiect: "conducere fără permis (art.335 NCP)",
      categorie: "Penal",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Inculpat",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [
        ["2024-09-07", "Soluţionare", "În baza art. 83 Cod penal amână aplicarea pedepsei de 6 luni închisoare stabilite în sarcina inculpatului {nume} pe un termen de supraveghere de 2 ani. Definitivă."],
      ],
    },
    {
      numar: "3263/211/2023",
      obiect: "lovirea sau alte violenţe (art.193 NCP)",
      categorie: "Penal",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Inculpat",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [
        ["2023-10-25", "Încetat procesul penal", "În temeiul art. 396 alin. 6 C.proc.pen. încetează procesul penal faţă de inculpatul {nume} ca urmare a împăcării părţilor. Definitivă."],
      ],
    },
    {
      numar: "2210/211/2025",
      obiect: "înşelăciunea (art.244 NCP)",
      categorie: "Penal",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Inculpat",
      institutie: "Judecătoria Cluj-Napoca",
      hearings: [["2025-05-12", "Soluţionare", "În baza art. 396 alin. 5 C.proc.pen. achită pe inculpatul {nume}, întrucât fapta nu există. Definitivă."]],
    },
  ],
  critical: [
    {
      numar: "2231/1285/2026",
      obiect: "procedura insolvenţei - societăţi cu răspundere limitată",
      categorie: "Faliment",
      stadiu: "Fond",
      matchedBy: "firma",
      role: "Debitor",
      institutie: "Tribunalul Cluj",
      hearings: [["2026-07-01", "Admite cererea", "Admite cererea creditoarei. Deschide procedura generală de insolvenţă împotriva debitoarei {nume}."]],
    },
    {
      // Creditor in another company's insolvency: listed, but no impact.
      numar: "918/1285/2026",
      obiect: "procedura insolvenţei - SC Client Restanţier SRL",
      categorie: "Faliment",
      stadiu: "Fond",
      matchedBy: "firma",
      role: "Creditor",
      institutie: "Tribunalul Cluj",
      hearings: [["2027-02-10", "", ""]],
    },
    {
      numar: "29063/211/2025",
      obiect: "evaziune fiscală (Legea 241/2005 art. 9)",
      categorie: "Penal",
      stadiu: "Fond",
      matchedBy: "administrator",
      role: "Inculpat",
      institutie: "Tribunalul Cluj",
      hearings: [
        ["2027-01-15", "", ""],
        ["2026-11-02", "Amână cauza", "Pentru audierea martorilor."],
      ],
    },
  ],
};

function simulatedCases(scenario: PortalSimulationScenario, companyName: string, ceoName: string): CourtCase[] {
  return SIM_CASES[scenario]
    .filter((c) => (c.matchedBy === "firma" ? companyName : ceoName))
    .map((c) => {
      const nume = c.matchedBy === "firma" ? companyName : ceoName;
      const hearings: CourtHearing[] = c.hearings.map(([data, solutie, sumar]) => ({
        data: `${data}T00:00:00`,
        solutie,
        solutieSumar: sumar.replaceAll("{nume}", nume),
        documentSedinta: solutie && !/amân/i.test(solutie) ? "Hotarare" : "incheieredesedinta",
      }));
      const analysis = analyzeCase({
        obiect: c.obiect,
        categorie: c.categorie,
        stadiu: c.stadiu,
        partyRoles: [c.role],
        hearings,
        searchedName: nume,
      });
      return {
        numar: c.numar,
        institutie: c.institutie,
        data: hearings[hearings.length - 1]?.data.slice(0, 10) ?? "",
        obiect: c.obiect,
        categorie: c.categorie,
        stadiu: c.stadiu,
        parti: [`${nume} (${c.role})`, "SC Exemplu Partener SRL"],
        matchedBy: c.matchedBy,
        partyRoles: [c.role],
        ...analysis,
      };
    })
    .sort((x, y) => y.severity - x.severity || y.deduction - x.deduction);
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

function buildResult(
  input: CheckPortalJustInput,
  cases: CourtCase[],
  source: LegalCheckResult["source"],
  message: string,
  excludedCount = 0,
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
    excludedCount,
    criticalCount: scored.criticalCount,
    totalDeduction: isFallback ? 0 : scored.totalDeduction,
    minorCapApplied: !isFallback && scored.minorCapApplied,
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
    const queries: Promise<ParsedPortalResponse>[] = [];
    if (companyName) queries.push(queryPortal(companyName, "firma"));
    if (ceoName) queries.push(queryPortal(ceoName, "administrator"));
    const responses = await Promise.all(queries);
    const results = responses.flatMap((r) => r.cases);
    const excluded = responses.reduce((sum, r) => sum + r.excluded, 0);
    const truncated = responses.some((r) => r.truncated);

    // Deduplicate cases found by both company and administrator name.
    const unique = new Map<string, CourtCase>();
    for (const c of results) {
      const key = `${c.numar}|${c.institutie}`;
      if (!unique.has(key)) unique.set(key, c);
    }
    const cases = [...unique.values()].sort((x, y) => y.severity - x.severity || y.deduction - x.deduction);
    const parts = [cases.length === 0 ? "0 dosare pe numele exact." : `${cases.length} dosare pe numele exact.`];
    if (excluded > 0) {
      parts.push(
        `${excluded} dosare returnate de portal au fost excluse: conțin doar o parte din nume (alt prenume sau alt nume de familie).`,
      );
    }
    if (truncated) {
      parts.push("Numele este foarte comun: portalul s-a oprit la 1000 de rezultate, deci pot exista dosare nevăzute.");
    }
    if (cases.length > 0 && ceoName) {
      parts.push("Portalul nu publică CNP-ul: un dosar pe același nume complet poate aparține unei alte persoane (omonim).");
    }
    return buildResult(clean, cases, "portal.just.ro", parts.join(" "), excluded);
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
