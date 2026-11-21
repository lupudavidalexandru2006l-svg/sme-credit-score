"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { Company } from "@/types/scoring";
import { apiFetch } from "@/lib/auth/client";
import { useAuth } from "../AuthProvider";
import { Badge, Button, Card, CardHeader } from "../ui";

/** "Contul meu": the account, its role and the companies linked to it. */
export function AccountPage() {
  const { session, profile, isAdmin, signOut, loading, configured } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    apiFetch("/api/companies")
      .then((r) => r.json())
      .then((d: { companies?: Company[] }) => !cancelled && setCompanies(d.companies ?? []))
      .catch(() => !cancelled && setCompanies([]));
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return null;
  if (!session) {
    return (
      <Card className="mx-auto mt-6 max-w-[520px]">
        <CardHeader icon={<UserRound size={18} />} title="Contul meu" subtitle={configured ? "Nu ești autentificat." : "Conturile nu sunt activate pe acest server (mod Guest)."} />
        <div className="flex flex-wrap gap-2">
          {configured && (
            <Link href="/login?next=/cont" className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2">
              Autentificare
            </Link>
          )}
          <Link href="/onboarding" className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:border-line-strong">
            Continuă fără cont
          </Link>
          {isAdmin && (
            <Link href="/admin" className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:border-line-strong">
              Panou Admin (demo)
            </Link>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto mt-6 grid max-w-[880px] gap-5">
      <Card>
        <CardHeader
          icon={<UserRound size={18} />}
          title={profile?.fullName || session.user.email || "Contul meu"}
          subtitle={session.user.email ?? ""}
          action={<Badge tone={profile?.role === "admin" ? "emerald" : "neutral"}>{profile?.role === "admin" ? "admin" : "utilizator"}</Badge>}
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/onboarding" className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-2">
            Mergi la evaluare
          </Link>
          {isAdmin && (
            <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:border-line-strong">
              <ShieldCheck size={14} /> Panou Admin
            </Link>
          )}
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut size={14} /> Deconectare
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader icon={<Building2 size={18} />} title="Firmele din cont" subtitle="Firmele create în modul Guest în acest browser se leagă automat de cont la autentificare." />
        {companies === null ? (
          <p className="text-xs text-muted">Se încarcă…</p>
        ) : companies.length === 0 ? (
          <p className="text-xs text-muted">Nicio firmă salvată în cont încă (sau Supabase nu este configurat pe server).</p>
        ) : (
          <ul className="divide-y divide-line">
            {companies.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{c.officialName || c.name}</p>
                  <p className="text-[11px] text-muted">
                    {c.cui || "fără CUI"} · CAEN {c.caenCode || "—"} · {c.ceoName}
                    {c.ceoCnpMasked ? ` · CNP ${c.ceoCnpMasked}` : ""}
                  </p>
                </div>
                {c.payPerUseUnlocked && <Badge tone="emerald">Pay-Per-Use</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
