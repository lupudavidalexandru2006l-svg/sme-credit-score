"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, Repeat, Sparkles, X } from "lucide-react";
import { useAssessment } from "./AssessmentProvider";
import { cx } from "./ui";
import { canPerformAction, PLAN_TIERS, planBadgeLabel, PLANS, type Feature } from "@/lib/pricing";

export const UNLOCK_LABEL = `Deblochează cu Planul Pro (${PLANS.pro.price.monthly} RON/lună)`;

/** True when the active company's plan includes the feature. */
export function useCan(feature: Feature) {
  const { plan } = useAssessment();
  return canPerformAction(plan.planTier, feature);
}

/** Content blurred behind a subtle overlay with an unlock button, unless the plan includes `feature`. */
export function LockedGate({ feature, title, children, className }: { feature: Feature; title?: string; children: ReactNode; className?: string }) {
  const allowed = useCan(feature);
  if (allowed) return <>{children}</>;
  return (
    <div className={cx("relative", className)}>
      <div aria-hidden className="pointer-events-none select-none blur-[5px] saturate-50">
        {children}
      </div>
      <div className="no-print absolute inset-0 grid place-items-center rounded-2xl bg-white/45 p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-white/95 px-5 py-4 text-center shadow-card">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-soft text-navy-3">
            <Lock size={15} />
          </span>
          {title && <p className="text-sm font-medium text-ink">{title}</p>}
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2">
            <Sparkles size={14} /> {UNLOCK_LABEL}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** "Plan: PRO" badge + a discreet demo switch that cycles Starter → Pro → Business. */
export function PlanBadge() {
  const { plan, setPlan } = useAssessment();
  const next = PLAN_TIERS[(PLAN_TIERS.indexOf(plan.planTier) + 1) % PLAN_TIERS.length];
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-white/80 py-1 pl-1 pr-1">
      <Link
        href="/pricing"
        className={cx(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
          plan.planTier === "starter" ? "bg-navy-soft text-navy-3" : "bg-emerald-soft text-emerald-strong",
        )}
        title="Vezi planurile"
      >
        {planBadgeLabel(plan.planTier)}
      </Link>
      <button
        type="button"
        onClick={() => setPlan(next)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-faint hover:bg-white hover:text-ink"
        title={`Demo: comută pe ${PLANS[next].name}`}
      >
        <Repeat size={11} /> Switch Plan
      </button>
    </div>
  );
}

/** Upgrade prompt opened by a blocked action (e.g. the 4th XML invoice on Starter). */
export function UpgradePrompt() {
  const { upgradePrompt, closeUpgrade, setPlan } = useAssessment();
  if (!upgradePrompt) return null;
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-navy/30 p-4 backdrop-blur-sm" onClick={closeUpgrade}>
      <div role="dialog" aria-modal="true" aria-label="Upgrade la Pro" className="animate-rise w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-soft text-emerald-strong">
            <Sparkles size={18} />
          </span>
          <button type="button" onClick={closeUpgrade} aria-label="Închide" className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <h2 className="mt-4 text-lg font-medium tracking-tight text-ink">Treci la Planul Pro</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{upgradePrompt}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={() => setPlan("pro")} className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2">
            Activează Pro — Mod Demo ({PLANS.pro.price.monthly} RON/lună)
          </button>
          <Link href="/pricing" onClick={closeUpgrade} className="rounded-full px-5 py-2.5 text-center text-sm text-muted hover:bg-canvas hover:text-ink">
            Compară planurile
          </Link>
        </div>
      </div>
    </div>
  );
}
