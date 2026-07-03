import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { CustomField } from "@/components/CustomFieldsManager";

export const Route = createFileRoute("/app/mediuns/$id/edit")({
  component: EditMedium,
});

type Option = { id: string; nome: string; categoria?: string | null };
type Form = Record<string, string | boolean | null>;

const SITUACOES = [
  { v: "ativo", l: "Ativo" },
  { v: "em_desenvolvimento", l: "Em desenvolvimento" },
  { v: "licenciado", l: "Licenciado" },
  { v: "afastado", l: "Afastado" },
  { v: "desligado", l: "Desligado" },
];

const TIPO_SANGUINEO = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function EditMedium() {
  const { id } = useParams({ from: "/app/mediuns/$id/edit" });
  const nav = useNavigate();
  const s = useSession();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({ situacao: "em_desenvolvimento" });
  const [falanges, setFalanges] = useState<Option[]>([]);
  const [centurias, setCenturias] = useState<Option[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);

  useEffect(() => {
    if (!s.templo?.id) return;
    (async () => {
      const [{ data: fs }, { data: cs }, { data: cf }] = await Promise.all([
        db.from("falanges").select("id, nome, categoria").is("templo_id", null).order("nome"),
        db.from("centurias").select("id, nome").eq("templo_id", s.templo!.id).order("nome"),
        db.from("medium_custom_fields")
          .select("*")
          .or(`templo_id.is.null,templo_id.eq.${s.templo!.id}`)
          .order("ordem")
          .order("created_at"),
      ]);
      setFalanges((fs ?? []) as Option[]);
      setCenturias((cs ?? []) as Option[]);
      setCustomFields((cf ?? []) as CustomField[]);
      if (!isNew) {
        const { data } = await db.from("mediuns").select("*").eq("id", id).maybeSingle();
        if (data) setForm(data as Form);
        const { data: vals } = await db
          .from("medium_custom_values")
          .select("field_id, valor")
          .eq("mediun_id", id);
        const map: Record<string, string> = {};
        for (const v of (vals ?? []) as Array<{ field_id: string; valor: string | null }>) {
          if (v.valor != null) map[v.field_id] = v.valor;
        }
        setCustomValues(map);
      }
    })();
  }, [s.templo?.id, id, isNew]);

  const set = (k: string) => (v: string | boolean | null) => setForm((f) => ({ ...f, [k]: v === "" ? null : v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.templo?.id) return;
    setBusy(true);
    try {
      let foto_path = (form.foto_path as string) ?? null;
      if (foto) {
        const key = `${s.templo.id}/${crypto.randomUUID()}-${foto.name}`;
        const { error: upErr } = await db.storage.from("mediuns-fotos").upload(key, foto, { upsert: true });
        if (upErr) throw upErr;
        foto_path = key;
      }
      const payload: Record<string, unknown> = { ...form, foto_path, templo_id: s.templo.id, created_by: s.userId };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });
      let savedId = id;
      if (isNew) {
        delete payload.id;
        const { data: inserted, error } = await db.from("mediuns").insert(payload).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
        await db.from("historico").insert({
          templo_id: s.templo.id,
          mediun_id: savedId,
          user_id: s.userId,
          acao: "cadastro_criado",
          detalhes: { por: s.profile?.email },
        });
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
      }

      // Save custom field values (upsert per field)
      const rows = Object.entries(customValues)
        .filter(([, v]) => v !== undefined)
        .map(([field_id, valor]) => ({ mediun_id: savedId, field_id, valor: valor || null }));
      if (rows.length) {
        const { error: cvErr } = await db
          .from("medium_custom_values")
          .upsert(rows, { onConflict: "mediun_id,field_id" });
        if (cvErr) throw cvErr;
      }

      toast.success(isNew ? "Médium cadastrado." : "Alterações salvas.");
      nav({ to: "/app/mediuns/$id", params: { id: savedId } });
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

  const rootCustom = customFields.filter((f) => !f.parent_field_id);
  const childrenOf = (pid: string) => customFields.filter((f) => f.parent_field_id === pid);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{isNew ? "Novo Médium" : "Editar Médium"}</h1>
      </div>
      <form onSubmit={save} className="space-y-4">
        {/* ============================ INFORMAÇÕES PESSOAIS ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Pessoais</CardTitle></CardHeader>
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
            {field("data_nascimento", "Nascimento", "date")}
            {field("telefone", "Telefone")}
            {field("whatsapp", "WhatsApp")}
            {field("email", "E-mail", "email")}
            <div className="md:col-span-2">{field("endereco", "Endereço")}</div>
            {field("cidade", "Cidade")}
            {field("estado", "Estado")}
            {field("cep", "CEP")}

            <div className="md:col-span-2 h-px bg-border my-2" />

            <div className="space-y-1.5">
              <Label>Tipo sanguíneo</Label>
              <Select value={(form.tipo_sanguineo as string) ?? ""} onValueChange={set("tipo_sanguineo")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPO_SANGUINEO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label>Medicamento(s) em uso</Label>
              <Input value={(form.medicamentos as string) ?? ""} onChange={(e) => set("medicamentos")(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Posologia</Label>
              <Textarea rows={2} value={(form.posologia as string) ?? ""} onChange={(e) => set("posologia")(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Checkbox
                checked={!!form.medicamento_controlado}
                onCheckedChange={(v) => set("medicamento_controlado")(!!v)}
              />
              Medicamento controlado
            </label>
            {field("medico_prescritor", "Médico que prescreveu")}
            {field("medico_crm", "CRM do médico")}
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Checkbox
                checked={!!form.possui_doenca}
                onCheckedChange={(v) => set("possui_doenca")(!!v)}
              />
              Possui alguma doença
            </label>
            {form.possui_doenca && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Qual doença?</Label>
                <Textarea rows={2} value={(form.doenca_descricao as string) ?? ""} onChange={(e) => set("doenca_descricao")(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================ INFORMAÇÕES DOUTRINÁRIAS ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Doutrinárias</CardTitle></CardHeader>
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

            {field("data_inicio_desenvolvimento", "Início do desenvolvimento", "date")}
            {field("data_emplacamento", "Emplacamento", "date")}
            {field("data_elevacao_espadas", "Elevação de Espadas", "date")}
            {field("data_centuria", "Centúria (data)", "date")}
            {field("data_consagracao", "Consagração", "date")}

            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select
                value={(form.funcao as string) ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, funcao: v, falange_id: null }))}
              >
                <SelectTrigger><SelectValue placeholder="Mestre / Ninfa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mestre">Mestre</SelectItem>
                  <SelectItem value="ninfa">Ninfa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mediunidade</Label>
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
              <Select
                value={(form.falange_id as string) ?? ""}
                onValueChange={set("falange_id")}
                disabled={!form.funcao}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.funcao ? "Selecione" : "Escolha a função primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {falanges
                    .filter((f) => !form.funcao || f.categoria === form.funcao)
                    .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.funcao === "ninfa" && (
              <div className="space-y-1.5">
                <Label>Guia Missionária</Label>
                <Input
                  value={(form.guia_missionaria as string) ?? ""}
                  onChange={(e) => set("guia_missionaria")(e.target.value)}
                  placeholder="Em breve (lista suspensa)"
                />
              </div>
            )}
            {form.funcao === "mestre" && (
              <>
                <div className="space-y-1.5">
                  <Label>Ministro</Label>
                  <Input value={(form.ministro as string) ?? ""} onChange={(e) => set("ministro")(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cavaleiro</Label>
                  <Input value={(form.cavaleiro as string) ?? ""} onChange={(e) => set("cavaleiro")(e.target.value)} />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Preto-velho / Preta-velha</Label>
              <Input value={(form.preto_velho as string) ?? ""} onChange={(e) => set("preto_velho")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Caboclo / Cabocla</Label>
              <Input value={(form.caboclo as string) ?? ""} onChange={(e) => set("caboclo")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Médico(a) de Cura</Label>
              <Input value={(form.medico_cura as string) ?? ""} onChange={(e) => set("medico_cura")(e.target.value)} />
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

        {/* ============================ CAMPOS PERSONALIZADOS ============================ */}
        {rootCustom.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              {rootCustom.map((f) => (
                <div key={f.id} className="md:col-span-2 space-y-3">
                  <CustomFieldInput field={f} value={customValues[f.id]} onChange={(v) => setCustomValues((s) => ({ ...s, [f.id]: v }))} />
                  {childrenOf(f.id).length > 0 && (
                    <div className="ml-4 border-l pl-4 grid md:grid-cols-2 gap-4">
                      {childrenOf(f.id).map((c) => (
                        <CustomFieldInput key={c.id} field={c} value={customValues[c.id]} onChange={(v) => setCustomValues((s) => ({ ...s, [c.id]: v }))} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const v = value ?? "";
  const label = (
    <Label>
      {field.label}
      {field.obrigatorio && <span className="text-destructive ml-1">*</span>}
    </Label>
  );

  if (field.tipo === "textarea") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea rows={3} value={v} onChange={(e) => onChange(e.target.value)} required={field.obrigatorio} />
      </div>
    );
  }
  if (field.tipo === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v === "true"} onCheckedChange={(x) => onChange(x ? "true" : "false")} />
        {field.label}
      </label>
    );
  }
  if (field.tipo === "select") {
    return (
      <div className="space-y-1.5">
        {label}
        <Select value={v} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {(field.opcoes ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  const inputType = field.tipo === "number" ? "number" : field.tipo === "date" ? "date" : "text";
  return (
    <div className="space-y-1.5">
      {label}
      <Input type={inputType} value={v} onChange={(e) => onChange(e.target.value)} required={field.obrigatorio} />
    </div>
  );
}
