import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Search, Settings, ShieldCheck, LogOut, Mail, Menu } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { getSessionRouteDecision, useSession, type Role } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AccountLoadError } from "@/components/AccountLoadError";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/mediuns", label: "Médiuns", icon: Users },
  { to: "/app/buscar", label: "Buscar", icon: Search },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Administrador Geral",
  admin: "Admin",
  secretario: "Secretário",
  consulta: "Consulta",
};

function useTemploLogo(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!path) { setUrl(null); return; }
      const { data } = await supabase.storage.from("templos-logos").createSignedUrl(path, 3600);
      if (alive && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => { alive = false; };
  }, [path]);
  return url;
}

function primaryRole(roles: Role[]): Role | null {
  const order: Role[] = ["super_admin", "admin", "secretario", "consulta"];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const s = useSession();
  const nav = useNavigate();
  const path = useRouterState({ select: (st) => st.location.pathname });
  const [open, setOpen] = useState(false);
  const temploLogo = useTemploLogo(s.templo?.logo_path);
  const decision = getSessionRouteDecision(s);

  if (decision.state === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-background">Carregando…</div>;
  }

  if (decision.state === "signed_out") {
    nav({ to: "/login" });
    return null;
  }

  const isSuper = s.roles.includes("super_admin");

  if (decision.state === "account_error") {
    return <AccountLoadError error={s.accountError} onRetry={() => s.refresh()} onSignOut={() => supabase.auth.signOut()} />;
  }

  if (decision.state === "templo_status" || decision.state === "needs_onboarding") {
    nav({ to: "/onboarding" });
    return null;
  }

  const navItems = isSuper
    ? ([{ to: "/app/admin", label: "Painel Global", icon: ShieldCheck }] as const)
    : NAV;

  const role = primaryRole(s.roles);
  const roleLabel = role ? ROLE_LABEL[role] : "";
  const contextName = isSuper ? "Administração Geral" : s.templo?.nome ?? "";

  const Sidebar = (
    <aside className="w-72 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
          <img src={brandingLogo} alt="TemploHub" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="font-semibold text-lg leading-tight">TemploHub</div>
          <div className="text-sm text-sidebar-primary truncate">{contextName}</div>
        </div>
      </div>

      {/* Templo card */}
      {!isSuper && s.templo && (
        <div className="px-4">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-sidebar-accent shrink-0 ring-1 ring-sidebar-border">
              {temploLogo ? (
                <img src={temploLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-sidebar-primary/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{s.templo.nome}</div>
              {roleLabel && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-semibold uppercase tracking-wider">
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Divider + section label with golden diamond ornament */}
      <div className="px-5 pt-5">
        <div className="border-t border-sidebar-border/60" />
        <div className="mt-4 flex items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
            Navegação
          </div>
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-sidebar-primary shrink-0" fill="currentColor" aria-hidden>
            <path d="M6 0 L12 6 L6 12 L0 6 Z" />
          </svg>
          <div className="flex-1 h-px bg-gradient-to-r from-sidebar-primary/60 to-transparent" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-3 space-y-1">
        {navItems.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "relative flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-accent/60 text-sidebar-primary"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent/40",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />
              )}
              <span
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  active ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-sidebar-accent/60 text-sidebar-foreground/80",
                )}
              >
                <n.icon className="w-4 h-4" />
              </span>
              <span className={cn("truncate", active ? "font-medium" : "")}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sun ornament */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-2 text-sidebar-primary/80">
        <svg viewBox="0 0 6 6" className="w-1.5 h-1.5 shrink-0" fill="currentColor" aria-hidden>
          <path d="M3 0 L6 3 L3 6 L0 3 Z" />
        </svg>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-sidebar-primary/50 to-transparent" />
        <svg viewBox="0 0 40 20" className="w-12 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden>
          <path d="M2 18 A 18 18 0 0 1 38 18" />
          <path d="M20 18 L20 2 M20 18 L8 6 M20 18 L32 6 M20 18 L4 12 M20 18 L36 12 M20 18 L14 3 M20 18 L26 3" strokeLinecap="round" />
          <circle cx="20" cy="18" r="2" fill="currentColor" />
        </svg>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-sidebar-primary/50 to-transparent" />
        <svg viewBox="0 0 6 6" className="w-1.5 h-1.5 shrink-0" fill="currentColor" aria-hidden>
          <path d="M3 0 L6 3 L3 6 L0 3 Z" />
        </svg>
      </div>

      {/* Footer */}
      <div className="p-4 space-y-2">

        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/15 flex items-center justify-center shrink-0 ring-1 ring-sidebar-primary/30">
            <Mail className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] leading-tight break-all">{s.profile?.email}</div>
            <div className="text-xs text-sidebar-foreground/60">
              {roleLabel || "Usuário"}
            </div>
          </div>

        </div>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            nav({ to: "/login" });
          }}
          className="w-full flex items-center gap-3 rounded-xl bg-sidebar-accent/40 hover:bg-sidebar-accent/60 px-3 py-3 text-sm text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </aside>
  );

  const themeStyle = !isSuper && s.templo
    ? ({
        ...(s.templo.theme_primary ? { "--primary": s.templo.theme_primary, "--ring": s.templo.theme_primary } : {}),
        ...(s.templo.theme_accent ? { "--accent": s.templo.theme_accent, "--sidebar-primary": s.templo.theme_accent } : {}),
        ...(s.templo.theme_sidebar ? { "--sidebar": s.templo.theme_sidebar } : {}),
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-background flex" style={themeStyle}>
      <div className="hidden md:flex">{Sidebar}</div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
              {Sidebar}
            </SheetContent>
          </Sheet>
          <div className="font-semibold flex-1">TemploHub</div>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              nav({ to: "/login" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted hover:bg-muted/70 px-3 h-9 text-sm text-foreground/80"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
