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
    else if (s.roles.includes("super_admin")) nav({ to: "/app/admin" });
    else if (!s.profile?.templo_id) nav({ to: "/onboarding" });
    else nav({ to: "/app/dashboard" });
  }, [s.loading, s.session, s.profile, s.roles, nav]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Carregando…
    </div>
  );
}
