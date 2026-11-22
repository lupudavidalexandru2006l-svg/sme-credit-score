"use client";

import { useState } from "react";
import type { BenchmarkItem, MonthPoint } from "@/types/scoring";
import { monthLabel, num, ron } from "@/lib/util";
import { cx } from "./ui";
import { useHideScores } from "@/lib/useHideScores";
import { tr } from "@/lib/i18n/tr";

/** A formatted number with its decimal part dimmed ("68,3" → 68 + ",3"). */
export function Figure({ value }: { value: string }) {
  const i = value.lastIndexOf(",");
  if (i < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, i)}
      <span className="opacity-40">{value.slice(i)}</span>
    </>
  );
}

/** Circular score gauge built from two SVG circles. */
export function ScoreRing({
  score,
  size = 168,
  stroke = 14,
  label,
  dark = false,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  dark?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  const color = v >= 75 ? "var(--emerald)" : v >= 55 ? "var(--blue)" : v >= 40 ? "var(--amber)" : "var(--red)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,255,255,.12)" : "var(--navy-soft)"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1), stroke .3s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className={cx("font-light tracking-tight", dark ? "text-white" : "text-ink")} style={{ fontSize: size * 0.26, lineHeight: 1 }}>
            <Figure value={num(v)} />
          </p>
          <p className={cx("mt-1.5 text-[11px]", dark ? "text-white/60" : "text-faint")}>{label ?? tr("din 100")}</p>
        </div>
      </div>
    </div>
  );
}

/** Monthly revenue bars (uploaded XML part highlighted) + net cash-flow markers. */
export function MonthlyChart({ months }: { months: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...months.map((m) => Math.max(m.revenue, m.purchases)), 1);
  const H = 180;
  const active = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-navy-3/30" /> {tr("Vânzări nete (fără TVA)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald" /> {tr("din XML încărcat")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-faint" /> {tr("Achiziții")}</span>
      </div>
      <div className="relative">
        <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {months.map((m, i) => {
            const base = Math.max(0, m.revenue - Math.max(0, m.uploadedRevenue));
            const up = Math.max(0, m.uploadedRevenue);
            const hp = (m.purchases / max) * H;
            return (
              <button
                key={m.month}
                type="button"
                aria-label={`${monthLabel(m.month)}: ${ron(m.revenue)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                className="group relative flex h-full flex-1 flex-col justify-end"
              >
                <span className="absolute inset-x-0 border-t border-dashed border-faint" style={{ bottom: hp }} />
                {up > 0 && <span className="w-full rounded-t-lg bg-emerald transition-all duration-500" style={{ height: (up / max) * H }} />}
                <span
                  className={cx("w-full transition-all duration-500", up > 0 ? "" : "rounded-t-lg", hover === i ? "bg-navy-3/55" : "bg-navy-3/25")}
                  style={{ height: (base / max) * H }}
                />
              </button>
            );
          })}
        </div>
        {active && (
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl bg-navy/95 px-3 py-2 text-[11px] text-white shadow-pop backdrop-blur">
            <p className="font-semibold">{monthLabel(active.month)}</p>
            <p>{tr("Vânzări:")} {ron(active.revenue)}</p>
            {active.uploadedRevenue !== 0 && <p className="text-emerald-soft">{tr("din XML:")} {ron(active.uploadedRevenue)}</p>}
            <p>{tr("Achiziții:")} {ron(active.purchases)}</p>
            <p>{tr("Cash-flow net:")} {ron(active.netCashFlow)}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[10px] font-medium text-faint">
            {monthLabel(m.month, false)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Firma ta vs. sector": p25-p75 band, median tick and company marker on one axis. */
export function BenchmarkRow({ item }: { item: BenchmarkItem }) {
  const hideScores = useHideScores();
  const lo = Math.min(item.p25, item.company) * 0.8;
  const hi = Math.max(item.p75, item.company) * 1.15;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const tone = item.verdict === "mai bun" ? "text-emerald-strong" : item.verdict === "la nivel" ? "text-blue" : "text-amber";
  const fmt = (v: number) => `${num(v)}${item.unit === "zile" ? ` ${tr("z")}` : item.unit}`;
  return (
    <div className="py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{tr(item.label)}</p>
        <p className="text-xs">
          <span className="font-semibold text-ink">{fmt(item.company)}</span>
          <span className="text-muted"> {tr("vs. mediana")} {fmt(item.median)} · </span>
          <span className={cx("font-semibold", tone)}>{tr(item.verdict)}</span>
          {!hideScores && <span className="text-muted"> · {num(item.score)} p</span>}
        </p>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-canvas" />
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-navy-soft"
          style={{ left: pos(item.p25), width: `calc(${pos(item.p75)} - ${pos(item.p25)})` }}
          title={`${tr("Sector")} p25–p75: ${fmt(item.p25)} – ${fmt(item.p75)}`}
        />
        <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-navy-3" style={{ left: pos(item.median) }} title={`${tr("Mediana")}: ${fmt(item.median)}`} />
        <div
          className={cx(
            "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left] duration-500",
            item.verdict === "mai slab" ? "bg-amber" : "bg-emerald",
          )}
          style={{ left: pos(item.company) }}
          title={`${tr("Firma ta")}: ${fmt(item.company)}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span>{item.higherIsBetter ? tr("mai mic = mai slab") : tr("mai mic = mai bine")}</span>
        <span>{tr("bandă = 50% din firmele din sector")}</span>
      </div>
    </div>
  );
}
