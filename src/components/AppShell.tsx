import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Search, Settings, ShieldCheck, LogOut, X, ChevronRight, Mail, Menu } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { useSession, type Role } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import defaultLogo from "@/assets/templohub-logo.png.asset.json";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/mediuns", label: "Médiuns", icon: Users },
  { to: "/app/buscar", label: "Buscar", icon: Search },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  secretario: "Secretário",
  consulta: "Consulta",
};

function useBrandingLogo() {
  const [url, setUrl] = useState<string>(defaultLogo.url);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("app_settings").select("logo_path").eq("id", 1).maybeSingle();
      const path = (data as { logo_path: string | null } | null)?.logo_path;
      if (!path) return;
      const { data: signed } = await supabase.storage.from("app-branding").createSignedUrl(path, 3600);
      if (alive && signed?.signedUrl) setUrl(signed.signedUrl);
    })();
    return () => { alive = false; };
  }, []);
  return url;
}

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
  const brandingLogo = useBrandingLogo();
  const temploLogo = useTemploLogo(s.templo?.logo_path);

  if (s.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Carregando…</div>;
  }

  if (!s.session) {
    nav({ to: "/login" });
    return null;
  }

  const isSuper = s.roles.includes("super_admin");

  if (!isSuper && (!s.templo || s.templo.status !== "ativo")) {
    nav({ to: "/onboarding" });
    return null;
  }

  const navItems = isSuper
    ? ([{ to: "/app/admin", label: "Painel Global", icon: ShieldCheck }] as const)
    : NAV;

  const role = primaryRole(s.roles);
  const roleLabel = role ? ROLE_LABEL[role] : "";
  const contextName = isSuper ? "Super Administração" : s.templo?.nome ?? "";

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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="md:hidden w-9 h-9 rounded-full border border-sidebar-border/70 flex items-center justify-center text-sidebar-primary hover:bg-sidebar-accent/60"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
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
            <ChevronRight className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
          </div>
        </div>
      )}

      {/* Divider + section label */}
      <div className="px-5 pt-5">
        <div className="border-t border-sidebar-border/60" />
        <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
          Navegação
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

      {/* Footer */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/15 flex items-center justify-center shrink-0 ring-1 ring-sidebar-primary/30">
            <Mail className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{s.profile?.email}</div>
            <div className="text-xs text-sidebar-foreground/60">
              {roleLabel || "Usuário"}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
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

  return (
    <div className="min-h-screen bg-background flex">
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
          <div className="font-semibold">TemploHub</div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
