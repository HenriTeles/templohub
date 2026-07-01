import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Search, Settings, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/mediuns", label: "Médiuns", icon: Users },
  { to: "/app/buscar", label: "Buscar", icon: Search },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const s = useSession();
  const nav = useNavigate();
  const path = useRouterState({ select: (st) => st.location.pathname });
  const [open, setOpen] = useState(false);

  if (s.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Carregando…</div>;
  }

  if (!s.session) {
    nav({ to: "/login" });
    return null;
  }

  if (!s.roles.includes("super_admin") && (!s.templo || s.templo.status !== "ativo")) {
    nav({ to: "/onboarding" });
    return null;
  }

  const Sidebar = (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-serif text-xl">
            ✦
          </div>
          <div>
            <div className="font-semibold text-base">TemploHub</div>
            <div className="text-xs text-sidebar-foreground/70 truncate max-w-[10rem]">
              {s.templo?.nome ?? "Super Administração"}
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "hover:bg-sidebar-accent/60 text-sidebar-foreground/90",
              )}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}
        {s.roles.includes("super_admin") && (
          <Link
            to="/app/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              path.startsWith("/app/admin")
                ? "bg-sidebar-accent text-sidebar-primary"
                : "hover:bg-sidebar-accent/60 text-sidebar-foreground/90",
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Super Admin
          </Link>
        )}
      </nav>
      <div className="p-3 border-t border-sidebar-border text-xs text-sidebar-foreground/80 space-y-2">
        <div className="truncate">{s.profile?.email}</div>
        <div className="flex flex-wrap gap-1">
          {s.roles.map((r) => (
            <span key={r} className="px-2 py-0.5 rounded bg-sidebar-accent text-sidebar-primary text-[10px] uppercase tracking-wide">
              {r}
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
          onClick={async () => {
            await supabase.auth.signOut();
            nav({ to: "/login" });
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
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
            <SheetContent side="left" className="p-0 w-64">
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
