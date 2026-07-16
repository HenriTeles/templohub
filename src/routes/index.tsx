import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AccountLoadError } from "@/components/AccountLoadError";
import { db as supabase } from "@/lib/db";
import { getSessionRouteDecision, useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  component: Gateway,
});

function Gateway() {
  const nav = useNavigate();
  const s = useSession();
  const decision = getSessionRouteDecision(s);
  useEffect(() => {
    if ("to" in decision) nav({ to: decision.to });
  }, [decision, nav]);
  if (decision.state === "account_error") {
    return <AccountLoadError error={s.accountError} onRetry={() => s.refresh()} onSignOut={() => supabase.auth.signOut()} />;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Carregando…
    </div>
  );
}
