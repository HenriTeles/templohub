import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db as supabase } from "@/lib/db";
import type { Session } from "@supabase/supabase-js";
import { getCurrentSessionData } from "@/lib/session.functions";

export type Role = "super_admin" | "admin" | "secretario" | "consulta";

type ProfileRow = SessionState["profile"];
type TemploRow = SessionState["templo"];
type RoleRow = { role: Role; templo_id: string | null };

function fallbackProfileFromSession(currentSession: Session): NonNullable<ProfileRow> {
  const email = currentSession.user.email ?? null;
  const metadataName = currentSession.user.user_metadata?.nome;
  return {
    id: currentSession.user.id,
    templo_id: null,
    nome: typeof metadataName === "string" && metadataName.trim() ? metadataName : email?.split("@")[0] ?? "usuario",
    email,
  };
}

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
  accountError: AccountErrorInfo | null;
  refresh: (nextSession?: Session | null) => Promise<SessionSnapshot | null>;
};

export type AccountErrorInfo = {
  message: string;
  origin: string;
  detail: string;
  clientDetail?: string;
  serverDetail?: string;
  action?: string;
};

export type SessionSnapshot = {
  profile: SessionState["profile"];
  templo: SessionState["templo"];
  roles: Role[];
};

export type SessionRouteDecision =
  | { state: "loading" }
  | { state: "signed_out"; to: "/login" }
  | { state: "account_error" }
  | { state: "admin"; to: "/app/admin" }
  | { state: "templo_active"; to: "/app/dashboard" }
  | { state: "templo_status"; to: "/onboarding" }
  | { state: "needs_onboarding"; to: "/onboarding" };

export function getSessionRouteDecision(
  state: Pick<SessionState, "loading" | "session" | "profile" | "templo" | "roles" | "accountError">,
): SessionRouteDecision {
  if (state.loading) return { state: "loading" };
  if (!state.session) return { state: "signed_out", to: "/login" };
  if (state.accountError) return { state: "account_error" };
  if (state.roles.includes("super_admin")) return { state: "admin", to: "/app/admin" };
  if (state.templo?.status === "ativo") return { state: "templo_active", to: "/app/dashboard" };
  if (state.templo) return { state: "templo_status", to: "/onboarding" };

  // Regra crítica de estabilidade: uma conta existente com templo_id nunca deve
  // ser enviada para cadastro por falha/atraso na leitura do templo. Onboarding
  // é permitido somente quando a sessão carregou sem erro e não existe vínculo.
  if (state.profile?.templo_id) return { state: "account_error" };

  return { state: "needs_onboarding", to: "/onboarding" };
}

const SessionCtx = createContext<SessionState | null>(null);

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function createAccountLoadError(clientErr: unknown, serverErr?: unknown): AccountErrorInfo {
  const clientDetail = getErrorMessage(clientErr);
  const serverDetail = getErrorMessage(serverErr);
  const combined = [clientDetail, serverDetail].filter(Boolean).join(" | ");
  const lower = combined.toLowerCase();

  if (lower.includes("permission denied for function")) {
    const match = combined.match(/permission denied for function\s+([a-zA-Z0-9_]+)/i);
    const fn = match?.[1] ? ` ${match[1]}` : "";
    return {
      message: "O login foi aceito, mas o Supabase bloqueou a leitura dos dados da conta.",
      origin: `Supabase/RLS: permissão de execução ausente na função${fn}`,
      detail: combined,
      clientDetail: clientDetail || undefined,
      serverDetail: serverDetail || undefined,
      action: "Execute o SQL de reparo de permissões no Supabase externo e tente novamente.",
    };
  }

  if (lower.includes("missing supabase")) {
    return {
      message: "O login foi aceito, mas a configuração do Supabase no servidor está incompleta.",
      origin: "Configuração de ambiente do Supabase",
      detail: combined,
      clientDetail: clientDetail || undefined,
      serverDetail: serverDetail || undefined,
      action: "Confira as variáveis SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e, quando necessário, SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  if (serverDetail.toLowerCase().includes("not found")) {
    return {
      message: "O login foi aceito, mas o fallback de sessão não foi encontrado no servidor.",
      origin: "Server function de sessão",
      detail: combined || "Server function retornou Not found.",
      clientDetail: clientDetail || undefined,
      serverDetail: serverDetail || undefined,
      action: "Atualize a publicação/preview para garantir que as server functions estejam sincronizadas.",
    };
  }

  return {
    message: "O login foi aceito, mas não foi possível carregar perfil, papéis e templo.",
    origin: "Carregamento da conta",
    detail: combined || "Erro desconhecido ao carregar dados da sessão.",
    clientDetail: clientDetail || undefined,
    serverDetail: serverDetail || undefined,
    action: "Tente novamente. Se persistir, verifique políticas RLS, grants e vínculo do usuário no Supabase.",
  };
}

function hasAuthoritativeRouteData(data: SessionSnapshot | null): boolean {
  if (!data) return false;
  return Boolean(data.templo || data.profile?.templo_id || data.roles.length > 0);
}

async function loadSessionDataFromSupabase(currentSession: Session): Promise<{
  profile: ProfileRow;
  templo: TemploRow;
  roles: Role[];
}> {
  const userId = currentSession.user.id;
  const fallbackProfile = fallbackProfileFromSession(currentSession);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, templo_id, nome, email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const { data: roleRowsData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, templo_id")
    .eq("user_id", userId);
  if (rolesError) throw new Error(rolesError.message);

  const roleRows = (roleRowsData ?? []) as RoleRow[];
  const roles = Array.from(new Set(roleRows.map((row) => row.role)));
  const isSuperAdmin = roles.includes("super_admin");
  const roleTemploId = roleRows.find((row) => row.templo_id)?.templo_id ?? null;

  let profile = (profileData as ProfileRow) ?? null;

  if (!profile) {
    if (roleRows.length > 0) {
      throw new Error(
        "Perfil da conta não encontrado no Supabase externo. A conta tem permissões, mas a tabela profiles não foi reconciliada.",
      );
    }
    return { profile: fallbackProfile, roles, templo: null };
  }

  if (!profile.templo_id && roleTemploId && !isSuperAdmin) {
    const { error: syncProfileError } = await supabase
      .from("profiles")
      .update({ templo_id: roleTemploId })
      .eq("id", userId);
    if (syncProfileError) throw new Error(syncProfileError.message);
    profile = { ...profile, templo_id: roleTemploId };
  }

  const temploId = profile.templo_id ?? roleTemploId;
  let templo: TemploRow = null;
  if (temploId && !isSuperAdmin) {
    const { data: temploData, error: temploError } = await supabase
      .from("templos")
      .select("id, nome, status, logo_path, theme_primary, theme_accent, theme_sidebar")
      .eq("id", temploId)
      .maybeSingle();
    if (temploError) throw new Error(temploError.message);
    if (!temploData) {
      throw new Error("Templo vinculado não encontrado ou sem permissão de leitura no Supabase externo.");
    }
    templo = temploData as TemploRow;
  }

  return { profile, roles, templo };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionState["profile"]>(null);
  const [templo, setTemplo] = useState<SessionState["templo"]>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accountError, setAccountError] = useState<AccountErrorInfo | null>(null);
  const lastUid = useRef<string | null>(null);
  const loadSeq = useRef(0);

  const load = async (currentSession: Session | null | undefined): Promise<SessionSnapshot | null> => {
    if (!currentSession?.user.id) {
      setProfile(null);
      setTemplo(null);
      setRoles([]);
      setAccountError(null);
      return null;
    }
    try {
      const data = await loadSessionDataFromSupabase(currentSession);
      setProfile(data.profile as SessionState["profile"]);
      setRoles((data.roles ?? []) as Role[]);
      setTemplo(data.templo as SessionState["templo"]);
      setAccountError(null);
      return data as SessionSnapshot;
    } catch (clientErr) {
      try {
        const data = await getCurrentSessionData();
        const snapshot = data as SessionSnapshot;
        setProfile(snapshot.profile as SessionState["profile"]);
        setRoles((snapshot.roles ?? []) as Role[]);
        setTemplo(snapshot.templo as SessionState["templo"]);

        if (!hasAuthoritativeRouteData(snapshot)) {
          setAccountError(createAccountLoadError(clientErr, "Sessão carregada sem papel, templo ou vínculo de perfil."));
          return null;
        }

        setAccountError(null);
        return snapshot;
      } catch (serverErr) {
        console.error("Erro ao carregar dados da conta", { clientErr, serverErr });
        setProfile(null);
        setTemplo(null);
        setRoles([]);
        setAccountError(createAccountLoadError(clientErr, serverErr));
        return null;
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      const seq = ++loadSeq.current;
      setSession(data.session);
      lastUid.current = data.session?.user.id ?? null;
      await load(data.session);
      if (!mounted || seq !== loadSeq.current) return;
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, s: Session | null) => {
      // Only react to identity transitions; ignore INITIAL_SESSION and TOKEN_REFRESHED
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const uid = s?.user.id ?? null;
      lastUid.current = uid;
      // Mark loading BEFORE exposing the new session so route gates (e.g. "/")
      // don't observe { session: signed-in, profile: null } and mistake it for
      // "no templo" → redirect to /onboarding.
      setLoading(true);
      const seq = ++loadSeq.current;
      void (async () => {
        await load(s);
        if (!mounted || seq !== loadSeq.current) return;
        setSession(s);
        setLoading(false);
      })();
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
      refresh: (nextSession?: Session | null) => load(nextSession === undefined ? session : nextSession),
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
      refresh: async () => null,
    };
  }
  return ctx;
}

export function canWrite(roles: Role[]) {
  return roles.includes("super_admin") || roles.includes("admin") || roles.includes("secretario");
}
