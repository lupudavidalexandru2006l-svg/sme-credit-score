import { connection, NextResponse, type NextRequest } from "next/server";
import { loadDataset } from "@/lib/supabase/server";

/** GET /api/dataset?cui=RO45127893 — company + 12-month e-Factura history (Supabase or synthetic). */
export async function GET(request: NextRequest) {
  await connection();
  const cui = request.nextUrl.searchParams.get("cui") ?? undefined;
  return NextResponse.json(await loadDataset(cui));
}
