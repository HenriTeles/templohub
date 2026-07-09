import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  classesElevacaoFor,
  falangesMissionariasFor,
  type Sexo,
} from "@/lib/medium-fields";
import { situacaoBadgeClass, SITUACAO_LABEL } from "@/lib/status";

export const Route = createFileRoute("/app/buscar")({ component: BuscarPage });

type Row = Record<string, unknown> & {
  id: string;
  nome_completo: string;
  situacao: string;
};

const SITUACOES = ["ativo", "em_desenvolvimento", "afastado", "desligado"];

function BuscarPage() {
  const s = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [trinos, setTrinos] = useState<Array<{ id: string; nome: string }>>([]);

  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState("");
  const [sexo, setSexo] = useState<"" | Sexo>("");
  const [polaridade, setPolaridade] = useState("");
  const [classeElev, setClasseElev] = useState("");
  const [falangeMiss, setFalangeMiss] = useState("");
  const [trinoId, setTrinoId] = useState("");
  const [povo, setPovo] = useState("");
  const [adjunto, setAdjunto] = useState("");

  useEffect(() => {
    if (!s.templo?.id) return;
    (async () => {
      const [{ data }, { data: ts }] = await Promise.all([
        db.from("mediuns").select("*").eq("templo_id", s.templo!.id).order("nome_completo"),
        db.from("trinos").select("id, nome").order("nome"),
      ]);
      setRows((data ?? []) as Row[]);
      setTrinos((ts ?? []) as typeof trinos);
    })();
  }, [s.templo?.id]);

  const classes = useMemo(() => classesElevacaoFor(sexo || null), [sexo]);
  const falanges = useMemo(() => falangesMissionariasFor(sexo || null), [sexo]);

  const povosOpts = useMemo(() => uniq(rows.map((r) => r.povo as string)), [rows]);
  const adjuntosOpts = useMemo(() => uniq(rows.map((r) => r.adjunto as string)), [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (situacao && situacao !== "all" && r.situacao !== situacao) return false;
      if (sexo && r.sexo !== sexo) return false;
      if (polaridade && polaridade !== "all" && r.polaridade !== polaridade) return false;
      if (classeElev && classeElev !== "all" && r.classe_elevacao !== classeElev) return false;
      if (falangeMiss && falangeMiss !== "all" && r.falange_missionaria !== falangeMiss) return false;
      if (trinoId && trinoId !== "all" && r.trino_id !== trinoId) return false;
      if (povo && povo !== "all" && r.povo !== povo) return false;
      if (adjunto && adjunto !== "all" && r.adjunto !== adjunto) return false;
      if (qq) {
        const hay = [
          r.nome_completo, r.nome_emissao, r.nome_mae, r.nome_pai,
          r.cidade, r.mentores, r.falange_mestrado, r.ministro, r.cavaleiro,
          r.adjunto_devas, r.adjunto_transito, r.adjunto_povo, r.filho_de_devas,
          r.classificacao_medium, r.observacoes,
        ].map((v) => String(v ?? "").toLowerCase()).join(" ");
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, situacao, sexo, polaridade, classeElev, falangeMiss, trinoId, povo, adjunto]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Pesquisa Inteligente</h1>
      <Card>
        <CardContent className="p-4 grid md:grid-cols-4 gap-3">
          <div className="md:col-span-4 space-y-1.5">
            <Label>Busca livre</Label>
            <Input
              placeholder="Nome, nome de emissão, mãe/pai, cidade, mentores, classificação, observações…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <SelectField label="Situação" value={situacao} setValue={setSituacao}
            options={SITUACOES.map((v) => ({ v, l: SITUACAO_LABEL[v] ?? v }))} />

          <div className="space-y-1.5">
            <Label>Gênero</Label>
            <Select value={sexo} onValueChange={(v) => setSexo(v as "" | Sexo)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SelectField label="Mediunidade" value={polaridade} setValue={setPolaridade}
            options={[{ v: "apara", l: "Apará" }, { v: "doutrinador", l: "Doutrinador(a)" }]} />

          <SelectField label="Classe de Elevação" value={classeElev} setValue={setClasseElev}
            options={classes.map((c) => ({ v: c.v, l: c.l }))}
            disabled={!sexo}
            placeholder={sexo ? "Todas" : "Escolha o gênero"} />

          <div className="md:col-span-2 space-y-1.5">
            <Label>Falange Missionária</Label>
            <Select value={falangeMiss} onValueChange={setFalangeMiss} disabled={!sexo}>
              <SelectTrigger>
                <SelectValue placeholder={sexo ? "Todas" : "Escolha o gênero"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {falanges.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <SelectField label="Trino" value={trinoId} setValue={setTrinoId}
            options={trinos.map((t) => ({ v: t.id, l: t.nome }))} />

          <SelectField label="Povo" value={povo} setValue={setPovo}
            options={povosOpts.map((v) => ({ v, l: v }))} />

          <SelectField label="Adjunto" value={adjunto} setValue={setAdjunto}
            options={adjuntosOpts.map((v) => ({ v, l: v }))} />
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">{filtered.length} resultado(s)</div>
      <div className="grid md:grid-cols-2 gap-2">
        {filtered.map((r) => (
          <Link key={r.id} to="/app/mediuns/$id" params={{ id: r.id }}>
            <Card className="hover:border-accent transition-colors">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.nome_completo}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[r.nome_emissao, r.povo, r.adjunto].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${situacaoBadgeClass(r.situacao)}`}>
                  {SITUACAO_LABEL[r.situacao] ?? r.situacao}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label, value, setValue, options, disabled, placeholder = "Todos",
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: Array<{ v: string; l: string }>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={setValue} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function uniq(arr: Array<string | null | undefined>): string[] {
  return [...new Set(arr.filter((v): v is string => !!v && v.trim() !== ""))].sort();
}
