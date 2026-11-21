"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Company,
  Dataset,
  InvestmentInput,
  Invoice,
  LegalCheckResult,
  PortalSimulationScenario,
  QuizAnswers,
} from "@/types/scoring";
import { computeAssessment, type Assessment } from "@/lib/assessment";
import { syntheticDataset } from "@/lib/data/synthetic";
import { parseEFacturaXml, type ParseResult } from "@/lib/efactura/parser";
import { checkPortalJust } from "@/app/actions/checkPortalJust";

export const EMPTY_QUIZ: QuizAnswers = {
  revenueEstimate: null,
  paymentTerm: null,
  topClientShare: null,
  mainSupplier: null,
  hasSignificantCreditNotes: null,
};
export const EMPTY_INVESTMENT: InvestmentInput = { purpose: null, ownContributionPct: null, requestedAmount: null };

/** Realistic demo answers: a manager who knows the numbers well (but not perfectly). */
export const DEMO_QUIZ: QuizAnswers = {
  revenueEstimate: 2_000_000,
  paymentTerm: "30",
  topClientShare: "15-30",
  mainSupplier: "Lactate Transilvania SRL",
  hasSignificantCreditNotes: false,
};
export const DEMO_INVESTMENT: InvestmentInput = { purpose: "growth", ownContributionPct: 15, requestedAmount: 900_000 };

export type StepId = "onboarding" | "analiza" | "investitie" | "profil";

export interface ScoreToast {
  id: number;
  from: number;
  to: number;
  title: string;
  detail: string;
}

export type LegalMode = { kind: "live" } | { kind: "simulation"; scenario: PortalSimulationScenario };

interface Persisted {
  company?: Partial<Company>;
  uploads?: Invoice[];
  quiz?: QuizAnswers;
  investment?: InvestmentInput;
  legal?: LegalCheckResult | null;
  visited?: StepId[];
}

const STORAGE_KEY = "credit-ready-v2";

function readStorage(): Persisted {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

interface Ctx {
  company: Company;
  setCompany: (patch: Partial<Company>) => void;
  dataset: Dataset;
  supabase: { configured: boolean; error?: string } | null;
  invoices: Invoice[];
  uploads: Invoice[];
  quiz: QuizAnswers;
  setQuiz: (patch: Partial<QuizAnswers>) => void;
  investment: InvestmentInput;
  setInvestment: (patch: Partial<InvestmentInput>) => void;
  legal: LegalCheckResult | null;
  legalLoading: boolean;
  runLegalCheck: (mode?: LegalMode) => Promise<void>;
  assessment: Assessment;
  uploadXml: (files: { name: string; xml: string }[]) => Promise<ParseResult[]>;
  lastUploadResults: ParseResult[];
  persistMessage: string | null;
  resetUploads: () => void;
  loadDemo: () => void;
  resetAll: () => void;
  toast: ScoreToast | null;
  dismissToast: () => void;
  visited: StepId[];
  markVisited: (s: StepId) => void;
  hydrated: boolean;
}

const AssessmentContext = createContext<Ctx | null>(null);

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error("useAssessment must be used inside <AssessmentProvider>");
  return ctx;
}

const mergeInvoices = (base: Invoice[], uploads: Invoice[]) => {
  const ids = new Set(uploads.map((u) => u.id));
  return [...base.filter((i) => !ids.has(i.id)), ...uploads];
};

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(() => syntheticDataset());
  const [supabase, setSupabase] = useState<Ctx["supabase"]>(null);
  const [company, setCompanyState] = useState<Company>(() => syntheticDataset().company);
  const [uploads, setUploads] = useState<Invoice[]>([]);
  const [quiz, setQuizState] = useState<QuizAnswers>(EMPTY_QUIZ);
  const [investment, setInvestmentState] = useState<InvestmentInput>(EMPTY_INVESTMENT);
  const [legal, setLegal] = useState<LegalCheckResult | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [toast, setToast] = useState<ScoreToast | null>(null);
  const [lastUploadResults, setLastUploadResults] = useState<ParseResult[]>([]);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [visited, setVisited] = useState<StepId[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const autoChecked = useRef(false);

  const invoices = useMemo(() => mergeInvoices(dataset.invoices, uploads), [dataset.invoices, uploads]);
  const assessment = useMemo(
    () => computeAssessment({ company, invoices, quiz, investment, legal }),
    [company, invoices, quiz, investment, legal],
  );

  // --- Restore local state, then load the dataset (Supabase or synthetic) ----------
  useEffect(() => {
    const saved = readStorage();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration */
    if (saved.company) setCompanyState((c) => ({ ...c, ...saved.company }));
    if (saved.uploads) setUploads(saved.uploads);
    if (saved.quiz) setQuizState(saved.quiz);
    if (saved.investment) setInvestmentState(saved.investment);
    if (saved.legal) setLegal(saved.legal);
    if (saved.visited) setVisited(saved.visited);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const cui = saved.company?.cui ?? syntheticDataset().company.cui;
    fetch(`/api/dataset?cui=${encodeURIComponent(cui)}`)
      .then((r) => r.json())
      .then((d: Dataset & { supabase: { configured: boolean; error?: string } }) => {
        setSupabase(d.supabase);
        if (d.source === "supabase") {
          setDataset({ source: d.source, company: d.company, invoices: d.invoices });
          // Saved form edits (name, CUI, CAEN, CEO) win over the stored record.
          setCompanyState({ ...d.company, ...saved.company });
        }
      })
      .catch(() => setSupabase({ configured: false, error: "API indisponibil" }));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: Persisted = {
        company: { name: company.name, cui: company.cui, caenCode: company.caenCode, ceoName: company.ceoName },
        uploads,
        quiz,
        investment,
        legal,
        visited,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: state simply is not remembered */
    }
  }, [hydrated, company, uploads, quiz, investment, legal, visited]);

  // --- Mutators -----------------------------------------------------------------------
  const setCompany = useCallback((patch: Partial<Company>) => setCompanyState((c) => ({ ...c, ...patch })), []);
  const setQuiz = useCallback((patch: Partial<QuizAnswers>) => setQuizState((q) => ({ ...q, ...patch })), []);
  const setInvestment = useCallback((patch: Partial<InvestmentInput>) => setInvestmentState((i) => ({ ...i, ...patch })), []);
  const markVisited = useCallback((s: StepId) => setVisited((v) => (v.includes(s) ? v : [...v, s])), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((from: number, to: number, title: string, detail: string) => {
    const id = Date.now();
    setToast({ id, from, to, title, detail });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 9000);
  }, []);

  const runLegalCheck = useCallback(
    async (mode: LegalMode = { kind: "live" }) => {
      setLegalLoading(true);
      try {
        const res = await checkPortalJust({
          companyName: company.name,
          ceoName: company.ceoName,
          simulationMode: mode.kind === "simulation",
          simulationScenario: mode.kind === "simulation" ? mode.scenario : undefined,
        });
        setLegal(res);
      } finally {
        setLegalLoading(false);
      }
    },
    [company.name, company.ceoName],
  );

  // Automatic portal.just.ro check on first visit (live, with fallback inside the server action).
  useEffect(() => {
    if (!hydrated || autoChecked.current || legal) return;
    autoChecked.current = true;
    void runLegalCheck({ kind: "live" });
  }, [hydrated, legal, runLegalCheck]);

  const uploadXml = useCallback(
    async (files: { name: string; xml: string }[]) => {
      const results = files.map((f) => parseEFacturaXml(f.xml, f.name, company));
      setLastUploadResults(results);
      const parsed = results.filter((r) => r.ok && r.invoice).map((r) => r.invoice!);
      if (parsed.length === 0) return results;

      const nextUploads = mergeInvoices(uploads, parsed);
      const before = assessment.final.finalScore;
      const after = computeAssessment({ company, invoices: mergeInvoices(dataset.invoices, nextUploads), quiz, investment, legal }).final.finalScore;
      setUploads(nextUploads);
      const first = parsed[0];
      showToast(
        before,
        after,
        parsed.length === 1 ? `Factura ${first.number} procesată` : `${parsed.length} facturi procesate`,
        parsed.length === 1
          ? `${first.typeCode === "381" ? "Storno 381" : "Factură 380"} · ${first.direction === "issued" ? first.customerName : first.supplierName} · ${first.taxExclusiveAmount.toLocaleString("ro-RO")} RON fără TVA`
          : "Toți pilonii au fost recalculați.",
      );

      const rawXml = Object.fromEntries(results.filter((r) => r.ok && r.invoice).map((r) => [r.invoice!.id, files.find((f) => f.name === r.fileName)?.xml ?? ""]));
      fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyCui: company.cui, invoices: parsed, rawXml }),
      })
        .then((r) => r.json())
        .then((r: { persisted: boolean; count?: number; message?: string; error?: string }) =>
          setPersistMessage(r.persisted ? `Salvat în Supabase (${r.count} facturi).` : (r.error ?? r.message ?? "Nesalvat în Supabase.")),
        )
        .catch(() => setPersistMessage("Nesalvat: API indisponibil."));
      return results;
    },
    [assessment.final.finalScore, company, dataset.invoices, investment, legal, quiz, showToast, uploads],
  );

  const resetUploads = useCallback(() => {
    if (uploads.length === 0) return;
    const before = assessment.final.finalScore;
    const after = computeAssessment({ company, invoices: dataset.invoices, quiz, investment, legal }).final.finalScore;
    setUploads([]);
    setLastUploadResults([]);
    setPersistMessage(null);
    showToast(before, after, "Facturi încărcate eliminate", "S-a revenit la istoricul de 12 luni.");
    void fetch(`/api/invoices?cui=${encodeURIComponent(company.cui)}`, { method: "DELETE" }).catch(() => undefined);
  }, [assessment.final.finalScore, company, dataset.invoices, investment, legal, quiz, showToast, uploads.length]);

  const loadDemo = useCallback(() => {
    setQuizState(DEMO_QUIZ);
    setInvestmentState(DEMO_INVESTMENT);
  }, []);

  const resetAll = useCallback(() => {
    setQuizState(EMPTY_QUIZ);
    setInvestmentState(EMPTY_INVESTMENT);
    setUploads([]);
    setLastUploadResults([]);
    setVisited([]);
    setCompanyState(dataset.company);
    setLegal(null);
    autoChecked.current = false;
  }, [dataset.company]);

  const value: Ctx = {
    company,
    setCompany,
    dataset,
    supabase,
    invoices,
    uploads,
    quiz,
    setQuiz,
    investment,
    setInvestment,
    legal,
    legalLoading,
    runLegalCheck,
    assessment,
    uploadXml,
    lastUploadResults,
    persistMessage,
    resetUploads,
    loadDemo,
    resetAll,
    toast,
    dismissToast,
    visited,
    markVisited,
    hydrated,
  };

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}
