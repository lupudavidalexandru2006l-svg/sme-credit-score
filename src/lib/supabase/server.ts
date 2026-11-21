/**
 * Server-side Supabase access. Optional: without env vars the app runs in
 * "local" mode on the synthetic generator and nothing is persisted.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Company, Dataset, Invoice } from "@/types/scoring";
import { DEMO_COMPANY, syntheticDataset } from "@/lib/data/synthetic";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

// ---- Row mappers --------------------------------------------------------------

interface CompanyRow {
  id: string;
  name: string;
  cui: string;
  caen_code: string;
  ceo_name: string | null;
  city: string | null;
  monthly_fixed_costs: number | string;
  existing_monthly_debt_service: number | string;
}

interface InvoiceRow {
  id: string;
  company_id: string;
  number: string;
  direction: Invoice["direction"];
  invoice_type_code: string;
  issue_date: string;
  due_date: string | null;
  supplier_name: string | null;
  supplier_cui: string | null;
  customer_name: string | null;
  customer_cui: string | null;
  tax_exclusive_amount: number | string;
  payable_amount: number | string | null;
  currency: string;
  paid_date: string | null;
  source: Invoice["source"];
  raw_xml?: string | null;
}

export const companyFromRow = (r: CompanyRow): Company => ({
  id: r.id,
  name: r.name,
  cui: r.cui,
  caenCode: r.caen_code,
  ceoName: r.ceo_name ?? "",
  city: r.city ?? "",
  monthlyFixedCosts: Number(r.monthly_fixed_costs),
  existingMonthlyDebtService: Number(r.existing_monthly_debt_service),
});

export const invoiceFromRow = (r: InvoiceRow): Invoice => ({
  id: r.id,
  number: r.number,
  direction: r.direction,
  typeCode: r.invoice_type_code,
  issueDate: r.issue_date,
  dueDate: r.due_date,
  supplierName: r.supplier_name ?? "",
  supplierCui: r.supplier_cui ?? "",
  customerName: r.customer_name ?? "",
  customerCui: r.customer_cui ?? "",
  taxExclusiveAmount: Number(r.tax_exclusive_amount),
  payableAmount: Number(r.payable_amount ?? r.tax_exclusive_amount),
  currency: r.currency,
  paidDate: r.paid_date,
  source: r.source,
});

export const invoiceToRow = (inv: Invoice, companyId: string, rawXml?: string): InvoiceRow => ({
  id: inv.id,
  company_id: companyId,
  number: inv.number,
  direction: inv.direction,
  invoice_type_code: inv.typeCode,
  issue_date: inv.issueDate,
  due_date: inv.dueDate,
  supplier_name: inv.supplierName,
  supplier_cui: inv.supplierCui,
  customer_name: inv.customerName,
  customer_cui: inv.customerCui,
  tax_exclusive_amount: inv.taxExclusiveAmount,
  payable_amount: inv.payableAmount,
  currency: inv.currency,
  paid_date: inv.paidDate,
  source: inv.source,
  raw_xml: rawXml ?? null,
});

// ---- Queries --------------------------------------------------------------------

export async function findCompany(sb: SupabaseClient, cui: string) {
  const { data, error } = await sb.from("companies").select("*").eq("cui", cui).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? companyFromRow(data as CompanyRow) : null;
}

/** Company + invoices from Supabase, or the synthetic dataset when Supabase is absent/empty. */
export async function loadDataset(cui = DEMO_COMPANY.cui): Promise<Dataset & { supabase: { configured: boolean; error?: string } }> {
  const sb = getSupabase();
  if (!sb) return { ...syntheticDataset(), supabase: { configured: false } };
  try {
    const company = await findCompany(sb, cui);
    if (!company) {
      return { ...syntheticDataset(), supabase: { configured: true, error: `Firma ${cui} nu există în Supabase — rulează supabase/seed.sql.` } };
    }
    const invoices: Invoice[] = [];
    // PostgREST returns max 1000 rows per request: page through.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("e_invoices")
        .select("id, company_id, number, direction, invoice_type_code, issue_date, due_date, supplier_name, supplier_cui, customer_name, customer_cui, tax_exclusive_amount, payable_amount, currency, paid_date, source")
        .eq("company_id", company.id)
        .order("issue_date")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      invoices.push(...(data as InvoiceRow[]).map(invoiceFromRow));
      if (data.length < 1000) break;
    }
    return { source: "supabase", company, invoices, supabase: { configured: true } };
  } catch (e) {
    return { ...syntheticDataset(), supabase: { configured: true, error: e instanceof Error ? e.message : "eroare Supabase" } };
  }
}
