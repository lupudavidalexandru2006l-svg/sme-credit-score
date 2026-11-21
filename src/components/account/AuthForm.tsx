"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, KeyRound, LoaderCircle, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { BrandIcon } from "../BrandLogo";
import { Button, cx, Field, inputCls } from "../ui";

/** Where to go after signing in: ?next=/path (same-origin paths only), else the evaluation. */
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") ?? "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/onboarding";
}

/** Discreet hackathon entry: the ADMIN_DEMO_CODE opens /admin without an account (httpOnly cookie). */
function DemoAdminAccess() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mx-auto mt-6 flex items-center gap-1 text-[11px] text-faint hover:text-muted">
        <ShieldCheck size={11} /> Acces demo admin (hackathon)
      </button>
    );
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await fetch("/api/admin/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then((x) => x.json())) as { ok: boolean; error?: string };
      if (!r.ok) setError(r.error ?? "Acces refuzat.");
      else {
        await refreshProfile();
        router.push("/admin");
      }
    } catch {
      setError("API indisponibil.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-dashed border-line p-4">
      <p className="text-xs font-medium text-ink">Acces demo admin</p>
      <p className="mt-0.5 text-[11px] text-muted">Codul din variabila ADMIN_DEMO_CODE a serverului. Deschide panoul /admin pentru 8 ore.</p>
      <div className="mt-3 flex gap-2">
        <input type="password" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Cod de acces" autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={busy || !code}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <KeyRound size={14} />} Intră
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </form>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { configured, signIn, signUp, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const register = mode === "register";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const r = register ? await signUp(email, password, fullName) : await signIn(email, password);
    setResult(r);
    setBusy(false);
    if (r.ok && (!register || r.message.startsWith("Cont creat. Firmele"))) router.push(nextPath());
  };

  return (
    <div className="mx-auto mt-6 w-full max-w-[440px]">
      <div className="rounded-[28px] border border-white/80 bg-card p-7 shadow-card">
        <BrandIcon size={40} />
        <h1 className="mt-4 text-2xl font-normal tracking-tight text-ink">{register ? "Creează cont Afghankingz Credit" : "Autentificare"}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {register ? "Firmele, facturile și istoricul evaluărilor se leagă de contul tău și le regăsești pe orice dispozitiv." : "Intră în cont ca să-ți regăsești firmele și istoricul evaluărilor."}
        </p>

        {session ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-soft px-3.5 py-2.5 text-xs text-emerald-strong">
            <CircleCheck size={14} className="mt-0.5 shrink-0" /> Ești autentificat ca {session.user.email}.{" "}
            <Link href="/onboarding" className="underline">
              Mergi la evaluare
            </Link>
          </p>
        ) : !configured ? (
          <p className="mt-5 rounded-xl bg-amber-soft px-3.5 py-3 text-xs leading-relaxed text-amber">
            Conturile nu sunt activate pe acest server: lipsesc NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY. Poți folosi aplicația complet în modul fără cont (Guest) — datele rămân în acest browser.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {register && (
              <Field label="Nume complet">
                <input required className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Parolă" hint={register ? "Minimum 8 caractere." : undefined}>
              <input required type="password" minLength={register ? 8 : undefined} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : register ? <UserPlus size={15} /> : <LogIn size={15} />}
              {register ? "Creează contul" : "Autentificare"}
            </Button>
            {result && (
              <p className={cx("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs", result.ok ? "bg-emerald-soft text-emerald-strong" : "bg-red-soft text-red")}>
                {result.ok ? <CircleCheck size={14} className="mt-0.5 shrink-0" /> : <CircleAlert size={14} className="mt-0.5 shrink-0" />}
                {result.message}
              </p>
            )}
          </form>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
          {register ? (
            <span>
              Ai deja cont?{" "}
              <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
                Autentifică-te
              </Link>
            </span>
          ) : (
            <span>
              Nu ai cont?{" "}
              <Link href="/register" className="font-medium text-ink underline-offset-2 hover:underline">
                Creează unul gratuit
              </Link>
            </span>
          )}
          <Link href="/onboarding" className="hover:text-ink">
            Continuă fără cont (Guest)
          </Link>
        </div>
      </div>
      {!register && <DemoAdminAccess />}
    </div>
  );
}
