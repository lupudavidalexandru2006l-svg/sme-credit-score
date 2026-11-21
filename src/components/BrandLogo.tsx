import { cx } from "./ui";

/**
 * Afghankingz Credit mark: a financial shield with three rising bars (growth / credit score)
 * under a three-point crown line. Pure SVG, colours from the theme tokens, prints in black & white.
 */
export function BrandIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path d="M16 2.5 27.5 7v8.6c0 7.1-4.8 12.2-11.5 14.4C9.3 27.8 4.5 22.7 4.5 15.6V7L16 2.5Z" fill="var(--navy)" />
      <path d="M16 4.9 25.4 8.6v7c0 5.9-3.9 10.2-9.4 12.1-5.5-1.9-9.4-6.2-9.4-12.1v-7L16 4.9Z" fill="var(--navy-2)" />
      <path d="m10.2 10.6 2.3 1.9L16 8.9l3.5 3.6 2.3-1.9-.7 3.4H10.9l-.7-3.4Z" fill="#d9b25f" />
      <rect x="10.4" y="19.2" width="2.9" height="4.6" rx="1" fill="var(--emerald)" opacity=".6" />
      <rect x="14.55" y="16.9" width="2.9" height="6.9" rx="1" fill="var(--emerald)" opacity=".85" />
      <rect x="18.7" y="14.6" width="2.9" height="9.2" rx="1" fill="var(--emerald)" />
    </svg>
  );
}

export function BrandLogo({ size = "md", className, tagline = false }: { size?: "sm" | "md" | "lg"; className?: string; tagline?: boolean }) {
  const icon = size === "lg" ? 40 : size === "sm" ? 22 : 28;
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <BrandIcon size={icon} />
      <span className="leading-none">
        <span className={cx("block tracking-tight text-ink", size === "lg" ? "text-2xl" : size === "sm" ? "text-[13px]" : "text-[15px]")}>
          <span className="font-semibold">Afghankingz</span> <span className="font-normal text-muted">Credit</span>
        </span>
        {tagline && <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-faint">Credit Readiness pentru IMM</span>}
      </span>
    </span>
  );
}
