import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomField } from "@/components/CustomFieldsManager";
import { classesElevacaoFor } from "@/lib/medium-fields";
import { situacaoBadgeClass, SITUACAO_LABEL } from "@/lib/status";

export const Route = createFileRoute("/app/mediuns/$id/")({ component: MediumDetail });

type Row = Record<string, unknown> & {
  id: string;
  nome_completo: string;
  foto_path: string | null;
};

function MediumDetail() {
  const { id } = useParams({ from: "/app/mediuns/$id/" });
  const s = useSession();
  const nav = useNavigate();
  const [m, setM] = useState<Row | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Array<{ id: string; acao: string; created_at: string }>>([]);
  const [trinoNome, setTrinoNome] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await db.from("mediuns").select("*").eq("id", id).maybeSingle();
      if (!data) return;
      setM(data as Row);
      if (data.foto_path) {
        const { data: signed } = await db.storage
          .from("mediuns-fotos")
          .createSignedUrl(data.foto_path, 3600);
        if (signed?.signedUrl) setFotoUrl(signed.signedUrl);
      }
      if (data.trino_id) {
        const { data: t } = await db.from("trinos").select("nome").eq("id", data.trino_id).maybeSingle();
        setTrinoNome(t?.nome ?? null);
      }
      const { data: h } = await db
        .from("historico")
        .select("id, acao, created_at")
        .eq("mediun_id", id)
        .order("created_at", { ascending: false });
      setHistorico((h ?? []) as typeof historico);

      if (s.templo?.id) {
        const { data: cf } = await db
          .from("medium_custom_fields")
          .select("*")
          .or(`templo_id.is.null,templo_id.eq.${s.templo.id}`)
          .order("ordem")
          .order("created_at");
        setCustomFields((cf ?? []) as CustomField[]);
      }
      const { data: vals } = await db
        .from("medium_custom_values")
        .select("field_id, valor")
        .eq("mediun_id", id);
      const map: Record<string, string> = {};
      for (const v of (vals ?? []) as Array<{ field_id: string; valor: string | null }>) {
        if (v.valor != null) map[v.field_id] = v.valor;
      }
      setCustomValues(map);
    })();
  }, [id, s.templo?.id]);

  const remove = async () => {
    if (!confirm("Excluir este médium?")) return;
    const { error } = await db.from("mediuns").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido.");
      nav({ to: "/app/mediuns" });
    }
  };

  if (!m) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  const info = (label: string, v: unknown) => (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">
        {typeof v === "boolean" ? (v ? "Sim" : "Não") : ((v as string) || "—")}
      </div>
    </div>
  );

  const classeLabel =
    classesElevacaoFor(m.sexo as "masculino" | "feminino" | null)
      .find((c) => c.v === m.classe_elevacao)?.l ?? (m.classe_elevacao as string) ?? null;

  const generoLabel =
    m.sexo === "masculino" ? "Masculino" : m.sexo === "feminino" ? "Feminino" : null;

  const mediunidadeLabel =
    m.polaridade === "apara" ? "Apará" : m.polaridade === "doutrinador" ? "Doutrinador(a)" : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/app/mediuns" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex gap-2">
          <Link to="/app/mediuns/$id/edit" params={{ id }}>
            <Button variant="outline"><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
          </Link>
          {(s.roles.includes("admin") || s.roles.includes("super_admin")) && (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[60px_1fr] gap-4">
        <Card>
          <CardContent className="p-2 space-y-2 text-center">
            {fotoUrl ? (
              <img src={fotoUrl} alt="" className="w-full aspect-square object-cover rounded-md" />
            ) : (
              <div className="w-full aspect-square rounded-md bg-primary/10 text-primary flex items-center justify-center text-base font-serif">
                {m.nome_completo.charAt(0)}
              </div>
            )}
            <div className="flex flex-wrap gap-1 justify-center">
              {mediunidadeLabel && (
                <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-primary/10 text-primary">{mediunidadeLabel}</span>
              )}
              <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${situacaoBadgeClass(m.situacao as string)}`}>
                {SITUACAO_LABEL[m.situacao as string] ?? (m.situacao as string)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados Gerais</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Nome completo", m.nome_completo)}
              {info("Gênero", generoLabel)}
              {info("Data de nascimento", m.data_nascimento)}
              {info("Nome da mãe", m.nome_mae)}
              {info("Nome do pai", m.nome_pai)}
              {info("Data de ingresso", m.data_ingresso)}
              {info("Templo", s.templo?.nome)}
              {info("Data da última classificação", m.data_ultima_classificacao)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Mentores / Iniciação</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Mentores", m.mentores)}
              {info("Data do emplacamento", m.data_emplacamento)}
              {info("Data de iniciação", m.data_iniciacao)}
              {info("Mediunidade", mediunidadeLabel)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Elevação de Espadas</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Data", m.data_elevacao_espadas)}
              {info("Classe", classeLabel)}
              {info("Falange de mestrado", m.falange_mestrado)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Centúria</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Data", m.data_centuria)}
              {info("Nome na emissão", m.nome_emissao)}
              {info("Povo", m.povo)}
              {info("Adjunto", m.adjunto)}
              {info("Falange missionária", m.falange_missionaria)}
              {info("Adjunto Devas", m.adjunto_devas)}
              {info("Lança", m.lanca)}
              {info("Adjunto em Trânsito", m.adjunto_transito)}
              {info("Turno", m.turno)}
              {info("Turno de Trabalho", m.turno_trabalho)}
              {info("Ministro", m.ministro)}
              {info("Cavaleiro", m.cavaleiro)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Classificação do Médium</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm">
              {(m.classificacao_medium as string) || "—"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Dados complementares</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Data da última classificação", m.data_ultima_classificacao)}
              {info("Data sétimo", m.data_setimo)}
              {info("Data do recebimento do Cavaleiro", m.data_recebimento_cavaleiro)}
              {info("Trino", trinoNome)}
              {info("Adjunto de povo", m.adjunto_povo)}
              {info("Filho(a) de Devas", m.filho_de_devas)}
              {info("Recepcionista", m.recepcionista)}
            </CardContent>
          </Card>

          {customFields.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                {customFields.map((f) => info(f.label, customValues[f.id]))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent>
              {historico.length ? (
                <ul className="space-y-2">
                  {historico.map((h) => (
                    <li key={h.id} className="text-sm flex items-center justify-between">
                      <span>{h.acao}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
              )}
            </CardContent>
          </Card>

          {(m.observacoes as string) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">{m.observacoes as string}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
