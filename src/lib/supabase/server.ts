/**
 * Server-side Supabase access, multi-company. Optional: without env vars the app runs in
 * "local" mode (localStorage only) and nothing is persisted here. No invented data is ever written:
 * a new company starts with no invoices until real e-Factura XML is uploaded.
 *
 * Rules:
 *  - companies are never deleted; CUI and CAEN are optional (null in the DB);
 *  - a company is found by CUI when one is given, otherwise by name_key (normalized name);
 *  - every invoice / assessment / portal.just.ro check is linked to companies.id.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Company, Invoice, LegalCheckResult } from "@/types/scoring";
import { cleanPersonName, findExistingCompany, formatCui, isSameParty, normalizeCompanyName } from "@/lib/company";
import { cleanCaen, GENERAL_SECTOR, sectorForCaen } from "@/lib/data/benchmarks";
import { newCompanyRecord } from "@/lib/company";
import type { MultiSourceVerificationReport } from "@/lib/multi-source-verifier";
import { DEFAULT_BILLING, DEFAULT_PLAN, isBillingCycle, isPlanTier, type BillingCycle, type PlanTier, type SubscriptionStatus } from "@/lib/pricing";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export interface SupabaseStatus {
  configured: boolean;
  error?: string;
}

// ---- Row mappers --------------------------------------------------------------

interface CompanyRow {
  id: string;
  name: string;
  name_key: string;
  cui: string | null;
  caen_code: string | null;
  sector: string | null;
  ceo_name: string | null;
  city: string | null;
  county: string | null;
  monthly_fixed_costs: number | string;
  existing_monthly_debt_service: number | string;
  financials_declared?: boolean | null;
  debts?: Company["debts"] | null;
  official_name?: string | null;
  created_at?: string;
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
  company_name_raw?: string | null;
  tax_exclusive_amount: number | string;
  payable_amount: number | string | null;
  currency: string;
  paid_date: string | null;
  source: Invoice["source"];
  raw_xml?: string | null;
}

const COMPANY_COLUMNS =
  "id, name, name_key, cui, caen_code, sector, ceo_name, city, county, monthly_fixed_costs, existing_monthly_debt_service, financials_declared, debts, official_name, created_at";
const INVOICE_COLUMNS =
  "id, company_id, number, direction, invoice_type_code, issue_date, due_date, supplier_name, supplier_cui, customer_name, customer_cui, tax_exclusive_amount, payable_amount, currency, paid_date, source";

export const companyFromRow = (r: CompanyRow): Company => ({
  id: r.id,
  name: r.name,
  cui: r.cui ?? "",
  caenCode: r.caen_code ?? "",
  sector: r.sector ?? GENERAL_SECTOR,
  ceoName: r.ceo_name ?? "",
  city: r.city ?? "",
  county: r.county ?? undefined,
  monthlyFixedCosts: Number(r.monthly_fixed_costs),
  existingMonthlyDebtService: Number(r.existing_monthly_debt_service),
  financialsDeclared: Boolean(r.financials_declared),
  debts: Array.isArray(r.debts) ? r.debts : [],
  officialName: r.official_name ?? undefined,
  createdAt: r.created_at,
});

export const companyToRow = (c: Company): CompanyRow => ({
  id: c.id,
  name: c.name.trim(),
  name_key: normalizeCompanyName(c.name),
  cui: formatCui(c.cui) || null,
  caen_code: cleanCaen(c.caenCode) || null,
  sector: sectorForCaen(c.caenCode) ?? c.sector ?? GENERAL_SECTOR,
  ceo_name: cleanPersonName(c.ceoName),
  city: c.city || null,
  county: c.county ?? null,
  monthly_fixed_costs: c.monthlyFixedCosts,
  existing_monthly_debt_service: c.existingMonthlyDebtService,
  financials_declared: Boolean(c.financialsDeclared),
  debts: c.debts ?? [],
  official_name: c.officialName ?? null,
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

export const invoiceToRow = (inv: Invoice, company: Company, rawXml?: string): InvoiceRow => ({
  id: inv.id,
  company_id: company.id,
  number: inv.number,
  direction: inv.direction,
  invoice_type_code: inv.typeCode,
  issue_date: inv.issueDate,
  due_date: inv.dueDate,
  supplier_name: inv.supplierName,
  supplier_cui: inv.supplierCui,
  customer_name: inv.customerName,
  customer_cui: inv.customerCui,
  company_name_raw: inv.direction === "issued" ? inv.supplierName : isSameParty({ name: inv.customerName, cui: inv.customerCui }, company) ? inv.customerName : null,
  tax_exclusive_amount: inv.taxExclusiveAmount,
  payable_amount: inv.payableAmount,
  currency: inv.currency,
  paid_date: inv.paidDate,
  source: inv.source,
  raw_xml: rawXml ?? null,
});

// ---- Companies --------------------------------------------------------------------

export async function listCompanies(sb: SupabaseClient): Promise<Company[]> {
  const { data, error } = await sb.from("companies").select(COMPANY_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as CompanyRow[]).map(companyFromRow);
}

export async function findCompanyById(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? companyFromRow(data as CompanyRow) : null;
}

/** By CUI when one is given, otherwise by normalized name (case-insensitive, without SRL/SC/diacritics). */
export async function findCompanyByIdentity(sb: SupabaseClient, draft: Pick<Company, "name" | "cui">) {
  const cui = formatCui(draft.cui);
  if (cui) {
    const { data, error } = await sb.from("companies").select(COMPANY_COLUMNS).eq("cui", cui).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return companyFromRow(data as CompanyRow);
  }
  const { data, error } = await sb.from("companies").select(COMPANY_COLUMNS).eq("name_key", normalizeCompanyName(draft.name));
  if (error) throw new Error(error.message);
  return findExistingCompany((data as CompanyRow[]).map(companyFromRow), draft) ?? null;
}

/** Legacy lookup used by the external quiz webhook: `ref` is a company id or a CUI. */
export async function findCompany(sb: SupabaseClient, ref: string) {
  if (/^[0-9a-f-]{36}$/i.test(ref)) return findCompanyById(sb, ref);
  return findCompanyByIdentity(sb, { name: "", cui: ref });
}

export interface UpsertCompanyInput {
  id?: string;
  name: string;
  cui?: string;
  caenCode?: string;
  sector?: string;
  ceoName: string;
  county?: string;
}

/**
 * Step 1 "save company": returns the existing company (same CUI, or same normalized name)
 * with its optional fields completed, or creates a new one. Never deletes anything.
 * A new company starts empty: its invoices come only from uploaded e-Factura XML.
 */
export async function upsertCompany(sb: SupabaseClient, input: UpsertCompanyInput) {
  const draft = { name: input.name.trim(), cui: formatCui(input.cui) };
  const existing = input.id ? await findCompanyById(sb, input.id) : await findCompanyByIdentity(sb, draft);

  if (existing) {
    const merged: Company = {
      ...existing,
      // The typed name may differ in form only ("SC X SRL" vs "X S.R.L."): keep the stored one unless renamed on purpose.
      name: input.id ? draft.name || existing.name : existing.name,
      cui: draft.cui || existing.cui,
      caenCode: cleanCaen(input.caenCode) || existing.caenCode,
      // An untouched "General IMM" default from the blank form must not overwrite a sector chosen earlier.
      sector: input.sector && input.sector !== GENERAL_SECTOR ? input.sector : existing.sector || input.sector,
      ceoName: cleanPersonName(input.ceoName) || existing.ceoName,
      county: input.county ?? existing.county,
    };
    const { error } = await sb
      .from("companies")
      .update({ ...companyToRow(merged), updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { company: merged, created: false };
  }

  const company = newCompanyRecord({
    id: input.id ?? crypto.randomUUID(),
    name: draft.name,
    cui: draft.cui,
    caenCode: cleanCaen(input.caenCode),
    sector: sectorForCaen(input.caenCode) ?? input.sector ?? GENERAL_SECTOR,
    ceoName: cleanPersonName(input.ceoName),
    county: input.county,
  });
  const { data, error } = await sb.from("companies").insert(companyToRow(company)).select(COMPANY_COLUMNS).single();
  if (error) throw new Error(error.message);
  return { company: companyFromRow(data as CompanyRow), created: true };
}

/** Makes sure a company created in local mode exists in Supabase before linking rows to it. */
export async function ensureCompany(sb: SupabaseClient, company: Company) {
  const found = (await findCompanyById(sb, company.id)) ?? (await findCompanyByIdentity(sb, company));
  if (found) return found;
  const { data, error } = await sb.from("companies").insert(companyToRow(company)).select(COMPANY_COLUMNS).single();
  if (error) throw new Error(error.message);
  return companyFromRow(data as CompanyRow);
}

// ---- Invoices / dataset -------------------------------------------------------------

export async function loadInvoices(sb: SupabaseClient, companyId: string) {
  const invoices: Invoice[] = [];
  // PostgREST returns max 1000 rows per request: page through.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("e_invoices")
      .select(INVOICE_COLUMNS)
      .eq("company_id", companyId)
      .order("issue_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    invoices.push(...(data as InvoiceRow[]).map(invoiceFromRow));
    if (data.length < 1000) break;
  }
  return invoices;
}

/**
 * Company + ONLY its invoices (filtered by company_id). Never falls back to invented data:
 * without Supabase, or for an unknown company, the invoice list is empty (found = false).
 */
export async function loadDataset(companyId: string): Promise<{ source: "supabase" | "local"; company: Company | null; invoices: Invoice[]; supabase: SupabaseStatus; found: boolean }> {
  const sb = getSupabase();
  if (!sb) return { source: "local", company: null, invoices: [], supabase: { configured: false }, found: false };
  try {
    const company = await findCompany(sb, companyId);
    if (!company) return { source: "supabase", company: null, invoices: [], supabase: { configured: true }, found: false };
    return { source: "supabase", company, invoices: await loadInvoices(sb, company.id), supabase: { configured: true }, found: true };
  } catch (e) {
    return { source: "local", company: null, invoices: [], supabase: { configured: true, error: e instanceof Error ? e.message : "eroare Supabase" }, found: false };
  }
}

// ---- portal.just.ro history -----------------------------------------------------------

export async function saveLegalCheck(sb: SupabaseClient, company: Company, r: LegalCheckResult) {
  const { error } = await sb.from("legal_checks").insert({
    company_id: company.id,
    company_name: r.query.companyName,
    ceo_name: r.query.ceoName,
    source: r.source,
    legal_score: r.legalScore,
    total_found: r.totalFound,
    critical_count: r.criticalCount,
    result: r,
    checked_at: r.checkedAt,
  });
  if (error) throw new Error(error.message);
}

// ---- Multi-source verification history -------------------------------------------------

export async function saveVerificationReport(sb: SupabaseClient, company: Company, r: MultiSourceVerificationReport) {
  const { error } = await sb.from("verification_reports").insert({
    company_id: company.id,
    company_name: r.companyName,
    cui: r.cui ?? null,
    ceo_name: r.ceoName,
    aggregate_score: r.aggregateScore,
    has_critical_flag: r.hasCriticalFlag,
    live_sources: r.sources.filter((s) => s.score !== null).length,
    sources: r.sources,
    checked_at: r.checkedAt,
  });
  if (error) throw new Error(error.message);
}

// ---- Subscriptions (plan per company) --------------------------------------------------

export interface SubscriptionRecord {
  companyId: string;
  planTier: PlanTier;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  updatedAt: string | null;
}

/** The company's plan; a company without a subscription row is on the free Starter plan. */
export async function getSubscription(sb: SupabaseClient, companyId: string): Promise<SubscriptionRecord> {
  const { data, error } = await sb.from("subscriptions").select("company_id, plan_tier, billing_cycle, status, updated_at").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { plan_tier: string; billing_cycle: string; status: string; updated_at: string } | null;
  return {
    companyId,
    planTier: isPlanTier(row?.plan_tier) ? row.plan_tier : DEFAULT_PLAN,
    billingCycle: isBillingCycle(row?.billing_cycle) ? row.billing_cycle : DEFAULT_BILLING,
    status: row?.status === "trialing" || row?.status === "canceled" ? row.status : "active",
    updatedAt: row?.updated_at ?? null,
  };
}

/** Simulated checkout ("Mod Demo Hackathon"): upserts the subscription and mirrors it on companies. */
export async function setSubscription(sb: SupabaseClient, company: Company, planTier: PlanTier, billingCycle: BillingCycle): Promise<SubscriptionRecord> {
  const updatedAt = new Date().toISOString();
  const { error } = await sb
    .from("subscriptions")
    .upsert({ company_id: company.id, plan_tier: planTier, billing_cycle: billingCycle, status: "active", provider: "demo", updated_at: updatedAt }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
  const mirror = await sb.from("companies").update({ plan_tier: planTier, billing_cycle: billingCycle, updated_at: updatedAt }).eq("id", company.id);
  if (mirror.error) throw new Error(mirror.error.message);
  return { companyId: company.id, planTier, billingCycle, status: "active", updatedAt };
}

// ---- B2B leads ------------------------------------------------------------------------

export interface B2bLeadInput {
  fullName: string;
  organization: string;
  email: string;
  phone?: string;
  message?: string;
}

export async function saveB2bLead(sb: SupabaseClient, lead: B2bLeadInput) {
  const { data, error } = await sb
    .from("b2b_leads")
    .insert({ full_name: lead.fullName, organization: lead.organization, email: lead.email, phone: lead.phone || null, message: lead.message || null })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; created_at: string };
}
