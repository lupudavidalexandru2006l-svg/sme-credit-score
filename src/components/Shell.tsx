"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Building2, ChartColumn, Check, ClipboardCheck, FileUp, LoaderCircle, RotateCcw, Tag, Target, UserRound, X } from "lucide-react";
import { useAssessment, type StepId } from "./AssessmentProvider";
import { Figure, ScoreRing } from "./charts";
import { Button, cx, ProgressBar } from "./ui";
import { PlanBadge, UpgradePrompt } from "./PlanGate";
import { companyLabel } from "@/lib/company";
import { num } from "@/lib/util";

export const STEPS: { id: StepId; href: string; label: string; short: string; icon: ReactNode }[] = [
  { id: "onboarding", href: "/onboarding", label: "Firmă & factor uman", short: "Onboarding", icon: <UserRound size={16} /> },
  { id: "analiza", href: "/analiza", label: "Analiză e-Factura", short: "Analiză", icon: <ChartColumn size={16} /> },
  { id: "investitie", href: "/investitie", label: "Investiție & sector", short: "Investiție", icon: <Target size={16} /> },
  { id: "profil", href: "/profil", label: "Profil & plan", short: "Profil", icon: <ClipboardCheck size={16} /> },
];

function BrandMark() {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      <span className="h-1.5 w-[4px] rounded-full bg-navy/35" />
      <span className="h-2.5 w-[4px] rounded-full bg-navy/65" />
      <span className="h-4 w-[4px] rounded-full bg-navy" />
    </span>
  );
}

function useStepDone() {
  const { company, assessment, investment, visited } = useAssessment();
  return (id: StepId) => {
    switch (id) {
      case "onboarding":
        return Boolean(company.name && company.ceoName) && assessment.quiz.answered === 5;
      case "analiza":
        return visited.includes("analiza");
      case "investitie":
        return investment.purpose !== null && investment.ownContributionPct !== null && (investment.requestedAmount ?? 0) > 0;
      case "profil":
        return visited.includes("profil");
    }
  };
}

function Sidebar() {
  const path = usePathname();
  const { assessment, supabase, dataset, legal, legalLoading, verification, verificationLoading } = useAssessment();
  const done = useStepDone();
  const f = assessment.final;
  const pillars = [
    { label: "Business", w: "70%", score: f.pillars.business.score },
    { label: "Factor uman", w: "15%", score: f.pillars.human.score },
    { label: "Investiție", w: "15%", score: f.pillars.investment.score },
  ];
  const provisional = !STEPS.slice(0, 3).every((s) => done(s.id));

  return (
    <aside className="no-print sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[256px] shrink-0 flex-col overflow-y-auto rounded-[28px] border border-white/80 bg-white/55 p-5 shadow-card backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-1">
        <BrandMark />
        <p className="text-[15px] font-medium tracking-tight text-ink">Credit Ready</p>
      </div>

      <nav className="mt-8 space-y-0.5" aria-label="Pașii evaluării">
        <p className="mb-2 px-3 text-xs text-faint">Evaluare</p>
        {STEPS.map((s, i) => {
          const active = path.startsWith(s.href);
          const ok = done(s.id);
          return (
            <Link
              key={s.id}
              href={s.href}
              className={cx(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,32,28,0.06)]" : "text-muted hover:bg-white/60 hover:text-ink",
              )}
            >
              <span
                className={cx(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px]",
                  ok ? "bg-emerald-soft text-emerald-strong" : active ? "bg-navy text-white" : "border border-line-strong text-faint",
                )}
              >
                {ok ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="leading-tight">{s.label}</span>
            </Link>
          );
        })}
        <p className="mb-2 mt-6 px-3 text-xs text-faint">Abonament</p>
        <Link
          href="/pricing"
          className={cx(
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
            path.startsWith("/pricing") ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,32,28,0.06)]" : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong text-faint">
            <Tag size={12} />
          </span>
          <span className="leading-tight">Prețuri / Planuri</span>
        </Link>
      </nav>

      <div className="mt-8 border-t border-line pt-6">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-faint">Scor live</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-strong">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" /> live
          </span>
        </div>
        <div className="mt-4 flex justify-center">
          {f.complete ? (
            <ScoreRing score={f.finalScore} size={128} stroke={6} label={provisional ? "provizoriu" : "din 100"} />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-full border-[6px] border-line text-center">
              <div>
                <p className="text-3xl font-light text-faint">—</p>
                <p className="text-[11px] text-faint">incomplet</p>
              </div>
            </div>
          )}
        </div>
        {f.complete ? (
          <p className="mt-3 text-center text-sm text-ink">{f.status}</p>
        ) : (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">Lipsesc: {(f.missing ?? []).join("; ")}.</p>
        )}
        {f.quizKillSwitch && <p className="mt-1 text-center text-[11px] text-red">Kill-switch quiz activ: −10 p</p>}
        <div className="mt-5 space-y-3 px-1">
          {pillars.map((p) => (
            <div key={p.label}>
              <div className="mb-1.5 flex justify-between text-[11px]">
                <span className="text-muted">
                  {p.label} <span className="text-faint">· {p.w}</span>
                </span>
                <span className="text-ink">{f.complete ? num(p.score) : "—"}</span>
              </div>
              <ProgressBar value={f.complete ? p.score : 0} className="h-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-1.5 px-1 pt-6 text-[11px] text-faint">
        <p className="flex items-center gap-2">
          <span className={cx("h-1.5 w-1.5 rounded-full", dataset.source === "supabase" ? "bg-emerald" : "bg-faint")} />
          {supabase === null ? "Se încarcă datele…" : dataset.source === "supabase" ? "Supabase live" : "Salvat local în browser"}
        </p>
        {supabase?.error && <p className="text-amber">{supabase.error}</p>}
        <p className="flex items-center gap-2">
          {legalLoading ? <LoaderCircle size={11} className="animate-spin" /> : <span className={cx("h-1.5 w-1.5 rounded-full", legal?.source === "portal.just.ro" ? "bg-emerald" : "bg-faint")} />}
          portal.just.ro ·{" "}
          {legalLoading ? "verificare…" : legal ? (legal.source === "portal.just.ro" ? "live" : "indisponibil") : "neverificat"}
        </p>
        <p className="flex items-center gap-2">
          {verificationLoading ? <LoaderCircle size={11} className="animate-spin" /> : <span className={cx("h-1.5 w-1.5 rounded-full", verification.aggregateScore !== null ? "bg-emerald" : "bg-faint")} />}
          surse oficiale · {verificationLoading ? "interogare…" : `${verification.sources.filter((x) => x.score !== null).length}/${verification.sources.length} au răspuns`}
        </p>
        <p className="pt-2 leading-relaxed">Ghid de pregătire pe date reale (ANAF, bilanț, VIES, portal.just.ro, e-Factura), nu aprobare bancară.</p>
        <p className="flex gap-3">
          <Link href="/termeni" className="hover:text-ink">Termeni</Link>
          <Link href="/confidentialitate" className="hover:text-ink">Confidențialitate</Link>
        </p>
      </div>
    </aside>
  );
}

function MobileNav() {
  const path = usePathname();
  const { assessment } = useAssessment();
  return (
    <div className="no-print sticky top-0 z-20 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <p className="font-medium tracking-tight">Credit Ready</p>
        </div>
        <Link href="/pricing" className={cx("ml-auto mr-3 rounded-full px-3 py-1 text-[11px]", path.startsWith("/pricing") ? "bg-navy text-white" : "border border-line text-muted")}>
          Prețuri
        </Link>
        <p className="text-sm text-muted">
          Scor{" "}
          <span className="text-lg font-light text-ink">
            {assessment.final.complete ? <Figure value={num(assessment.final.finalScore)} /> : "—"}
          </span>
        </p>
      </div>
      <nav className="mt-3 grid grid-cols-4 gap-1" aria-label="Pașii evaluării">
        {STEPS.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            className={cx("rounded-full px-1 py-1.5 text-center text-[11px]", path.startsWith(s.href) ? "bg-navy text-white" : "text-muted")}
          >
            {i + 1}. {s.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Visible "upload e-Factura XML" button, available on every step. */
export function XmlUploadButton({ variant = "emerald", label = "Încarcă XML e-Factura" }: { variant?: "emerald" | "primary" | "secondary"; label?: string }) {
  const { uploadXml } = useAssessment();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          try {
            await uploadXml(await Promise.all(files.map(async (f) => ({ name: f.name, xml: await f.text() }))));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button variant={variant} onClick={() => ref.current?.click()} disabled={busy} title="Facturi UBL 2.1 (RO e-Factura)">
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}
        {label}
      </Button>
    </>
  );
}

/** "Firmă activă / Istoric firme": every saved company stays available; switching never deletes data. */
function CompanySwitcher() {
  const { company, companies, switchCompany, assessment, dataset } = useAssessment();
  const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  return (
    <div className="min-w-0 max-w-full">
      <label className="flex min-w-0 items-center gap-2">
        <Building2 size={15} className="shrink-0 text-faint" />
        <span className="sr-only">Firmă activă</span>
        <select
          className="min-w-0 max-w-[min(420px,calc(100vw-5rem))] truncate rounded-full border border-line bg-white/80 py-1.5 pl-3 pr-8 text-sm font-medium text-ink outline-none hover:border-line-strong focus:border-navy-3"
          value={company.id}
          onChange={(e) => switchCompany(e.target.value)}
          title="Firmă activă — comută între firmele salvate"
        >
          {sorted.length === 0 && <option value="">Nicio firmă — adaug-o în Pasul 1</option>}
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {companyLabel(c)}
            </option>
          ))}
        </select>
        <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
          {companies.length} {companies.length === 1 ? "firmă" : "firme"}
        </span>
      </label>
      <p className="mt-1 truncate pl-6 text-[11px] text-faint">
        {company.cui ? `CUI ${company.cui}` : "fără CUI"} · {company.caenCode ? `CAEN ${company.caenCode}` : "fără CAEN"} · sector {assessment.benchmark.sector.shortLabel} ·{" "}
        {assessment.metrics.issuedCount + assessment.metrics.receivedCount} documente e-Factura ({dataset.source === "supabase" ? "Supabase + încărcate" : "încărcate"})
        {assessment.metrics.issuedCount + assessment.metrics.receivedCount > 0 ? ` · până la ${assessment.metrics.asOf}` : ""}
      </p>
    </div>
  );
}

function TopBar() {
  const { uploads, resetUploads } = useAssessment();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-8">
      <CompanySwitcher />
      <div className="flex flex-wrap items-center gap-2">
        <PlanBadge />
        {uploads.length > 0 && (
          <Button variant="secondary" onClick={resetUploads} title="Elimină facturile încărcate">
            <RotateCcw size={14} /> {uploads.length} XML
          </Button>
        )}
        <XmlUploadButton />
      </div>
    </div>
  );
}

function ScoreToastView() {
  const { toast, dismissToast } = useAssessment();
  if (!toast) return null;
  const delta = Math.round((toast.to - toast.from) * 10) / 10;
  const up = delta >= 0;
  return (
    <div role="status" key={toast.id} className="no-print animate-rise fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-[22px] bg-navy p-5 text-white shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-white/45">Scor recalculat</p>
          <p className="mt-1 text-sm font-medium">{toast.title}</p>
          <p className="text-xs text-white/55">{toast.detail}</p>
        </div>
        <button type="button" onClick={dismissToast} aria-label="Închide" className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-xl font-light text-white/45">{num(toast.from)}</span>
        <ArrowRight size={14} className="self-center text-white/30" />
        <span className="text-3xl font-light tracking-tight">
          <Figure value={num(toast.to)} />
        </span>
        <span className={cx("ml-auto inline-flex items-center gap-1 self-center rounded-full px-2.5 py-1 text-xs", up ? "bg-white/10 text-[#9fd1b3]" : "bg-white/10 text-[#e8a9a4]")}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {up ? "+" : ""}
          {num(delta)}
        </span>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { hydrated } = useAssessment();
  return (
    <div className={cx("flex min-h-screen transition-opacity duration-200 lg:p-3", hydrated ? "opacity-100" : "opacity-0")}>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <TopBar />
        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <ScoreToastView />
      <UpgradePrompt />
    </div>
  );
}

export function PageHeader({ step, title, subtitle, action }: { step: number; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.id} className={cx("h-1 w-4 rounded-full", i < step ? "bg-navy" : "bg-line-strong")} />
            ))}
          </span>
          <p className="text-xs text-faint">Pasul {step} din 4</p>
        </div>
        <h1 className="mt-3 text-[28px] font-normal leading-tight tracking-tight text-ink sm:text-[34px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function StepFooter({ prev, next, nextLabel }: { prev?: string; next?: string; nextLabel?: string }) {
  return (
    <div className="no-print mt-10 flex items-center justify-between gap-3">
      {prev ? (
        <Link href={prev} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted hover:bg-white/70 hover:text-ink">
          <ArrowLeft size={15} /> Înapoi
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next} className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-medium text-white hover:bg-navy-2">
          {nextLabel ?? "Continuă"} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
