import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { LogoUploader } from "@/components/LogoUploader";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { TempleThemeCustomizer } from "@/components/TempleThemeCustomizer";

export const Route = createFileRoute("/app/configuracoes")({ component: ConfigPage });

type Item = { id: string; nome: string; templo_id: string | null };

function CrudList({ table, label, extra }: { table: string; label: string; extra?: Record<string, string> }) {
  const s = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [nome, setNome] = useState("");

  const reload = async () => {
    if (!s.templo?.id) return;
    const { data } = await db.from(table).select("id, nome, templo_id").order("nome");
    setItems((data ?? []) as Item[]);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s.templo?.id]);

  const add = async () => {
    if (!nome.trim() || !s.templo?.id) return;
    const { error } = await db.from(table).insert({ nome: nome.trim(), templo_id: s.templo.id, ...(extra ?? {}) });
    if (error) toast.error(error.message);
    else { setNome(""); reload(); }
  };

  const remove = async (id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>Itens globais + personalizados do templo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Novo ${label.toLowerCase()}`} />
          <Button type="button" onClick={add}>Adicionar</Button>
        </div>
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.id} className="py-2 flex items-center justify-between">
              <span className="text-sm">
                {i.nome}{" "}
                {!i.templo_id && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1">global</span>
                )}
              </span>
              {i.templo_id && (
                <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </li>
          ))}
          {!items.length && <li className="py-4 text-sm text-muted-foreground">Vazio.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function TempleLogoCard() {
  const s = useSession();
  if (!s.templo?.id) return null;

  const save = async (path: string | null) => {
    const { error } = await db.from("templos").update({ logo_path: path }).eq("id", s.templo!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await s.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Foto do templo</CardTitle>
        <CardDescription>Aparece no menu lateral para todos os membros deste templo.</CardDescription>
      </CardHeader>
      <CardContent>
        <LogoUploader
          bucket="templos-logos"
          currentPath={s.templo.logo_path}
          buildKey={(fileName) => `${s.templo!.id}/logo-${Date.now()}-${fileName}`}
          onSaved={save}
          label="Foto"
        />
      </CardContent>
    </Card>
  );
}

function AccountCredentialsCard() {
  const s = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyPass, setBusyPass] = useState(false);

  useEffect(() => {
    setEmail(s.profile?.email ?? "");
  }, [s.profile?.email]);

  const saveEmail = async () => {
    if (!email.trim()) return toast.error("Informe um e-mail válido.");
    setBusyEmail(true);
    const { error } = await db.auth.updateUser({ email: email.trim() });
    setBusyEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de confirmação para o novo e-mail.");
  };

  const savePassword = async () => {
    if (password.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    if (password !== password2) return toast.error("As senhas não coincidem.");
    setBusyPass(true);
    const { error } = await db.auth.updateUser({ password });
    setBusyPass(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setPassword2("");
    toast.success("Senha atualizada.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conta de acesso</CardTitle>
        <CardDescription>Altere o e-mail e a senha usados para entrar no sistema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">E-mail</label>
          <div className="flex gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="button" onClick={saveEmail} disabled={busyEmail}>
              {busyEmail ? "Enviando…" : "Alterar e-mail"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Você receberá um e-mail de confirmação para concluir a troca.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nova senha</label>
          <Input
            type="password"
            placeholder="Ao menos 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirme a nova senha"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
          <Button type="button" onClick={savePassword} disabled={busyPass}>
            {busyPass ? "Salvando…" : "Alterar senha"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigPage() {
  const s = useSession();
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie a identidade e tabelas doutrinárias deste templo</p>
      </div>

      <AccountCredentialsCard />

      <TempleLogoCard />

      <TempleThemeCustomizer />



      {s.templo?.id && <CustomFieldsManager scope="templo" temploId={s.templo.id} />}

      <div className="grid md:grid-cols-2 gap-4">
        <CrudList table="falanges" label="Falanges" />
        <CrudList table="centurias" label="Centúrias" />
        <CrudList table="adjuracoes" label="Adjurações" />
        <CrudList table="trinos" label="Trinos" />
        <CrudList table="povos" label="Povos" />
        <CrudList table="legioes" label="Legiões" />
        <CrudList table="reinos" label="Reinos" />
      </div>
    </div>
  );
}
