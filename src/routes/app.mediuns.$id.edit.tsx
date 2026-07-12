import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  classesElevacaoFor,
  falangesMissionariasFor,
  turnosFor,
  TURNOS_TRABALHO,
  FALANGES_JANDA,
  type Sexo,
} from "@/lib/medium-fields";

export const Route = createFileRoute("/app/mediuns/$id/edit")({
  component: EditMedium,
});

type Option = { id: string; nome: string };
type Form = Record<string, string | boolean | null>;

const SITUACOES = [
  { v: "ativo", l: "Ativo" },
  { v: "em_desenvolvimento", l: "Em desenvolvimento" },
  { v: "afastado", l: "Afastado" },
  { v: "desligado", l: "Desligado" },
];

function EditMedium() {
  const { id } = useParams({ from: "/app/mediuns/$id/edit" });
  const nav = useNavigate();
  const s = useSession();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({ situacao: "em_desenvolvimento" });
  const [trinos, setTrinos] = useState<Option[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);

  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!s.templo?.id) return;
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    (async () => {
      const [{ data: ts }, { data: cf }] = await Promise.all([
        db.from("trinos").select("id, nome").order("nome"),
        db.from("medium_custom_fields")
          .select("*")
          .or(`templo_id.is.null,templo_id.eq.${s.templo!.id}`)
          .order("ordem")
          .order("created_at"),
      ]);
      setTrinos((ts ?? []) as Option[]);
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

  const set = (k: string) => (v: string | boolean | null) =>
    setForm((f) => ({ ...f, [k]: v === "" ? null : v }));

  const sexo = (form.sexo as Sexo | null) ?? null;
  const classesElev = useMemo(() => classesElevacaoFor(sexo), [sexo]);
  const falangesMiss = useMemo(() => falangesMissionariasFor(sexo), [sexo]);

  // Clear gender-conditional selections when they become invalid.
  useEffect(() => {
    if (form.classe_elevacao && !classesElev.some((c) => c.v === form.classe_elevacao)) {
      setForm((f) => ({ ...f, classe_elevacao: null }));
    }
    if (form.falange_missionaria && !falangesMiss.includes(form.falange_missionaria as never)) {
      setForm((f) => ({ ...f, falange_missionaria: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sexo]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.templo?.id) return;
    setBusy(true);
    try {
      let foto_path = (form.foto_path as string) ?? null;
      if (foto) {
        const key = `${s.templo.id}/${crypto.randomUUID()}-${foto.name}`;
        const { error: upErr } = await db.storage
          .from("mediuns-fotos")
          .upload(key, foto, { upsert: true });
        if (upErr) throw upErr;
        foto_path = key;
      }
      const payload: Record<string, unknown> = {
        ...form,
        foto_path,
        templo_id: s.templo.id,
        created_by: s.userId,
      };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });

      let savedId = id;
      if (isNew) {
        delete payload.id;
        const { data: inserted, error } = await db
          .from("mediuns")
          .insert(payload)
          .select("id")
          .single();
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
      <Input
        id={k}
        type={type}
        value={(form[k] as string) ?? ""}
        onChange={(e) => set(k)(e.target.value)}
      />
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
        {/* ============================ 1. DADOS GERAIS ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Gerais</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Foto</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </div>
            {field("nome_completo", "Nome completo")}
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={(form.sexo as string) ?? ""} onValueChange={set("sexo")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("data_nascimento", "Data de nascimento", "date")}
            {field("nome_mae", "Nome da mãe")}
            {field("nome_pai", "Nome do pai")}
            {field("data_ingresso", "Data de ingresso", "date")}
            <div className="space-y-1.5">
              <Label>Templo</Label>
              <Input value={s.templo?.nome ?? ""} readOnly disabled />
            </div>
            {field("data_ultima_classificacao", "Data da última classificação", "date")}
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

        {/* ============================ 2. MENTORES / INICIAÇÃO ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Mentores / Iniciação</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>{sexo === "feminino" ? "Princesa" : "Mentores"}</Label>
              <Textarea
                rows={2}
                value={(form.mentores as string) ?? ""}
                onChange={(e) => set("mentores")(e.target.value)}
                placeholder={sexo === "feminino" ? "Nome da Princesa" : "Nome(s) dos mentores"}
              />
            </div>
            {field("data_emplacamento", "Data do emplacamento", "date")}
            {field("data_iniciacao", "Data de iniciação", "date")}
            <div className="space-y-1.5">
              <Label>Mediunidade</Label>
              <Select value={(form.polaridade as string) ?? ""} onValueChange={set("polaridade")}>
                <SelectTrigger><SelectValue placeholder="Apará / Doutrinador(a)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apara">Apará</SelectItem>
                  <SelectItem value="doutrinador">Doutrinador(a)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ============================ 3. ELEVAÇÃO DE ESPADAS ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Elevação de Espadas</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {field("data_elevacao_espadas", "Data", "date")}
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select
                value={(form.classe_elevacao as string) ?? ""}
                onValueChange={set("classe_elevacao")}
                disabled={!sexo}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sexo ? "Selecione" : "Escolha o gênero primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {classesElev.map((c) => (
                    <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Falange de mestrado</Label>
              <Select
                value={(form.falange_mestrado as string) ?? ""}
                onValueChange={set("falange_mestrado")}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {[
                    "Amanhecer","Anunciação","Ascenção","Consagração","Cruzada",
                    "Estrela Candente","Redenção","Ressurreição","Sacramento",
                    "Solar","Sublimação","Unificação",
                  ].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ============================ 4. CENTÚRIA ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Centúria</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {field("data_centuria", "Data", "date")}
            {field("nome_emissao", "Nome na emissão")}
            {field("povo", "Povo")}
            {field("adjunto", "Adjunto")}
            <div className="md:col-span-2 space-y-1.5">
              <Label>Falange missionária</Label>
              <Select
                value={(form.falange_missionaria as string) ?? ""}
                onValueChange={set("falange_missionaria")}
                disabled={!sexo}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sexo ? "Selecione" : "Escolha o gênero primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {falangesMiss.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adjunto Devas</Label>
              <Select value={(form.adjunto_devas as string) ?? ""} onValueChange={set("adjunto_devas")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alufã">Alufã</SelectItem>
                  <SelectItem value="Adejã">Adejã</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("lanca", "Lança")}
            {field("adjunto_transito", "Adjunto em Trânsito")}
            {sexo === "feminino" ? (
              <>
                {field("estrela", "Estrela")}
                {field("turno", "Turno")}
                {field("turno_trabalho", "Turno de Trabalho")}
                {field("guia_missionaria", "Guia Missionária")}
              </>
            ) : (
              <>
                {field("turno", "Turno")}
                {field("turno_trabalho", "Turno de Trabalho")}
                {field("ministro", "Ministro")}
                {field("cavaleiro", "Cavaleiro")}
              </>
            )}
          </CardContent>
        </Card>

        {/* ============================ 5. CLASSIFICAÇÃO ============================ */}
        {sexo !== "feminino" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Classificação do Médium</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                value={(form.classificacao_medium as string) ?? ""}
                onChange={(e) => set("classificacao_medium")(e.target.value)}
                placeholder="Classificação do médium"
              />
            </CardContent>
          </Card>
        )}

        {/* ============================ 6. DADOS COMPLEMENTARES ============================ */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados complementares</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {field("data_ultima_classificacao", "Data da última classificação", "date")}
            {field("data_setimo", "Data sétimo", "date")}
            {sexo === "feminino"
              ? field("data_recebimento_guia_missionaria", "Data de recebimento da Guia Missionária", "date")
              : field("data_recebimento_cavaleiro", "Data do recebimento do Cavaleiro", "date")}
            <div className="space-y-1.5">
              <Label>Trino</Label>
              <Select value={(form.trino_id as string) ?? ""} onValueChange={set("trino_id")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {trinos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("adjunto_povo", "Adjunto de povo")}
            {field("filho_de_devas", "Filho(a) de Devas")}
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Checkbox
                checked={!!form.recepcionista}
                onCheckedChange={(v) => set("recepcionista")(!!v)}
              />
              Recepcionista
            </label>
            {sexo === "feminino" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Janda</Label>
                <Select
                  value={form.janda === true ? "sim" : form.janda === false ? "nao" : ""}
                  onValueChange={(v) => set("janda")(v === "sim")}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>


        {/* ============================ CAMPOS PERSONALIZADOS ============================ */}
        {rootCustom.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              {rootCustom.map((f) => (
                <div key={f.id} className="md:col-span-2 space-y-3">
                  <CustomFieldInput
                    field={f}
                    value={customValues[f.id]}
                    onChange={(v) => setCustomValues((s) => ({ ...s, [f.id]: v }))}
                  />
                  {childrenOf(f.id).length > 0 && (
                    <div className="ml-4 border-l pl-4 grid md:grid-cols-2 gap-4">
                      {childrenOf(f.id).map((c) => (
                        <CustomFieldInput
                          key={c.id}
                          field={c}
                          value={customValues[c.id]}
                          onChange={(v) => setCustomValues((s) => ({ ...s, [c.id]: v }))}
                        />
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
