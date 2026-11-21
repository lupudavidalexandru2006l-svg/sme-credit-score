"use client";

import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { Card, CardHeader, cx } from "./ui";
import { FEATURE_MATRIX, PRICING_FAQ, type MatrixCell } from "@/lib/pricing";

const COLUMNS = ["Starter", "Pro", "Business", "Enterprise"];

function Cell({ value }: { value: MatrixCell }) {
  if (value === true) return <Check size={16} strokeWidth={2.5} className="mx-auto text-emerald" aria-label="inclus" />;
  if (value === false) return <Minus size={16} className="mx-auto text-faint" aria-label="neinclus" />;
  return <span className="text-xs text-ink">{value}</span>;
}

export function FeatureMatrix() {
  return (
    <Card>
      <CardHeader title="Comparație detaliată a planurilor" subtitle="Ce primești în fiecare plan, cu limitele exacte." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2.5 pr-4 text-left font-normal">Funcționalitate</th>
              {COLUMNS.map((c) => (
                <th key={c} className={cx("w-[14%] py-2.5 text-center font-medium", c === "Pro" ? "text-emerald-strong" : "text-ink")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          {FEATURE_MATRIX.map((group) => (
            <tbody key={group.category}>
              <tr>
                <td colSpan={5} className="pb-2 pt-5 text-xs font-medium text-faint">
                  {group.category}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-b border-line/60">
                  <td className="py-2.5 pr-4 text-ink">{row.label}</td>
                  {row.cells.map((cell, i) => (
                    <td key={COLUMNS[i]} className={cx("py-2.5 text-center", i === 1 && "bg-emerald-soft/40")}>
                      <Cell value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}

export function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Card>
      <CardHeader title="Întrebări frecvente" />
      <div className="divide-y divide-line">
        {PRICING_FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-ink"
              >
                {item.q}
                <ChevronDown size={16} className={cx("shrink-0 text-faint transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && <p className="animate-rise pb-4 pr-8 text-sm leading-relaxed text-muted">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
