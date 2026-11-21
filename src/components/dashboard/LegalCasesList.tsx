import { CircleCheck, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import type { CourtCase, LegalCheckResult } from "@/types/scoring";
import { cx, NeuButton } from "@/components/ui/neu";

const SOURCE_BADGE: Record<LegalCheckResult["source"], { label: string; cls: string }> = {
  "portal.just.ro": { label: "LIVE portal.just.ro", cls: "text-positive" },
  simulation: { label: "SIMULARE", cls: "text-amber" },
  fallback: { label: "FALLBACK", cls: "text-scarlet" },
};

const ROLE_STYLE: Record<CourtCase["roleCategory"], { cls: string; hint: string }> = {
  vizat: { cls: "text-scarlet", hint: "Dosarul este îndreptat împotriva părții căutate" },
  nevizat: { cls: "text-positive", hint: "Partea căutată este de partea cealaltă (creditor, reclamant, victimă)" },
  necunoscut: { cls: "text-amber", hint: "Rol ambiguu sau lipsă — tratat conservator" },
};

export function LegalCasesList({
  legal,
  loading,
  onRetry,
}: {
  legal: LegalCheckResult | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading || !legal) {
    return (
      <div className="neu-pressed flex items-center gap-3 rounded-2xl p-5 text-sm text-muted">
        <LoaderCircle className="animate-spin text-stone" size={18} />
        Se interoghează portal.just.ro (timeout 5 secunde)…
      </div>
    );
  }

  const badge = SOURCE_BADGE[legal.source];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cx("neu-pressed-sm rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-wider", badge.cls)}>
            {badge.label}
          </span>
          <span className="text-xs text-muted">
            Căutare: „{legal.query.companyName}” + „{legal.query.ceoName}”
          </span>
        </div>
        <NeuButton variant="ghost" className="px-3 py-2 text-xs" onClick={onRetry}>
          <RefreshCw size={14} /> Re-verifică
        </NeuButton>
      </div>

      <p className={cx("text-sm", legal.isFallback ? "text-amber" : "text-muted")}>{legal.message}</p>

      {legal.cases.length === 0 && !legal.isFallback && (
        <div className="neu-pressed flex items-center gap-3 rounded-2xl p-5">
          <CircleCheck className="text-positive" size={22} />
          <div>
            <p className="font-bold">0 litigii identificate</p>
            <p className="text-xs text-muted">Nicio înregistrare pe numele firmei sau al administratorului.</p>
          </div>
        </div>
      )}

      {legal.cases.length > 0 && (
        <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {legal.cases.map((c) => (
            <li
              key={`${c.numar}-${c.institutie}`}
              className={cx("neu-pressed rounded-2xl p-4", c.isCritical && "ring-1 ring-scarlet/60")}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold">{c.numar}</p>
                  <p className="text-xs text-muted">
                    {c.institutie} {c.data && `· ${c.data}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="neu-raised-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {c.matchedBy}
                  </span>
                  <span
                    title={ROLE_STYLE[c.roleCategory].hint}
                    className={cx(
                      "neu-pressed-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider",
                      ROLE_STYLE[c.roleCategory].cls,
                    )}
                  >
                    {c.partyRoles.length > 0 ? c.partyRoles.join(" / ") : "rol neidentificat"}
                  </span>
                  {c.isCritical && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-scarlet/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-scarlet">
                      <ShieldAlert size={12} /> risc critic
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm">{c.obiect || "—"}</p>
              <p className="mt-1 text-xs text-muted">
                {c.categorie} {c.stadiu && `· ${c.stadiu}`}
                {c.matchedKeywords.length > 0 &&
                  (c.isCritical ? (
                    <span className="text-scarlet"> · cuvinte-cheie: {c.matchedKeywords.join(", ")}</span>
                  ) : (
                    <span className="text-positive">
                      {" "}
                      · cuvinte-cheie ({c.matchedKeywords.join(", ")}) ignorate: partea nu este vizată
                    </span>
                  ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
