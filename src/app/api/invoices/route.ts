import { NextResponse, type NextRequest } from "next/server";
import type { Invoice } from "@/types/scoring";
import { findCompany, getSupabase, invoiceToRow } from "@/lib/supabase/server";

interface Body {
  companyCui: string;
  invoices: Invoice[];
  /** Original XML per invoice id, stored for audit. */
  rawXml?: Record<string, string>;
}

/** POST /api/invoices — persist invoices parsed from uploaded e-Factura XML. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  if (!body?.companyCui || !Array.isArray(body.invoices)) {
    return NextResponse.json({ persisted: false, error: "Body invalid: companyCui și invoices[] sunt obligatorii." }, { status: 400 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false, mode: "local", message: "Supabase neconfigurat — datele rămân doar în browser." });

  try {
    const company = await findCompany(sb, body.companyCui);
    if (!company) return NextResponse.json({ persisted: false, error: `Firma ${body.companyCui} nu există în Supabase.` }, { status: 404 });
    const rows = body.invoices.map((inv) => invoiceToRow({ ...inv, source: "xml-upload" }, company.id, body.rawXml?.[inv.id]));
    const { error } = await sb.from("e_invoices").upsert(rows, { onConflict: "company_id,id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ persisted: true, count: rows.length });
  } catch (e) {
    return NextResponse.json({ persisted: false, error: e instanceof Error ? e.message : "eroare Supabase" }, { status: 500 });
  }
}

/** DELETE /api/invoices?cui=... — remove uploaded XML invoices (demo reset). */
export async function DELETE(request: NextRequest) {
  const cui = request.nextUrl.searchParams.get("cui");
  const sb = getSupabase();
  if (!sb || !cui) return NextResponse.json({ deleted: false, mode: "local" });
  const company = await findCompany(sb, cui).catch(() => null);
  if (!company) return NextResponse.json({ deleted: false });
  const { error } = await sb.from("e_invoices").delete().eq("company_id", company.id).eq("source", "xml-upload");
  return NextResponse.json({ deleted: !error, error: error?.message });
}
