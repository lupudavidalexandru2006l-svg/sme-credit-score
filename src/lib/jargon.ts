/**
 * "Pe înțelesul antreprenorului": one plain-language sentence per banking indicator,
 * built from the firm's real numbers. Pure module.
 */
import type { Assessment } from "./assessment.ts";
import { cashFreedByDso, SAFE_DSCR } from "./loan-math.ts";

const ron = (n: number) => `${Math.round(n).toLocaleString("ro-RO")} RON`;
const n2 = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const n1 = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 1 });

export type JargonKey = "dscr" | "dso" | "concentration" | "storno" | "volatility";

/** Target collection term used in the DSO explanation (common renegotiation target). */
export const DSO_TARGET_DAYS = 30;

export function explain(key: JargonKey, a: Assessment): string {
  const m = a.metrics;
  const b = a.business;
  switch (key) {
    case "dscr": {
      if (b.dscr >= 99) return "Firma nu are rate de plătit acum și nici un credit nou cerut, deci nu există un raport de acoperire a datoriei.";
      const pos = b.dscr >= SAFE_DSCR ? "Ești peste pragul minim de siguranță al băncilor (1,25)." : b.dscr >= 1 ? "Ești sub pragul minim al băncilor (1,25): rata se plătește, dar fără marjă de siguranță." : "Încasările nu acoperă ratele: băncile resping de regulă cererea în această situație.";
      return `Pentru fiecare 1 RON pe care trebuie să-l dai la rate, firma ta produce ${n2(b.dscr)} RON. ${pos}`;
    }
    case "dso": {
      const days = Math.round(m.dsoDays);
      if (days <= DSO_TARGET_DAYS) return `Clienții îți plătesc în medie în ${days} de zile — sub ${DSO_TARGET_DAYS} de zile, un termen pe care băncile îl consideră sănătos.`;
      const freed = cashFreedByDso(m.annualizedRevenue, m.dsoDays, DSO_TARGET_DAYS);
      return `Banii tăi stau blocați la clienți ${days} de zile. Dacă renegociezi la ${DSO_TARGET_DAYS} de zile, eliberezi aproximativ ${ron(freed)} în cash.`;
    }
    case "concentration": {
      const top = m.topClients[0]?.name ?? "clientul principal";
      const share = m.topClientSharePct;
      if (share < 15) return `Cel mai mare client (${top}) aduce doar ${n1(share)}% din vânzări: dacă pleacă, firma nu e pusă în pericol.`;
      return `${n1(share)}% din vânzări vin de la ${top}. Dacă acest client întârzie plata sau pleacă, pierzi ${ron((m.annualizedRevenue * share) / 100)} pe an — de aceea băncile vor sub 30–40%.`;
    }
    case "storno": {
      const st = m.creditNotesSharePct3m;
      return st > 5
        ? `În ultimele 3 luni ai anulat (stornat) ${n1(st)}% din facturile emise. Peste 5%, banca citește asta ca probleme de calitate sau dispute cu clienții.`
        : `Stornările (facturi anulate) sunt ${n1(st)}% din vânzări în ultimele 3 luni — sub pragul de 5% la care băncile pun întrebări.`;
    }
    case "volatility": {
      const cv = m.revenueCv * 100;
      return cv < 15
        ? `Vânzările lunare variază în medie cu ${n1(cv)}% de la o lună la alta: un venit stabil, ușor de creditat.`
        : `Vânzările lunare variază în medie cu ${n1(cv)}% (cea mai bună lună e de ${n1(m.seasonalityRatio)} ori cea mai slabă): banca va verifica dacă poți plăti rata și în lunile slabe.`;
    }
  }
}
