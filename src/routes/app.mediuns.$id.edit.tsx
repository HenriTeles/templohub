import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/mediuns/$id/edit")({
  component: EditMedium,
});

type Option = { id: string; nome: string; categoria?: string | null };
type Form = Record<string, string | null>;

const SITUACOES = [
  { v: "ativo", l: "Ativo" },
  { v: "em_desenvolvimento", l: "Em desenvolvimento" },
  { v: "licenciado", l: "Licenciado" },
  { v: "afastado", l: "Afastado" },
  { v: "desligado", l: "Desligado" },
];

function EditMedium() {
  const { id } = useParams({ from: "/app/mediuns/$id/edit" });
  const nav = useNavigate();
  const s = useSession();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({ situacao: "em_desenvolvimento" });
  const [falanges, setFalanges] = useState<Option[]>([]);
  const [centurias, setCenturias] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);

  useEffect(() => {
    if (!s.templo?.id) return;
    (async () => {
      const [{ data: fs }, { data: cs }] = await Promise.all([
        db.from("falanges").select("id, nome, categoria").is("templo_id", null).order("nome"),
        db.from("centurias").select("id, nome").eq("templo_id", s.templo!.id).order("nome"),
      ]);
      setFalanges((fs ?? []) as Option[]);
      setCenturias((cs ?? []) as Option[]);
      if (!isNew) {
        const { data } = await db.from("mediuns").select("*").eq("id", id).maybeSingle();
        if (data) setForm(data as Form);
      }
    })();
  }, [s.templo?.id, id, isNew]);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v || null }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.templo?.id) return;
    setBusy(true);
    try {
      let foto_path = form.foto_path ?? null;
      if (foto) {
        const key = `${s.templo.id}/${crypto.randomUUID()}-${foto.name}`;
        const { error: upErr } = await db.storage.from("mediuns-fotos").upload(key, foto, { upsert: true });
        if (upErr) throw upErr;
        foto_path = key;
      }
      const payload = { ...form, foto_path, templo_id: s.templo.id, created_by: s.userId };
      // Remove empty strings and unknown fields that Postgres won't accept as columns
      Object.keys(payload).forEach((k) => {
        if (payload[k as keyof typeof payload] === "") (payload as Record<string, unknown>)[k] = null;
      });
      if (isNew) {
        delete (payload as Record<string, unknown>).id;
        const { data: inserted, error } = await db.from("mediuns").insert(payload).select("id").single();
        if (error) throw error;
        await db.from("historico").insert({
          templo_id: s.templo.id,
          mediun_id: inserted.id,
          user_id: s.userId,
          acao: "cadastro_criado",
          detalhes: { por: s.profile?.email },
        });
        toast.success("Médium cadastrado.");
        nav({ to: "/app/mediuns/$id", params: { id: inserted.id } });
      } else {
        const { error } = await db.from("mediuns").update(payload).eq("id", id);
        if (error) throw error;
        await db.from("historico").insert({
          templo_id: s.templo.id,
          mediun_id: id,
          user_id: s.userId,
          acao: "cadastro_atualizado",
          detalhes: { por: s.profile?.email },
        });
        toast.success("Alterações salvas.");
        nav({ to: "/app/mediuns/$id", params: { id } });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: string, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} value={(form[k] as string) ?? ""} onChange={(e) => set(k)(e.target.value)} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{isNew ? "Novo Médium" : "Editar Médium"}</h1>
      </div>
      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Foto</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </div>
            {field("nome_completo", "Nome completo")}
            {field("nome_emissao", "Nome de emissão")}
            {field("nome_pai", "Nome do pai")}
            {field("nome_mae", "Nome da mãe")}
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select value={(form.sexo as string) ?? ""} onValueChange={set("sexo")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("cpf", "CPF")}
            {field("rg", "RG")}
            {field("data_nascimento", "Nascimento", "date")}
            {field("estado_civil", "Estado civil")}
            {field("nacionalidade", "Nacionalidade")}
            {field("profissao", "Profissão")}
            {field("telefone", "Telefone")}
            {field("whatsapp", "WhatsApp")}
            {field("email", "E-mail", "email")}
            <div className="md:col-span-2">{field("endereco", "Endereço")}</div>
            {field("cidade", "Cidade")}
            {field("estado", "Estado")}
            {field("cep", "CEP")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados Doutrinários</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            {field("numero_ficha", "Nº da ficha")}
            {field("data_ingresso", "Data de ingresso", "date")}
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select value={(form.situacao as string) ?? "em_desenvolvimento"} onValueChange={set("situacao")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITUACOES.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Desenvolvimento Mediúnico</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            {field("data_inicio_desenvolvimento", "Início do desenvolvimento", "date")}
            {field("data_emplacamento", "Emplacamento", "date")}
            {field("data_elevacao_espadas", "Elevação de Espadas", "date")}
            {field("data_centuria", "Centúria", "date")}
            {field("data_consagracao", "Consagração", "date")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Particularidades Mediúnicas</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select value={(form.funcao as string) ?? ""} onValueChange={set("funcao")}>
                <SelectTrigger><SelectValue placeholder="Mestre / Ninfa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mestre">Mestre</SelectItem>
                  <SelectItem value="ninfa">Ninfa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Polaridade</Label>
              <Select value={(form.polaridade as string) ?? ""} onValueChange={set("polaridade")}>
                <SelectTrigger><SelectValue placeholder="Apará / Doutrinador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apara">Apará</SelectItem>
                  <SelectItem value="doutrinador">Doutrinador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Falange</Label>
              <Select value={(form.falange_id as string) ?? ""} onValueChange={set("falange_id")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {falanges.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Falange Missionária</Label>
              <Select value={(form.falange_missionaria_id as string) ?? ""} onValueChange={set("falange_missionaria_id")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {falanges.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Centúria</Label>
              <Select value={(form.centuria_id as string) ?? ""} onValueChange={set("centuria_id")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {centurias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={(form.observacoes as string) ?? ""}
              onChange={(e) => set("observacoes")(e.target.value)}
              placeholder="Observações internas do médium (visíveis apenas neste templo)"
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          <Button type="button" variant="outline" onClick={() => nav({ to: "/app/mediuns" })}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
