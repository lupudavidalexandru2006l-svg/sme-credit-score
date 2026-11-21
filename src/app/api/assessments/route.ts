import { NextResponse, type NextRequest } from "next/server";
import type { Company, InvestmentInput, Invoice, LegalCheckResult, QuizAnswers } from "@/types/scoring";
import { computeAssessment } from "@/lib/assessment";
import { findCompany, getSupabase, loadDataset } from "@/lib/supabase/server";

interface Body {
  company: Company;
  quiz: QuizAnswers;
  investment: InvestmentInput;
  legal: LegalCheckResult | null;
  /** Invoices uploaded in the browser (used when they are not persisted yet). */
  uploads?: Invoice[];
}

/**
 * POST /api/assessments — recompute the score SERVER-SIDE from the stored e-Factura
 * data (never trusting a client-side score) and save a snapshot.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ saved: false, mode: "local", message: "Supabase neconfigurat — evaluarea nu a fost salvată." });

  try {
    const company = await findCompany(sb, body.company.cui);
    if (!company) return NextResponse.json({ saved: false, error: `Firma ${body.company.cui} nu există în Supabase.` }, { status: 404 });
    const dataset = await loadDataset(company.cui);
    const known = new Set(dataset.invoices.map((i) => i.id));
    const invoices = [...dataset.invoices, ...(body.uploads ?? []).filter((u) => !known.has(u.id))];
    const a = computeAssessment({
      company: { ...company, caenCode: body.company.caenCode || company.caenCode },
      invoices,
      quiz: body.quiz,
      investment: body.investment,
      legal: body.legal,
    });
    const { data, error } = await sb
      .from("assessments")
      .insert({
        company_id: company.id,
        quiz_answers: body.quiz,
        quiz_score: a.quiz.total,
        quiz_source: "platform",
        investment: body.investment,
        legal_result: body.legal,
        legal_score: a.legalScore,
        s_business: a.business.score,
        s_uman: a.final.pillars.human.score,
        s_investitie: a.final.pillars.investment.score,
        final_score: a.final.finalScore,
        status: a.final.status,
        kill_switch: a.final.quizKillSwitch,
        metrics: { ...a.metrics, months: a.metrics.months },
        action_plan: a.plan,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ saved: true, id: data.id, createdAt: data.created_at, finalScore: a.final.finalScore });
  } catch (e) {
    return NextResponse.json({ saved: false, error: e instanceof Error ? e.message : "eroare Supabase" }, { status: 500 });
  }
}
