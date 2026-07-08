import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { db as supabase } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const nav = useNavigate();
  const s = useSession();
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState(false);

  if (s.loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  }

  if (!s.session) {
    nav({ to: "/login" });
    return null;
  }

  if (s.roles.includes("super_admin")) {
    nav({ to: "/app/admin" });
    return null;
  }

  if (s.templo) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>{s.templo.nome}</CardTitle>
            <CardDescription>
              Status atual:{" "}
              <span className="font-medium text-foreground">{s.templo.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.templo.status === "pendente" ? (
              <p className="text-sm text-muted-foreground">
                Seu templo está aguardando aprovação da administração global. Você receberá acesso
                completo assim que for aprovado.
              </p>
            ) : s.templo.status === "ativo" ? (
              <Button className="w-full" onClick={() => nav({ to: "/app/dashboard" })}>
                Entrar no painel
              </Button>
            ) : (
              <p className="text-sm text-destructive">
                Templo suspenso. Entre em contato com o suporte.
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_templo_request", {
        _nome: nome,
        _cidade: cidade,
        _estado: estado,
      });
      if (error) throw error;
      await s.refresh();
      // Se após a criação o perfil ainda não estiver vinculado ao templo,
      // algo falhou no backend (perfil ausente etc.). Não permitir reenvio.
      const { data: p } = await supabase
        .from("profiles")
        .select("templo_id")
        .eq("id", s.userId!)
        .maybeSingle();
      if (!(p as { templo_id: string | null } | null)?.templo_id) {
        toast.error(
          "Templo criado, mas não foi possível vincular seu usuário. Rode a migration em /mnt/documents/migration-ficha-medium.sql e faça login novamente.",
        );
        return;
      }
      toast.success("Templo enviado para aprovação.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Cadastro do Templo</CardTitle>
          <CardDescription>
            Preencha os dados abaixo. Após enviar, o administrador geral irá revisar e aprovar o
            acesso do seu templo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tnome">Nome do templo</Label>
              <Input id="tnome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tcid">Cidade</Label>
                <Input id="tcid" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test">Estado</Label>
                <Input id="test" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Enviando…" : "Solicitar cadastro"}
              </Button>
              <Button type="button" variant="outline" onClick={() => supabase.auth.signOut()}>
                Sair
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
