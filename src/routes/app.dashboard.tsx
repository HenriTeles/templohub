import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Sparkles, Sun, Moon, BookOpen, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({ component: DashboardPage });

type Counts = {
  total: number;
  mestres: number;
  ninfas: number;
  aparas: number;
  doutrinadores: number;
  porFalange: Array<{ nome: string; qt: number }>;
  porCenturia: Array<{ nome: string; qt: number }>;
};

function DashboardPage() {
  const s = useSession();
  const templo_id = s.templo?.id;
  const [c, setC] = useState<Counts | null>(null);
  const [recentes, setRecentes] = useState<Array<{ id: string; nome_completo: string; created_at: string }>>([]);
  const [aniversariantes, setAniversariantes] = useState<
    Array<{ id: string; nome_completo: string; data_nascimento: string }>
  >([]);

  useEffect(() => {
    if (!templo_id) return;
    (async () => {
      const { data: rows } = await db
        .from("mediuns")
        .select("id, nome_completo, funcao, polaridade, data_nascimento, created_at, falange_id, centuria_id")
        .eq("templo_id", templo_id);
      const list = (rows ?? []) as Array<{
        id: string;
        nome_completo: string;
        funcao: string | null;
        polaridade: string | null;
        data_nascimento: string | null;
        created_at: string;
        falange_id: string | null;
        centuria_id: string | null;
      }>;

      const counts: Counts = {
        total: list.length,
        mestres: list.filter((m) => m.funcao === "mestre").length,
        ninfas: list.filter((m) => m.funcao === "ninfa").length,
        aparas: list.filter((m) => m.polaridade === "apara").length,
        doutrinadores: list.filter((m) => m.polaridade === "doutrinador").length,
        porFalange: [],
        porCenturia: [],
      };

      const [{ data: fs }, { data: cs }] = await Promise.all([
        db.from("falanges").select("id, nome").or(`templo_id.eq.${templo_id},templo_id.is.null`),
        db.from("centurias").select("id, nome").eq("templo_id", templo_id),
      ]);
      const fmap = new Map((fs ?? []).map((f: { id: string; nome: string }) => [f.id, f.nome]));
      const cmap = new Map((cs ?? []).map((f: { id: string; nome: string }) => [f.id, f.nome]));
      const fc = new Map<string, number>();
      const cc = new Map<string, number>();
      for (const m of list) {
        if (m.falange_id) fc.set(m.falange_id, (fc.get(m.falange_id) ?? 0) + 1);
        if (m.centuria_id) cc.set(m.centuria_id, (cc.get(m.centuria_id) ?? 0) + 1);
      }
      counts.porFalange = Array.from(fc.entries())
        .map(([id, qt]) => ({ nome: (fmap.get(id) as string | undefined) ?? "—", qt }))
        .sort((a, b) => b.qt - a.qt)
        .slice(0, 8);
      counts.porCenturia = Array.from(cc.entries())
        .map(([id, qt]) => ({ nome: (cmap.get(id) as string | undefined) ?? "—", qt }))
        .sort((a, b) => b.qt - a.qt)
        .slice(0, 8);
      setC(counts);

      setRecentes(
        [...list]
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, 6)
          .map((m) => ({ id: m.id, nome_completo: m.nome_completo, created_at: m.created_at })),
      );

      // aniversariantes nos próximos 30 dias
      const hoje = new Date();
      const upcoming = list
        .filter((m) => m.data_nascimento)
        .map((m) => {
          const d = new Date(m.data_nascimento as string);
          const next = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
          if (next < hoje) next.setFullYear(hoje.getFullYear() + 1);
          const diff = Math.floor((next.getTime() - hoje.getTime()) / 86400000);
          return { id: m.id, nome_completo: m.nome_completo, data_nascimento: m.data_nascimento!, diff };
        })
        .filter((x) => x.diff <= 30)
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 6);
      setAniversariantes(upcoming);
    })();
  }, [templo_id]);

  const kpi = [
    { label: "Total de médiuns", value: c?.total ?? 0, icon: Users, tint: "bg-primary/10 text-primary" },
    { label: "Mestres", value: c?.mestres ?? 0, icon: Sun, tint: "bg-accent/20 text-accent-foreground" },
    { label: "Ninfas", value: c?.ninfas ?? 0, icon: Moon, tint: "bg-accent/20 text-accent-foreground" },
    { label: "Aparás", value: c?.aparas ?? 0, icon: Sparkles, tint: "bg-primary/10 text-primary" },
    { label: "Doutrinadores", value: c?.doutrinadores ?? 0, icon: BookOpen, tint: "bg-accent/20 text-accent-foreground" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do templo</p>
        </div>
        <Link
          to="/app/mediuns/new"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          + Novo Médium
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpi.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center mb-3 ${k.tint}`}>
                <k.icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-semibold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Quantidade por Falange</CardTitle></CardHeader>
          <CardContent>
            {c && c.porFalange.length > 0 ? (
              <ul className="space-y-2">
                {c.porFalange.map((f) => (
                  <li key={f.nome} className="flex items-center gap-3">
                    <span className="text-sm w-40 truncate">{f.nome}</span>
                    <div className="flex-1 h-2 bg-muted rounded">
                      <div className="h-2 bg-accent rounded" style={{ width: `${Math.min(100, f.qt * 15)}%` }} />
                    </div>
                    <span className="text-sm w-8 text-right">{f.qt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Quantidade por Centúria</CardTitle></CardHeader>
          <CardContent>
            {c && c.porCenturia.length > 0 ? (
              <ul className="space-y-2">
                {c.porCenturia.map((f) => (
                  <li key={f.nome} className="flex items-center gap-3">
                    <span className="text-sm w-40 truncate">{f.nome}</span>
                    <div className="flex-1 h-2 bg-muted rounded">
                      <div className="h-2 bg-primary rounded" style={{ width: `${Math.min(100, f.qt * 15)}%` }} />
                    </div>
                    <span className="text-sm w-8 text-right">{f.qt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Cadastre centúrias em Configurações.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos cadastros</CardTitle></CardHeader>
          <CardContent>
            {recentes.length ? (
              <ul className="divide-y">
                {recentes.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between">
                    <Link to="/app/mediuns/$id" params={{ id: m.id }} className="text-sm hover:underline">
                      {m.nome_completo}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum médium cadastrado ainda.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Próximos aniversariantes (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aniversariantes.length ? (
              <ul className="divide-y">
                {aniversariantes.map((m) => {
                  const d = new Date(m.data_nascimento);
                  return (
                    <li key={m.id} className="py-2 flex items-center justify-between">
                      <Link to="/app/mediuns/$id" params={{ id: m.id }} className="text-sm hover:underline">
                        {m.nome_completo}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {d.getDate().toString().padStart(2, "0")}/{(d.getMonth() + 1).toString().padStart(2, "0")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem aniversários nos próximos 30 dias.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
