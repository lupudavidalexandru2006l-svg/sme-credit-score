import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AccountButtons } from "@/components/Shell";

/** Account pages (login, register, my account, admin): brand header, no evaluation sidebar. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="no-print mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/onboarding" aria-label="Afghankingz Credit — acasă">
          <BrandLogo tagline />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted hover:bg-white/70 hover:text-ink">
            <ArrowLeft size={13} /> Înapoi la evaluare
          </Link>
          <AccountButtons />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-12 sm:px-8">{children}</main>
      <footer className="no-print mx-auto max-w-[1280px] px-4 pb-8 text-[11px] text-faint sm:px-8">
        © Afghankingz Credit · Credit Readiness pentru IMM-uri din România · nu reprezintă aprobare bancară ·{" "}
        <Link href="/termeni" className="hover:text-ink">Termeni</Link> · <Link href="/confidentialitate" className="hover:text-ink">Confidențialitate</Link>
      </footer>
    </div>
  );
}
