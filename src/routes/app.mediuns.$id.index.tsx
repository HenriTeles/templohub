import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomField } from "@/components/CustomFieldsManager";

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
  const [falangeNome, setFalangeNome] = useState<string | null>(null);
  const [centuriaNome, setCenturiaNome] = useState<string | null>(null);
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
      if (data.falange_id) {
        const { data: f } = await db.from("falanges").select("nome").eq("id", data.falange_id).maybeSingle();
        setFalangeNome(f?.nome ?? null);
      }
      if (data.centuria_id) {
        const { data: c } = await db.from("centurias").select("nome").eq("id", data.centuria_id).maybeSingle();
        setCenturiaNome(c?.nome ?? null);
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

      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
        <Card>
          <CardContent className="p-3 space-y-2 text-center">
            {fotoUrl ? (
              <img src={fotoUrl} alt="" className="w-full aspect-square object-cover rounded-md" />
            ) : (
              <div className="w-full aspect-square rounded-md bg-primary/10 text-primary flex items-center justify-center text-2xl font-serif">
                {m.nome_completo.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-semibold text-sm leading-tight">{m.nome_completo}</div>
              {(m.nome_emissao as string) && (
                <div className="text-[11px] text-muted-foreground">{m.nome_emissao as string}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 justify-center">
              {(m.funcao as string) && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-accent/30 text-primary">{m.funcao as string}</span>
              )}
              {(m.polaridade as string) && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m.polaridade as string}</span>
              )}
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.situacao as string}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Informações Pessoais</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Nome", m.nome_completo)}
              {info("Nome de emissão", m.nome_emissao)}
              {info("Nascimento", m.data_nascimento)}
              {info("Sexo", m.sexo)}
              {info("Nome do pai", m.nome_pai)}
              {info("Nome da mãe", m.nome_mae)}
              {info("Telefone", m.telefone)}
              {info("WhatsApp", m.whatsapp)}
              {info("E-mail", m.email)}
              {info("Endereço", m.endereco)}
              {info("Cidade", m.cidade)}
              {info("Estado", m.estado)}
              {info("CEP", m.cep)}
              {info("Tipo sanguíneo", m.tipo_sanguineo)}
              {info("Medicamentos", m.medicamentos)}
              {info("Posologia", m.posologia)}
              {info("Medicamento controlado", m.medicamento_controlado)}
              {info("Médico prescritor", m.medico_prescritor)}
              {info("CRM", m.medico_crm)}
              {info("Possui doença", m.possui_doenca)}
              {info("Descrição da doença", m.doenca_descricao)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Informações Doutrinárias</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              {info("Ficha nº", m.numero_ficha)}
              {info("Ingresso", m.data_ingresso)}
              {info("Situação", m.situacao)}
              {info("Início Desenv.", m.data_inicio_desenvolvimento)}
              {info("Emplacamento", m.data_emplacamento)}
              {info("Elevação de Espadas", m.data_elevacao_espadas)}
              {info("Centúria (data)", m.data_centuria)}
              {info("Consagração", m.data_consagracao)}
              {info("Função", m.funcao)}
              {info("Mediunidade", m.polaridade)}
              {info("Falange", falangeNome)}
              {info("Centúria", centuriaNome)}
              {m.funcao === "ninfa" && info("Guia Missionária", m.guia_missionaria)}
              {m.funcao === "mestre" && info("Ministro", m.ministro)}
              {m.funcao === "mestre" && info("Cavaleiro", m.cavaleiro)}
              {info("Preto-velho", m.preto_velho)}
              {info("Caboclo", m.caboclo)}
              {info("Médico de Cura", m.medico_cura)}
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
