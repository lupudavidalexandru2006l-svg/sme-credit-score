"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChartColumn, Check, ClipboardCheck, Database, FileUp, LoaderCircle, RotateCcw, Target, UserRound, X } from "lucide-react";
import { useAssessment, type StepId } from "./AssessmentProvider";
import { ScoreRing } from "./charts";
import { Button, cx, ProgressBar } from "./ui";
import { num } from "@/lib/util";

export const STEPS: { id: StepId; href: string; label: string; short: string; icon: ReactNode }[] = [
  { id: "onboarding", href: "/onboarding", label: "Firmă & factor uman", short: "Onboarding", icon: <UserRound size={17} /> },
  { id: "analiza", href: "/analiza", label: "Analiză business & e-Factura", short: "Analiză", icon: <ChartColumn size={17} /> },
  { id: "investitie", href: "/investitie", label: "Investiție & sector", short: "Investiție", icon: <Target size={17} /> },
  { id: "profil", href: "/profil", label: "Profil Credit Ready & plan", short: "Profil", icon: <ClipboardCheck size={17} /> },
];

function BrandMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
      <span className="flex h-5 items-end gap-[3px]">
        <span className="h-2 w-[5px] rounded-sm bg-emerald/60" />
        <span className="h-3.5 w-[5px] rounded-sm bg-emerald/80" />
        <span className="h-5 w-[5px] rounded-sm bg-emerald" />
      </span>
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
  const { assessment, supabase, dataset, legal, legalLoading } = useAssessment();
  const done = useStepDone();
  const f = assessment.final;
  const pillars = [
    { label: "Business", w: "70%", score: f.pillars.business.score },
    { label: "Factor uman", w: "15%", score: f.pillars.human.score },
    { label: "Investiție", w: "15%", score: f.pillars.investment.score },
  ];
  const provisional = !STEPS.slice(0, 3).every((s) => done(s.id));

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col overflow-y-auto bg-navy px-5 py-6 text-white lg:flex">
      <div className="flex items-center gap-3">
        <BrandMark />
        <div>
          <p className="text-base font-extrabold tracking-tight">Credit Ready</p>
          <p className="text-[11px] text-white/55">Challenge 2 · evaluare IMM</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1" aria-label="Pașii evaluării">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Evaluare</p>
        {STEPS.map((s, i) => {
          const active = path.startsWith(s.href);
          const ok = done(s.id);
          return (
            <Link
              key={s.id}
              href={s.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-white text-navy" : "text-white/75 hover:bg-white/8 hover:text-white",
              )}
            >
              <span
                className={cx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold",
                  ok ? "bg-emerald text-white" : active ? "bg-navy-soft text-navy-3" : "bg-white/10 text-white/70",
                )}
              >
                {ok ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span className="leading-tight">{s.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl bg-navy-2 p-4 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Scor live</p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" /> recalculat instant
          </span>
        </div>
        <div className="mt-3 flex justify-center">
          <ScoreRing score={f.finalScore} size={132} stroke={11} dark label={provisional ? "provizoriu" : "din 100"} />
        </div>
        <p className="mt-2 text-center text-sm font-bold">{f.status}</p>
        {f.quizKillSwitch && <p className="mt-1 text-center text-[11px] font-bold text-red-soft">Kill-switch quiz activ: -10 p</p>}
        <div className="mt-4 space-y-2.5">
          {pillars.map((p) => (
            <div key={p.label}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-white/70">
                  {p.label} <span className="text-white/40">· {p.w}</span>
                </span>
                <span className="font-bold">{num(p.score)}</span>
              </div>
              <ProgressBar value={p.score} className="bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6 text-[11px] text-white/60">
        <p className="flex items-center gap-2">
          <Database size={13} />
          {supabase === null ? "Se încarcă datele…" : dataset.source === "supabase" ? "Date: Supabase (live)" : "Date: sintetice locale"}
        </p>
        {supabase?.error && <p className="text-amber-soft/80">{supabase.error}</p>}
        <p className="flex items-center gap-2">
          {legalLoading ? <LoaderCircle size={13} className="animate-spin" /> : <span className="h-2 w-2 rounded-full bg-white/40" />}
          portal.just.ro:{" "}
          {legalLoading ? "verificare…" : legal ? (legal.source === "portal.just.ro" ? "Live" : legal.source === "simulation" ? "Simulat" : "Fallback") : "neverificat"}
        </p>
        <p className="leading-relaxed text-white/40">Ghid de pregătire pe date sintetice — nu este o aprobare bancară.</p>
      </div>
    </aside>
  );
}

function MobileNav() {
  const path = usePathname();
  const { assessment } = useAssessment();
  return (
    <div className="no-print sticky top-0 z-20 border-b border-line bg-navy px-4 py-3 text-white lg:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandMark />
          <p className="font-extrabold">Credit Ready</p>
        </div>
        <p className="text-sm">
          Scor <span className="text-lg font-extrabold">{num(assessment.final.finalScore)}</span>
        </p>
      </div>
      <nav className="mt-3 grid grid-cols-4 gap-1" aria-label="Pașii evaluării">
        {STEPS.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            className={cx("rounded-lg px-1 py-1.5 text-center text-[11px] font-bold", path.startsWith(s.href) ? "bg-white text-navy" : "bg-white/10 text-white/80")}
          >
            {i + 1}. {s.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Visible "upload e-Factura XML" button, available on every step. */
export function XmlUploadButton({ variant = "emerald", label = "Încarcă XML e-Factura (UBL 2.1)" }: { variant?: "emerald" | "primary" | "secondary"; label?: string }) {
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
      <Button variant={variant} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <FileUp size={16} />}
        {label}
      </Button>
    </>
  );
}

function TopBar() {
  const { company, assessment, uploads, resetUploads } = useAssessment();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card/80 px-4 py-3 backdrop-blur sm:px-8">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{company.name || "Firmă nedefinită"}</p>
        <p className="text-[11px] text-muted">
          CUI {company.cui} · CAEN {company.caenCode} · {assessment.metrics.issuedCount + assessment.metrics.receivedCount} documente e-Factura · până la {assessment.metrics.asOf}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {uploads.length > 0 && (
          <Button variant="ghost" onClick={resetUploads} title="Elimină facturile încărcate">
            <RotateCcw size={15} /> {uploads.length} XML încărcate
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
    <div role="status" key={toast.id} className="no-print animate-rise fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl bg-navy p-4 text-white shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Scor recalculat în timp real</p>
          <p className="mt-1 text-sm font-bold">{toast.title}</p>
          <p className="text-xs text-white/65">{toast.detail}</p>
        </div>
        <button type="button" onClick={dismissToast} aria-label="Închide" className="text-white/50 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-2xl font-extrabold text-white/60">{num(toast.from)}</span>
        <span className="text-white/40">→</span>
        <span className="text-3xl font-extrabold">{num(toast.to)}</span>
        <span className={cx("ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold", up ? "bg-emerald/20 text-emerald" : "bg-red/20 text-red-soft")}>
          {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
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
    <div className={cx("flex min-h-screen transition-opacity duration-200", hydrated ? "opacity-100" : "opacity-0")}>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <TopBar />
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <ScoreToastView />
    </div>
  );
}

export function PageHeader({ step, title, subtitle, action }: { step: number; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-strong">Pasul {step} din 4</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function StepFooter({ prev, next, nextLabel }: { prev?: string; next?: string; nextLabel?: string }) {
  return (
    <div className="no-print mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
      {prev ? (
        <Link href={prev} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
          ← Înapoi
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-navy-2">
          {nextLabel ?? "Continuă"} →
        </Link>
      )}
    </div>
  );
}
