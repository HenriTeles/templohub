import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountErrorInfo } from "@/lib/session";

type AccountLoadErrorProps = {
  error: AccountErrorInfo | string | null;
  onRetry?: () => void | Promise<unknown>;
  onSignOut?: () => void | Promise<unknown>;
};

function normalizeError(error: AccountLoadErrorProps["error"]): AccountErrorInfo {
  if (error && typeof error === "object") return error;
  return {
    message: "Conta não carregada",
    origin: "Carregamento da conta",
    detail: error || "Não foi possível identificar perfil, papel ou vínculo de templo para esta sessão.",
  };
}

export function AccountLoadError({ error, onRetry, onSignOut }: AccountLoadErrorProps) {
  const info = normalizeError(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-xl">Conta não carregada</CardTitle>
              <CardDescription>{info.message}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Origem detectada</div>
            <div className="mt-1 break-words text-sm font-medium">{info.origin}</div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Detalhe técnico</div>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {info.detail}
            </pre>
          </div>

          {(info.clientDetail || info.serverDetail) && (
            <div className="grid gap-3 md:grid-cols-2">
              {info.clientDetail && (
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Supabase/RLS</div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{info.clientDetail}</p>
                </div>
              )}
              {info.serverDetail && (
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Server function</div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{info.serverDetail}</p>
                </div>
              )}
            </div>
          )}

          {info.action && <p className="text-sm text-muted-foreground">{info.action}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            {onRetry && (
              <Button type="button" className="flex-1" onClick={() => void onRetry()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            )}
            {onSignOut && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => void onSignOut()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}