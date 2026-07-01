import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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

  useEffect(() => { reload(); }, [s.templo?.id]);

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

function ConfigPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie tabelas doutrinárias deste templo</p>
      </div>
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
