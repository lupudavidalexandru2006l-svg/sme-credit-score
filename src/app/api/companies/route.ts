import { connection, NextResponse, type NextRequest } from "next/server";
import { getSupabase, listCompanies, upsertCompany, type UpsertCompanyInput } from "@/lib/supabase/server";

/** GET /api/companies — every saved company (none is ever deleted), oldest first. */
export async function GET() {
  await connection();
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ supabase: { configured: false }, companies: [] });
  try {
    return NextResponse.json({ supabase: { configured: true }, companies: await listCompanies(sb) });
  } catch (e) {
    return NextResponse.json({ supabase: { configured: true, error: e instanceof Error ? e.message : "eroare Supabase" }, companies: [] });
  }
}

/**
 * POST /api/companies — step 1 "save company".
 * Body: { name, ceoName, cui?, caenCode?, sector?, id? }. Name and CEO are required; CUI and CAEN are optional.
 * Finds the company by CUI (if given) or by normalized name; creates it otherwise and
 * returns it with no invoices: only uploaded e-Factura XML adds them (no invented history).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<UpsertCompanyInput> | null;
  const name = body?.name?.trim() ?? "";
  const ceoName = body?.ceoName?.trim() ?? "";
  if (!name || !ceoName) {
    return NextResponse.json({ ok: false, error: "Numele firmei și numele administratorului sunt obligatorii." }, { status: 400 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, mode: "local", message: "Supabase neconfigurat — firma se salvează doar în browser." });
  try {
    const r = await upsertCompany(sb, { ...body, name, ceoName });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "eroare Supabase" }, { status: 500 });
  }
}
