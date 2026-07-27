import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getMediunsList } from "@/lib/mediuns-read.functions";
import { useSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { SITUACAO_LABEL, situacaoBadgeClass } from "@/lib/status";
import crucifixo from "@/assets/crucifixo.jpg.asset.json";
import triangulo from "@/assets/triangulo-apara.png.asset.json";

export const Route = createFileRoute("/app/mediuns/")({ component: MediunsPage });

type Row = {
  id: string;
  nome_completo: string;
  nome_emissao: string | null;
  funcao: string | null;
  polaridade: string | null;
  situacao: string;
  cidade: string | null;
  foto_path: string | null;
};

function MediunsPage() {
  const s = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const temploId = s.templo?.id;

  const load = useCallback(async () => {
    if (!temploId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMediunsList({ data: { temploId } });
      setRows((res.rows ?? []) as Row[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os médiuns.");
    } finally {
      setLoading(false);
    }
  }, [temploId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) =>
    !q ||
    r.nome_completo.toLowerCase().includes(q.toLowerCase()) ||
    (r.nome_emissao ?? "").toLowerCase().includes(q.toLowerCase()),
  );


  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Médiuns</h1>
          <p className="text-sm text-muted-foreground">{rows.length} cadastrado(s)</p>
        </div>
        <Link to="/app/mediuns/new">
          <Button><Plus className="w-4 h-4 mr-1" /> Novo Médium</Button>
        </Link>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou nome de emissão"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-2">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      )}
      {loading && !error && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        {filtered.map((r) => (
          <Link key={r.id} to="/app/mediuns/$id" params={{ id: r.id }}>
            <Card className="hover:border-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                  {r.nome_completo.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.nome_completo}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[r.nome_emissao, r.cidade].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="mt-1 flex gap-1 flex-wrap items-center">
                    {r.polaridade && (
                      <span
                        className={
                          "inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " +
                          (r.polaridade === "apara"
                            ? "bg-red-100 text-red-800"
                            : "bg-neutral-200 text-neutral-800")
                        }
                      >
                        <img
                          src={r.polaridade === "apara" ? triangulo.url : crucifixo.url}
                          alt=""
                          className="w-3 h-3 object-contain"
                        />
                        {r.polaridade === "apara" ? "Apará" : "Doutrinador(a)"}
                      </span>
                    )}
                    <span
                      className={
                        "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " +
                        situacaoBadgeClass(r.situacao)
                      }
                    >
                      {SITUACAO_LABEL[r.situacao] ?? r.situacao}
                    </span>
                  </div>

                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!filtered.length && (
          <p className="text-sm text-muted-foreground col-span-full">Nenhum resultado.</p>
        )}
      </div>
    </div>
  );
}
