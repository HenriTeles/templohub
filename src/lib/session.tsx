import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db as supabase } from "@/lib/db";
import type { Session } from "@supabase/supabase-js";

export type Role = "super_admin" | "admin" | "secretario" | "consulta";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: { id: string; templo_id: string | null; nome: string | null; email: string | null } | null;
  templo: { id: string; nome: string; status: string; logo_path: string | null } | null;
  roles: Role[];
  refresh: () => Promise<void>;
};

const SessionCtx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionState["profile"]>(null);
  const [templo, setTemplo] = useState<SessionState["templo"]>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const lastUid = useRef<string | null>(null);

  const load = async (uid: string | undefined | null) => {
    if (!uid) {
      setProfile(null);
      setTemplo(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, templo_id, nome, email").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as SessionState["profile"]);
    const rr = ((r as { role: Role }[]) || []).map((x) => x.role);
    setRoles(rr);
    const templo_id = (p as { templo_id?: string | null } | null)?.templo_id ?? null;
    if (templo_id && !rr.includes("super_admin")) {
      const { data: t } = await supabase
        .from("templos")
        .select("id, nome, status, logo_path")
        .eq("id", templo_id)
        .maybeSingle();
      setTemplo(t as SessionState["templo"]);
    } else {
      setTemplo(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setSession(data.session);
      lastUid.current = data.session?.user.id ?? null;
      await load(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event: string, s: Session | null) => {
      // Only react to identity transitions; ignore INITIAL_SESSION and TOKEN_REFRESHED
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const uid = s?.user.id ?? null;
      // avoid duplicate work when SIGNED_IN fires for the same user we already loaded
      if (event === "SIGNED_IN" && uid === lastUid.current && profile) return;
      lastUid.current = uid;
      setSession(s);
      await load(uid);
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
      refresh: () => load(session?.user.id),
    }),
    [loading, session, profile, templo, roles],
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
      refresh: async () => {},
    };
  }
  return ctx;
}

export function canWrite(roles: Role[]) {
  return roles.includes("super_admin") || roles.includes("admin") || roles.includes("secretario");
}
