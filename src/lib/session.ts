import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: { id: string; templo_id: string | null; nome: string | null; email: string | null } | null;
  templo: { id: string; nome: string; status: string } | null;
  roles: Array<"super_admin" | "admin" | "secretario" | "consulta">;
  refresh: () => Promise<void>;
};

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionState["profile"]>(null);
  const [templo, setTemplo] = useState<SessionState["templo"]>(null);
  const [roles, setRoles] = useState<SessionState["roles"]>([]);

  const load = async (uid: string | undefined | null) => {
    if (!uid) {
      setProfile(null);
      setTemplo(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, templo_id, nome, email").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role, templo_id").eq("user_id", uid),
    ]);
    setProfile(p as SessionState["profile"]);
    setRoles(((r as { role: SessionState["roles"][number] }[]) || []).map((x) => x.role));
    if (p?.templo_id) {
      const { data: t } = await supabase
        .from("templos")
        .select("id, nome, status")
        .eq("id", p.templo_id)
        .maybeSingle();
      setTemplo(t as SessionState["templo"]);
    } else {
      setTemplo(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await load(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await load(s?.user.id);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    loading,
    session,
    userId: session?.user.id ?? null,
    profile,
    templo,
    roles,
    refresh: () => load(session?.user.id),
  };
}

export function canWrite(roles: SessionState["roles"]) {
  return roles.includes("super_admin") || roles.includes("admin") || roles.includes("secretario");
}
