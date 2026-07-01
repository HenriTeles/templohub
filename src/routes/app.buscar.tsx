import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/buscar")({ component: BuscarPage });

type Row = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  cidade: string | null;
  funcao: string | null;
  polaridade: string | null;
  situacao: string;
  falange_id: string | null;
  centuria_id: string | null;
  data_nascimento: string | null;
};

function BuscarPage() {
  const s = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [falanges, setFalanges] = useState<Array<{ id: string; nome: string }>>([]);
  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState("");
  const [funcao, setFuncao] = useState("");
  const [polaridade, setPolaridade] = useState("");
  const [falangeId, setFalangeId] = useState("");

  useEffect(() => {
    if (!s.templo?.id) return;
    (async () => {
      const { data } = await db
        .from("mediuns")
        .select("id, nome_completo, cpf, cidade, funcao, polaridade, situacao, falange_id, centuria_id, data_nascimento")
        .eq("templo_id", s.templo!.id)
        .order("nome_completo");
      setRows((data ?? []) as Row[]);
      const { data: fs } = await db
        .from("falanges")
        .select("id, nome")
        .or(`templo_id.eq.${s.templo!.id},templo_id.is.null`)
        .order("nome");
      setFalanges((fs ?? []) as typeof falanges);
    })();
  }, [s.templo?.id]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (situacao && situacao !== "all" && r.situacao !== situacao) return false;
      if (funcao && funcao !== "all" && r.funcao !== funcao) return false;
      if (polaridade && polaridade !== "all" && r.polaridade !== polaridade) return false;
      if (falangeId && falangeId !== "all" && r.falange_id !== falangeId) return false;
      if (qq) {
        const hay = `${r.nome_completo} ${r.cpf ?? ""} ${r.cidade ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, situacao, funcao, polaridade, falangeId]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Pesquisa Inteligente</h1>
      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-3">
          <div className="md:col-span-2 space-y-1.5">
            <Label>Busca livre</Label>
            <Input placeholder="Nome, CPF, cidade…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_desenvolvimento">Em desenvolvimento</SelectItem>
                <SelectItem value="licenciado">Licenciado</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Função</Label>
            <Select value={funcao} onValueChange={setFuncao}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mestre">Mestre</SelectItem>
                <SelectItem value="ninfa">Ninfa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Polaridade</Label>
            <Select value={polaridade} onValueChange={setPolaridade}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="apara">Apará</SelectItem>
                <SelectItem value="doutrinador">Doutrinador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Falange</Label>
            <Select value={falangeId} onValueChange={setFalangeId}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {falanges.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">{filtered.length} resultado(s)</div>
      <div className="grid md:grid-cols-2 gap-2">
        {filtered.map((r) => (
          <Link key={r.id} to="/app/mediuns/$id" params={{ id: r.id }}>
            <Card className="hover:border-accent transition-colors">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.nome_completo}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.cidade, r.cpf].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {r.situacao}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
