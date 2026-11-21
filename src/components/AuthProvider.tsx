"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, authConfigured, getBrowserSupabase, setAccessToken } from "@/lib/auth/client";

export interface AccountProfile {
  id: string;
  email: string;
  fullName: string;
  role: "user" | "admin";
}

interface AuthCtx {
  /** False when Supabase Auth is not configured: guest mode only. */
  configured: boolean;
  /** True until the stored session has been read. */
  loading: boolean;
  session: Session | null;
  profile: AccountProfile | null;
  /** Account admin (role 'admin') or the hackathon demo-admin session. */
  isAdmin: boolean;
  demoAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDemoAdmin: (on: boolean) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

const translate = (msg: string) =>
  /invalid login credentials/i.test(msg)
    ? "Email sau parolă greșită."
    : /email not confirmed/i.test(msg)
      ? "Confirmă adresa de email din mesajul primit, apoi autentifică-te."
      : /already registered|already exists/i.test(msg)
        ? "Există deja un cont cu acest email. Autentifică-te."
        : /password/i.test(msg)
          ? "Parola trebuie să aibă cel puțin 8 caractere."
          : msg;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(authConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [demoAdmin, setDemoAdminState] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const r = (await apiFetch("/api/account/profile").then((x) => x.json())) as { ok: boolean; profile?: AccountProfile; demoAdmin?: boolean };
      setProfile(r.ok && r.profile ? r.profile : null);
      setDemoAdminState(Boolean(r.demoAdmin));
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      // Guest mode: only the demo-admin cookie can exist.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the demo-admin session from the API once
      void loadProfile();
      return;
    }
    let active = true;
    void sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccessToken(data.session?.access_token ?? null);
      setSession(data.session);
      setLoading(false);
      void loadProfile();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setAccessToken(s?.access_token ?? null);
      setSession(s);
      void loadProfile();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return { ok: false, message: "Conturile nu sunt activate: lipsesc cheile Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)." };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, message: translate(error.message) } : { ok: true, message: "Autentificat." };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return { ok: false, message: "Conturile nu sunt activate: lipsesc cheile Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)." };
    if (password.length < 8) return { ok: false, message: "Parola trebuie să aibă cel puțin 8 caractere." };
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
    if (error) return { ok: false, message: translate(error.message) };
    return data.session
      ? { ok: true, message: "Cont creat. Firmele și evaluările tale se salvează acum în cont." }
      : { ok: true, message: "Cont creat. Confirmă adresa de email din mesajul primit, apoi autentifică-te." };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    setAccessToken(null);
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      configured: authConfigured,
      loading,
      session,
      profile,
      isAdmin: profile?.role === "admin" || demoAdmin,
      demoAdmin,
      signIn,
      signUp,
      signOut,
      refreshProfile: loadProfile,
      setDemoAdmin: setDemoAdminState,
    }),
    [loading, session, profile, demoAdmin, signIn, signUp, signOut, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
