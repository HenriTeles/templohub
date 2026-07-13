import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  component: Gateway,
});

function Gateway() {
  const nav = useNavigate();
  const s = useSession();
  useEffect(() => {
    if (s.loading) return;
    if (!s.session) nav({ to: "/login" });
    else if (s.accountError) return;
    else if (s.roles.includes("super_admin")) nav({ to: "/app/admin" });
    else if (!s.profile?.templo_id) nav({ to: "/onboarding" });
    else nav({ to: "/app/dashboard" });
  }, [s.loading, s.session, s.profile, s.roles, s.accountError, nav]);
  if (s.accountError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-foreground">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">Conta não carregada</h1>
          <p className="text-sm text-muted-foreground">{s.accountError}</p>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => s.refresh()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Carregando…
    </div>
  );
}
