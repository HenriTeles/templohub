import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

type Templo = { id: string; nome: string; cidade: string | null; estado: string | null; status: string; created_at: string };

function AdminPage() {
  const s = useSession();
  const [templos, setTemplos] = useState<Templo[]>([]);

  const load = async () => {
    const { data } = await db.from("templos").select("*").order("created_at", { ascending: false });
    setTemplos((data ?? []) as Templo[]);
  };
  useEffect(() => { load(); }, []);

  if (!s.roles.includes("super_admin")) {
    return <div className="p-6 text-muted-foreground">Acesso restrito a super administradores.</div>;
  }

  const approve = async (id: string) => {
    const { error } = await db.rpc("approve_templo", { _templo_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Templo aprovado."); load(); }
  };
  const reject = async (id: string) => {
    const { error } = await db.rpc("reject_templo", { _templo_id: id });
    if (error) toast.error(error.message);
    else load();
  };

  const pendentes = templos.filter((t) => t.status === "pendente");
  const ativos = templos.filter((t) => t.status === "ativo");
  const suspensos = templos.filter((t) => t.status === "suspenso");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Super Administração</h1>
        <p className="text-sm text-muted-foreground">Gestão global de templos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aguardando aprovação ({pendentes.length})</CardTitle>
          <CardDescription>Novos templos que solicitaram acesso</CardDescription>
        </CardHeader>
        <CardContent>
          {pendentes.length ? (
            <ul className="divide-y">
              {pendentes.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {[t.cidade, t.estado].filter(Boolean).join(" · ") || "—"} ·{" "}
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(t.id)}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(t.id)}>Rejeitar</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum templo pendente.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Ativos ({ativos.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {ativos.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <span>{t.nome}</span>
                  <span className="text-xs text-muted-foreground">{[t.cidade, t.estado].filter(Boolean).join("/")}</span>
                </li>
              ))}
              {!ativos.length && <li className="py-2 text-muted-foreground">Nenhum.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Suspensos ({suspensos.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {suspensos.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <span>{t.nome}</span>
                  <Button size="sm" variant="outline" onClick={() => approve(t.id)}>Reativar</Button>
                </li>
              ))}
              {!suspensos.length && <li className="py-2 text-muted-foreground">Nenhum.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
