/**
 * Synthetic sector benchmarks per CAEN code: [p25, median, p75] of each indicator.
 * Orders of magnitude are plausible for Romanian SMEs, but the numbers are invented
 * for the prototype (same values are seeded into the `sector_benchmarks` table).
 */
import type { SectorBenchmark } from "../../types/scoring";

export const SECTOR_BENCHMARKS: SectorBenchmark[] = [
  {
    caenCode: "4639",
    label: "Comerț cu ridicata nespecializat de alimente, băuturi și tutun",
    companies: 412,
    dsoDays: [30, 42, 58],
    topClientSharePct: [16, 24, 35],
    creditNotesPct: [1.2, 2.5, 4.5],
    seasonalityRatio: [1.35, 1.6, 1.95],
    grossMarginPct: [14, 19, 24],
  },
  {
    caenCode: "5610",
    label: "Restaurante",
    companies: 1280,
    dsoDays: [5, 12, 25],
    topClientSharePct: [6, 12, 22],
    creditNotesPct: [0.4, 1.1, 2.4],
    seasonalityRatio: [1.3, 1.7, 2.3],
    grossMarginPct: [55, 63, 70],
  },
  {
    caenCode: "4711",
    label: "Comerț cu amănuntul în magazine nespecializate (alimentar)",
    companies: 960,
    dsoDays: [3, 8, 18],
    topClientSharePct: [5, 10, 20],
    creditNotesPct: [0.3, 0.9, 2.0],
    seasonalityRatio: [1.2, 1.4, 1.7],
    grossMarginPct: [18, 23, 28],
  },
  {
    caenCode: "1071",
    label: "Fabricarea pâinii și a produselor proaspete de patiserie",
    companies: 530,
    dsoDays: [20, 32, 48],
    topClientSharePct: [18, 28, 42],
    creditNotesPct: [1.5, 3.0, 5.5],
    seasonalityRatio: [1.15, 1.3, 1.55],
    grossMarginPct: [28, 35, 42],
  },
  {
    caenCode: "4941",
    label: "Transporturi rutiere de mărfuri",
    companies: 1710,
    dsoDays: [35, 50, 70],
    topClientSharePct: [20, 32, 48],
    creditNotesPct: [0.8, 1.8, 3.5],
    seasonalityRatio: [1.2, 1.4, 1.75],
    grossMarginPct: [22, 30, 38],
  },
  {
    caenCode: "6201",
    label: "Activități de realizare a software-ului la comandă",
    companies: 880,
    dsoDays: [25, 38, 55],
    topClientSharePct: [25, 40, 60],
    creditNotesPct: [0.2, 0.8, 2.0],
    seasonalityRatio: [1.15, 1.35, 1.7],
    grossMarginPct: [45, 60, 75],
  },
];

export const findSector = (caen: string) =>
  SECTOR_BENCHMARKS.find((s) => s.caenCode === caen) ?? SECTOR_BENCHMARKS[0];
