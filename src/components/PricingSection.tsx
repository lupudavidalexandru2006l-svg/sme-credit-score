"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Check, CircleCheck, LoaderCircle, Sparkles, X } from "lucide-react";
import { useAssessment } from "./AssessmentProvider";
import { Badge, Button, cx, Field, inputCls } from "./ui";
import {
  ENTERPRISE_OFFER,
  formatRon,
  PAY_PER_USE,
  payPerUseBreakdown,
  PLAN_TIERS,
  PLANS,
  priceBreakdown,
  yearlySavings,
  YEARLY_DISCOUNT_PCT,
  type BillingCycle,
  type PlanTier,
} from "@/lib/pricing";

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise max-h-[calc(100vh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-[24px] bg-white p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Închide" className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BillingToggle({ value, onChange }: { value: BillingCycle; onChange: (v: BillingCycle) => void }) {
  return (
    <div role="radiogroup" aria-label="Ciclu de facturare" className="inline-flex rounded-full border border-line bg-white/80 p-1">
      {(
        [
          ["monthly", "Plată Lunară"],
          ["yearly", `Plată Anuală (Economisești ${YEARLY_DISCOUNT_PCT}%)`],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cx("rounded-full px-4 py-2 text-sm font-medium transition-colors", value === v ? "bg-navy text-white" : "text-muted hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PlanCard({
  tier,
  cycle,
  active,
  onChoose,
}: {
  tier: PlanTier;
  cycle: BillingCycle;
  active: boolean;
  onChoose: () => void;
}) {
  const plan = PLANS[tier];
  const price = plan.price[cycle];
  const savings = yearlySavings(tier);
  return (
    <article
      className={cx(
        "relative flex flex-col rounded-[24px] bg-card p-6 shadow-card",
        plan.highlighted ? "border-2 border-emerald lg:-translate-y-2" : "border border-white/80",
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-emerald px-3 py-1 text-[11px] font-medium text-white">
          <Sparkles size={12} /> {plan.badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-medium tracking-tight text-ink">{plan.name}</h3>
        {active && <Badge tone="emerald">Plan activ</Badge>}
      </div>
      <p className="mt-1 min-h-[40px] text-xs leading-relaxed text-muted">{plan.subtitle}</p>

      <div key={`${tier}-${cycle}`} className="animate-rise mt-5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[40px] font-light leading-none tracking-tight text-ink">{price}</span>
          <span className="text-sm text-muted">RON / lună</span>
        </p>
        <p className="mt-1.5 h-4 text-[11px] text-muted">
          {price === 0 ? "Gratuit, fără card" : cycle === "yearly" ? `Facturat anual: ${formatRon(price * 12)} · economisești ${formatRon(savings)}/an` : `sau ${plan.price.yearly} RON/lună facturat anual`}
        </p>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.includes.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5 text-sm leading-snug text-ink">
            <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald" />
            <span>
              {item.text}
              {item.roadmap && (
                <Badge tone="blue" className="ml-1.5 align-middle">
                  Roadmap / Integrare API
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Button variant={plan.highlighted ? "primary" : "secondary"} className="mt-7 w-full" onClick={onChoose} disabled={active}>
        {active ? "Plan Activ" : plan.cta}
      </Button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Checkout (simulated, Stripe-style)
// ---------------------------------------------------------------------------

function CheckoutModal({
  tier,
  initialCycle,
  onClose,
  onConfirmed,
}: {
  tier: PlanTier;
  initialCycle: BillingCycle;
  onClose: () => void;
  onConfirmed: (tier: PlanTier, cycle: BillingCycle) => void;
}) {
  const { company, supabase } = useAssessment();
  const [cycle, setCycle] = useState(initialCycle);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const plan = PLANS[tier];
  const b = priceBreakdown(tier, cycle);

  async function confirm() {
    setBusy(true);
    // Simulated payment delay, then the plan applies instantly everywhere (no reload).
    await new Promise((r) => setTimeout(r, 600));
    onConfirmed(tier, cycle);
    setDone(supabase?.configured && !supabase.error ? "Plan activat și salvat în Supabase." : "Plan activat local (Supabase neconfigurat).");
    setBusy(false);
  }

  return (
    <Modal title={done ? "Upgrade confirmat" : `Checkout — ${plan.name}`} onClose={onClose}>
      {done ? (
        <div className="text-center">
          <CircleCheck size={40} className="mx-auto text-emerald" />
          <p className="mt-3 text-sm text-ink">
            <strong className="font-medium">{company.name}</strong> este acum pe planul <strong className="font-medium">{plan.name}</strong>.
          </p>
          <p className="mt-1 text-xs text-muted">{done}</p>
          <Button className="mt-6 w-full" onClick={onClose}>
            Gata
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-line/70 bg-canvas p-4">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Building2 size={13} /> {company.name}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{plan.name}</p>
            <p className="mt-0.5 text-xs text-muted">{plan.subtitle}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cx(
                  "rounded-2xl border p-3 text-left transition-colors",
                  cycle === c ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-line-strong",
                )}
              >
                <span className="block text-xs opacity-70">{c === "monthly" ? "Lunar" : `Anual (−${YEARLY_DISCOUNT_PCT}%)`}</span>
                <span className="mt-0.5 block text-sm font-medium">{plan.price[c]} RON / lună</span>
              </button>
            ))}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <dt>
                {b.perMonth} RON × {b.months} {b.months === 1 ? "lună" : "luni"} (fără TVA)
              </dt>
              <dd className="text-ink">{b.net.toLocaleString("ro-RO")} RON</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>TVA {Math.round(b.vatRate * 100)}%</dt>
              <dd className="text-ink">{b.vat.toLocaleString("ro-RO")} RON</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <dt>Total {cycle === "yearly" ? "anual" : "lunar"} cu TVA</dt>
              <dd>{b.gross.toLocaleString("ro-RO")} RON</dd>
            </div>
          </dl>

          <Button className="mt-6 w-full" onClick={confirm} disabled={busy}>
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            Confirmă Upgrade — Mod Demo Hackathon
          </Button>
          <p className="mt-2 text-center text-[11px] text-faint">Nu se percepe nicio plată: checkout simulat pentru demonstrație.</p>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pay-per-use: one complete analysis for the active company (simulated checkout)
// ---------------------------------------------------------------------------

function PayPerUseCheckout({ onClose }: { onClose: () => void }) {
  const { company, unlockPayPerUse } = useAssessment();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const b = payPerUseBreakdown();
  async function confirm() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setDone(await unlockPayPerUse());
    setBusy(false);
  }
  return (
    <Modal title={done ? "Analiză deblocată" : "Checkout — Pay-Per-Use"} onClose={onClose}>
      {done ? (
        <div className="text-center">
          <CircleCheck size={40} className="mx-auto text-emerald" />
          <p className="mt-3 text-sm text-ink">{done}</p>
          <p className="mt-1 text-xs text-muted">Toate băncile, What-If, Stress Test și „Fișa Pre-Calificare Bancă” (PDF) sunt active pentru această firmă.</p>
          <Button className="mt-6 w-full" onClick={onClose}>
            Gata
          </Button>
        </div>
      ) : !company.id ? (
        <p className="text-sm text-muted">Adaugă întâi firma în Pasul 1: analiza Pay-Per-Use se deblochează pe o firmă anume.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-line/70 bg-canvas p-4">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Building2 size={13} /> {company.officialName || company.name}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">Analiză completă — plată unică</p>
            <p className="mt-0.5 text-xs text-muted">{PAY_PER_USE.subtitle}</p>
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <dt>1 analiză completă (fără TVA)</dt>
              <dd className="text-ink">{b.net.toLocaleString("ro-RO")} RON</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>TVA {Math.round(b.vatRate * 100)}%</dt>
              <dd className="text-ink">{b.vat.toLocaleString("ro-RO")} RON</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <dt>Total cu TVA (o singură dată)</dt>
              <dd>{b.gross.toLocaleString("ro-RO")} RON</dd>
            </div>
          </dl>
          <Button className="mt-6 w-full" onClick={confirm} disabled={busy}>
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            Plătește {PAY_PER_USE.price} RON — Mod Demo Hackathon
          </Button>
          <p className="mt-2 text-center text-[11px] text-faint">Nu se percepe nicio plată: checkout simulat. Se salvează pay_per_use_unlocked pe firmă (Supabase).</p>
        </>
      )}
    </Modal>
  );
}

function PayPerUseCard({ onChoose }: { onChoose: () => void }) {
  const { payPerUse, company } = useAssessment();
  return (
    <section id="pay-per-use" className="mt-8 grid scroll-mt-6 gap-6 rounded-[24px] border border-amber/40 bg-card p-6 shadow-card sm:p-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
      <div>
        <Badge tone="amber">Fără abonament</Badge>
        <h3 className="mt-3 text-xl font-normal tracking-tight text-ink">{PAY_PER_USE.name} — Plată per utilizare</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{PAY_PER_USE.subtitle}</p>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="text-[40px] font-light leading-none tracking-tight text-ink">{PAY_PER_USE.price}</span>
          <span className="text-sm text-muted">RON / analiză completă</span>
        </p>
        <p className="mt-1 text-[11px] text-muted">plată unică pe firmă · {formatRon(payPerUseBreakdown().gross)} cu TVA</p>
        <Button className="mt-5" onClick={onChoose} disabled={payPerUse}>
          {payPerUse ? `Deblocat pentru ${company.name}` : PAY_PER_USE.cta}
        </Button>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {PAY_PER_USE.includes.map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-sm leading-snug text-ink">
            <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// B2B demo request
// ---------------------------------------------------------------------------

function B2bModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ fullName: "", organization: "", email: "", phone: "", message: "", website: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await fetch("/api/b2b-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then((x) =>
        x.json(),
      )) as { ok: boolean; message?: string; error?: string };
      if (r.ok) setSent(r.message ?? "Cererea a fost trimisă.");
      else setError(r.error ?? "Cererea nu a putut fi salvată.");
    } catch {
      setError("API indisponibil. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={sent ? "Cerere trimisă" : "Solicită Demo B2B"} onClose={onClose}>
      {sent ? (
        <div className="text-center">
          <CircleCheck size={40} className="mx-auto text-emerald" />
          <p className="mt-3 text-sm text-ink">{sent}</p>
          <Button className="mt-6 w-full" onClick={onClose}>
            Închide
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Nume complet">
            <input required className={inputCls} value={form.fullName} onChange={set("fullName")} autoComplete="name" />
          </Field>
          <Field label="Instituție / Bancă">
            <input required className={inputCls} value={form.organization} onChange={set("organization")} autoComplete="organization" />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Email">
              <input required type="email" className={inputCls} value={form.email} onChange={set("email")} autoComplete="email" />
            </Field>
            <Field label="Telefon">
              <input type="tel" className={inputCls} value={form.phone} onChange={set("phone")} autoComplete="tel" />
            </Field>
          </div>
          <Field label="Mesaj">
            <textarea rows={3} className={cx(inputCls, "resize-none")} value={form.message} onChange={set("message")} />
          </Field>
          {/* Honeypot against bots: hidden from people, filled in by spam scripts. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={set("website")} />
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0" checked={form.consent} onChange={(e) => setForm((x) => ({ ...x, consent: e.target.checked }))} />
            <span>
              Sunt de acord ca datele să fie folosite doar pentru a fi contactat despre demo (GDPR). Detalii în{" "}
              <a href="/confidentialitate" className="underline">
                Politica de confidențialitate
              </a>
              .
            </span>
          </label>
          {error && <p className="rounded-xl bg-red-soft px-3 py-2 text-xs text-red">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !form.consent}>
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            Trimite cererea
          </Button>
        </form>
      )}
    </Modal>
  );
}

function EnterpriseBanner({ onRequestDemo }: { onRequestDemo: () => void }) {
  return (
    <section className="mt-8 grid gap-6 rounded-[24px] bg-navy p-6 text-white shadow-pop sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
      <div>
        <Badge className="border-transparent bg-white/10 text-[#9fd1b3]">B2B · Enterprise</Badge>
        <h3 className="mt-3 text-xl font-normal tracking-tight sm:text-2xl">{ENTERPRISE_OFFER.title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">{ENTERPRISE_OFFER.description}</p>
      </div>
      <div>
        <ul className="space-y-2.5">
          {ENTERPRISE_OFFER.monetization.map((m) => (
            <li key={m} className="flex items-start gap-2.5 text-sm leading-snug">
              <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#9fd1b3]" />
              {m}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onRequestDemo}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-strong"
        >
          {ENTERPRISE_OFFER.cta}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function PricingSection() {
  const { plan, setPlan } = useAssessment();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [checkout, setCheckout] = useState<PlanTier | null>(null);
  const [b2bOpen, setB2bOpen] = useState(false);
  const [ppuOpen, setPpuOpen] = useState(false);

  function choose(tier: PlanTier) {
    if (tier === "starter") {
      setPlan("starter", cycle);
      return;
    }
    setCheckout(tier);
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-3 text-center">
        <BillingToggle value={cycle} onChange={setCycle} />
        <p className="text-xs text-muted">
          {cycle === "yearly"
            ? `Economisești ${formatRon(yearlySavings("pro"))}/an la Pro și ${formatRon(yearlySavings("business"))}/an la Business.`
            : "Prețuri fără TVA. Poți anula oricând."}
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => (
          <PlanCard key={tier} tier={tier} cycle={cycle} active={plan.planTier === tier} onChoose={() => choose(tier)} />
        ))}
      </div>

      <PayPerUseCard onChoose={() => setPpuOpen(true)} />

      <EnterpriseBanner onRequestDemo={() => setB2bOpen(true)} />

      {checkout && (
        <CheckoutModal
          tier={checkout}
          initialCycle={cycle}
          onClose={() => setCheckout(null)}
          onConfirmed={(planTier, billingCycle) => setPlan(planTier, billingCycle)}
        />
      )}
      {b2bOpen && <B2bModal onClose={() => setB2bOpen(false)} />}
      {ppuOpen && <PayPerUseCheckout onClose={() => setPpuOpen(false)} />}
    </div>
  );
}
