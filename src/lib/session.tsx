import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db as supabase } from "@/lib/db";
import type { Session } from "@supabase/supabase-js";
import { getCurrentSessionData } from "@/lib/session.functions";

export type Role = "super_admin" | "admin" | "secretario" | "consulta";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: { id: string; templo_id: string | null; nome: string | null; email: string | null } | null;
  templo: {
    id: string;
    nome: string;
    status: string;
    logo_path: string | null;
    theme_primary?: string | null;
    theme_accent?: string | null;
    theme_sidebar?: string | null;
  } | null;
  roles: Role[];
  accountError: string | null;
  refresh: () => Promise<void>;
};

const SessionCtx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionState["profile"]>(null);
  const [templo, setTemplo] = useState<SessionState["templo"]>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const lastUid = useRef<string | null>(null);

  const load = async (currentSession: Session | null | undefined) => {
    if (!currentSession?.user.id) {
      setProfile(null);
      setTemplo(null);
      setRoles([]);
      setAccountError(null);
      return;
    }
    try {
      const data = await getCurrentSessionData();
      setProfile(data.profile as SessionState["profile"]);
      setRoles((data.roles ?? []) as Role[]);
      setTemplo(data.templo as SessionState["templo"]);
      setAccountError(null);
    } catch (err) {
      console.error("Erro ao carregar dados da conta", err);
      setProfile(null);
      setTemplo(null);
      setRoles([]);
      setAccountError("Não foi possível carregar os dados da sua conta. Tente novamente.");
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setSession(data.session);
      lastUid.current = data.session?.user.id ?? null;
      await load(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event: string, s: Session | null) => {
      // Only react to identity transitions; ignore INITIAL_SESSION and TOKEN_REFRESHED
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const uid = s?.user.id ?? null;
      lastUid.current = uid;
      // Mark loading BEFORE exposing the new session so route gates (e.g. "/")
      // don't observe { session: signed-in, profile: null } and mistake it for
      // "no templo" → redirect to /onboarding.
      setLoading(true);
      await load(s);
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      userId: session?.user.id ?? null,
      profile,
      templo,
      roles,
      accountError,
      refresh: () => load(session),
    }),
    [loading, session, profile, templo, roles, accountError],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionCtx);
  if (!ctx) {
    // Fallback so early-called hooks (before provider mounts) don't crash.
    return {
      loading: true,
      session: null,
      userId: null,
      profile: null,
      templo: null,
      roles: [],
      accountError: null,
      refresh: async () => {},
    };
  }
  return ctx;
}

export function canWrite(roles: Role[]) {
  return roles.includes("super_admin") || roles.includes("admin") || roles.includes("secretario");
}
