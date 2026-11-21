"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Building2, ChartColumn, Check, ClipboardCheck, FileUp, FlaskConical, LoaderCircle, Lock, LogIn, LogOut, RotateCcw, ShieldCheck, Tag, Target, UserRound, X } from "lucide-react";
import { useHideScores } from "@/lib/useHideScores";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "./AuthProvider";
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

/** Step completion + access: step i opens only when every step before it is complete. */
function useSteps() {
  const { completedSteps: c, visited } = useAssessment();
  const done = (id: StepId) => (id === "onboarding" ? c.step1 : id === "analiza" ? c.step2 : id === "investitie" ? c.step3 : c.step3 && visited.includes("profil"));
  const unlocked = (i: number) => i <= 0 || [c.step1, c.step2, c.step3][i - 1];
  const firstIncomplete = !c.step1 ? "/onboarding" : !c.step2 ? "/analiza" : !c.step3 ? "/investitie" : "/profil";
  return { done, unlocked, firstIncomplete, count: [c.step1, c.step2, c.step3].filter(Boolean).length };
}

/** Route guard: a later step opened by URL redirects to the first incomplete step. */
function useStepGuard() {
  const path = usePathname();
  const router = useRouter();
  const { hydrated } = useAssessment();
  const { unlocked, firstIncomplete } = useSteps();
  const allowed = unlocked(STEPS.findIndex((s) => path.startsWith(s.href)));
  useEffect(() => {
    if (hydrated && !allowed) router.replace(firstIncomplete);
  }, [hydrated, allowed, firstIncomplete, router]);
  return allowed || !hydrated;
}

/** Steps 1-3: neutral progress instead of scores. */
function NeutralProgress() {
  const { count } = useSteps();
  return (
    <div className="mt-8 border-t border-line pt-6">
      <p className="px-1 text-xs text-faint">Progres evaluare</p>
      <p className="mt-3 px-1 text-2xl font-light text-ink">
        {count}
        <span className="text-base text-faint"> / 3 pași</span>
      </p>
      <ProgressBar value={(count / 3) * 100} className="mt-2 h-1" />
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">Rezultatul va fi calculat la final, în Pasul 4 (Profil & plan final).</p>
    </div>
  );
}

function StepLink({ s, i, className, children }: { s: (typeof STEPS)[number]; i: number; className: string; children: ReactNode }) {
  const { unlocked } = useSteps();
  if (!unlocked(i)) {
    return (
      <span aria-disabled="true" title="Finalizează pașii anteriori" className={cx(className, "pointer-events-auto cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={s.href} className={className}>
      {children}
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  const { assessment, supabase, dataset, legal, legalLoading, verification, verificationLoading } = useAssessment();
  const { done, unlocked } = useSteps();
  const hideScores = useHideScores();
  const f = assessment.final;
  const pillars = [
    { label: "Business", w: "70%", score: f.pillars.business.score },
    { label: "Factor uman", w: "15%", score: f.pillars.human.score },
    { label: "Investiție", w: "15%", score: f.pillars.investment.score },
  ];
  const provisional = !STEPS.slice(0, 3).every((s) => done(s.id));

  return (
    <aside className="no-print sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[256px] shrink-0 flex-col overflow-y-auto rounded-[28px] border border-white/80 bg-white/55 p-5 shadow-card backdrop-blur-xl lg:flex">
      <Link href="/onboarding" className="px-1" aria-label="Afghankingz Credit — acasă">
        <BrandLogo tagline />
      </Link>

      <nav className="mt-8 space-y-0.5" aria-label="Pașii evaluării">
        <p className="mb-2 px-3 text-xs text-faint">Evaluare</p>
        {STEPS.map((s, i) => {
          const active = path.startsWith(s.href);
          const ok = done(s.id);
          const locked = !unlocked(i);
          return (
            <StepLink
              key={s.id}
              s={s}
              i={i}
              className={cx(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,32,28,0.06)]" : locked ? "text-muted" : "text-muted hover:bg-white/60 hover:text-ink",
              )}
            >
              <span
                className={cx(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px]",
                  ok ? "bg-emerald-soft text-emerald-strong" : active ? "bg-navy text-white" : "border border-line-strong text-faint",
                )}
              >
                {ok ? <Check size={13} strokeWidth={2.5} /> : locked ? <Lock size={11} /> : i + 1}
              </span>
              <span className="leading-tight">{s.label}</span>
            </StepLink>
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
        <AdminNavLink />
      </nav>

      {hideScores ? (
        <NeutralProgress />
      ) : (
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
      )}

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
        <p className="pt-2 leading-relaxed">Afghankingz Credit · ghid de pregătire pe date reale (ANAF, bilanț, VIES, portal.just.ro, e-Factura), nu aprobare bancară.</p>
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
  const hideScores = useHideScores();
  const { count, unlocked } = useSteps();
  return (
    <div className="no-print sticky top-0 z-20 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between">
        <Link href="/onboarding" aria-label="Afghankingz Credit — acasă">
          <BrandLogo size="sm" />
        </Link>
        <Link href="/pricing" className={cx("ml-auto mr-3 rounded-full px-3 py-1 text-[11px]", path.startsWith("/pricing") ? "bg-navy text-white" : "border border-line text-muted")}>
          Prețuri
        </Link>
        {hideScores ? (
          <p className="text-sm text-muted">
            Progres <span className="text-lg font-light text-ink">{count}/3</span>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Scor{" "}
            <span className="text-lg font-light text-ink">
              {assessment.final.complete ? <Figure value={num(assessment.final.finalScore)} /> : "—"}
            </span>
          </p>
        )}
      </div>
      <nav className="mt-3 grid grid-cols-4 gap-1" aria-label="Pașii evaluării">
        {STEPS.map((s, i) => (
          <StepLink
            key={s.id}
            s={s}
            i={i}
            className={cx("inline-flex items-center justify-center gap-1 rounded-full px-1 py-1.5 text-center text-[11px]", path.startsWith(s.href) ? "bg-navy text-white" : "text-muted")}
          >
            {!unlocked(i) && <Lock size={10} />}
            {i + 1}. {s.short}
          </StepLink>
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

/** Admin entry in the sidebar, only for admins (role 'admin' or the hackathon demo session). */
function AdminNavLink() {
  const path = usePathname();
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <Link
      href="/admin"
      className={cx(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
        path.startsWith("/admin") ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,32,28,0.06)]" : "text-muted hover:bg-white/60 hover:text-ink",
      )}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong text-faint">
        <ShieldCheck size={12} />
      </span>
      <span className="leading-tight">Panou Admin</span>
    </Link>
  );
}

/** "Autentificare" / "Contul meu" + "Deconectare". Guest mode keeps working without an account. */
export function AccountButtons() {
  const { session, profile, signOut, loading } = useAuth();
  if (loading) return null;
  if (!session) {
    return (
      <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-xs font-medium text-ink hover:border-line-strong">
        <LogIn size={13} /> Autentificare
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-white/80 p-1">
      <Link href="/cont" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas" title={session.user.email ?? ""}>
        <UserRound size={13} /> Contul meu{profile?.role === "admin" ? " · admin" : ""}
      </Link>
      <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted hover:bg-canvas hover:text-ink">
        <LogOut size={12} /> Deconectare
      </button>
    </div>
  );
}

function TopBar() {
  const { uploads, resetUploads } = useAssessment();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-8">
      <CompanySwitcher />
      <div className="flex flex-wrap items-center gap-2">
        <AccountButtons />
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
  const hideScores = useHideScores();
  if (!toast || hideScores) return null;
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

/** Discreet banner while the demo company is active. */
function DemoBanner() {
  const { isDemo, startNewCompany } = useAssessment();
  const router = useRouter();
  if (!isDemo) return null;
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy/15 bg-navy-soft/60 px-4 py-2.5 text-xs text-ink">
      <p className="flex items-center gap-2">
        <FlaskConical size={14} className="shrink-0 text-navy-3" />
        <span>
          <strong>Mod Demo Activ</strong> — poți naviga liber prin pașii 1–4 pentru a inspecta datele.
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          startNewCompany();
          router.push("/onboarding");
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 font-medium hover:border-line-strong"
      >
        <RotateCcw size={12} /> Ieși din Demo / Firmă nouă
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { hydrated } = useAssessment();
  const allowed = useStepGuard();
  return (
    <div className={cx("flex min-h-screen transition-opacity duration-200 lg:p-3", hydrated ? "opacity-100" : "opacity-0")}>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <TopBar />
        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-8">
          <DemoBanner />
          {allowed ? children : null}
        </main>
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

/** Neutral confirmation shown in steps 1-3 instead of a score. */
export function StepDoneNote({ text = "Pas completat — Rezultatul va fi calculat la final (Pasul 4)." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-emerald/30 bg-emerald-soft px-4 py-3 text-sm font-medium text-emerald-strong">
      <Check size={16} strokeWidth={2.5} className="shrink-0" /> {text}
    </div>
  );
}

/** "Continuă" that validates the current step first; the error is shown under the button. */
export function GatedFooter({ prev, next, label, error, onContinue }: { prev?: string; next: string; label: string; error: string | null; onContinue?: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="no-print mt-10 flex items-start justify-between gap-3">
      {prev ? (
        <Link href={prev} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted hover:bg-white/70 hover:text-ink">
          <ArrowLeft size={15} /> Înapoi
        </Link>
      ) : (
        <span />
      )}
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (error) return setNote(error);
            setNote(null);
            onContinue?.();
            router.push(next);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-medium text-white hover:bg-navy-2"
        >
          {label} <ArrowRight size={15} />
        </button>
        {note && <p className="max-w-xs text-right text-xs font-medium text-red">{note}</p>}
      </div>
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
