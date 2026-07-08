import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Users, Clock, CheckCircle2, XCircle, Pencil, Search, Trash2 } from "lucide-react";
import { LogoUploader } from "@/components/LogoUploader";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

type Templo = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  status: "pendente" | "ativo" | "suspenso";
  created_at: string;
};

type Mediun = {
  id: string;
  templo_id: string;
  funcao: string | null;
  created_at: string;
};

function AdminPage() {
  const s = useSession();
  const [templos, setTemplos] = useState<Templo[]>([]);
  const [mediuns, setMediuns] = useState<Mediun[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | Templo["status"]>("todos");
  const [editing, setEditing] = useState<Templo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: ts }, { data: ms }] = await Promise.all([
      db.from("templos").select("*").order("created_at", { ascending: false }),
      db.from("mediuns").select("id, templo_id, funcao, created_at"),
    ]);
    setTemplos((ts ?? []) as Templo[]);
    setMediuns((ms ?? []) as Mediun[]);
    setLoading(false);
  };

  useEffect(() => { if (s.roles.includes("super_admin")) load(); }, [s.roles]);

  const stats = useMemo(() => {
    const pend = templos.filter((t) => t.status === "pendente").length;
    const ativ = templos.filter((t) => t.status === "ativo").length;
    const susp = templos.filter((t) => t.status === "suspenso").length;
    const thirtyAgo = Date.now() - 30 * 86400000;
    const novosT = templos.filter((t) => new Date(t.created_at).getTime() >= thirtyAgo).length;
    const novosM = mediuns.filter((m) => new Date(m.created_at).getTime() >= thirtyAgo).length;
    const mestres = mediuns.filter((m) => m.funcao === "mestre").length;
    const ninfas = mediuns.filter((m) => m.funcao === "ninfa").length;
    const perTemplo = new Map<string, number>();
    for (const m of mediuns) perTemplo.set(m.templo_id, (perTemplo.get(m.templo_id) ?? 0) + 1);
    const top = templos
      .map((t) => ({ id: t.id, nome: t.nome, qt: perTemplo.get(t.id) ?? 0 }))
      .sort((a, b) => b.qt - a.qt)
      .slice(0, 10);
    return { pend, ativ, susp, novosT, novosM, mestres, ninfas, total: mediuns.length, perTemplo, top };
  }, [templos, mediuns]);

  if (!s.roles.includes("super_admin")) {
    return <div className="p-6 text-muted-foreground">Acesso restrito ao administrador geral.</div>;
  }

  const approve = async (id: string) => {
    const { error } = await db.rpc("approve_templo", { _templo_id: id });
    if (error) return toast.error(error.message);
    toast.success("Templo aprovado.");
    load();
  };
  const reject = async (id: string) => {
    const { error } = await db.rpc("reject_templo", { _templo_id: id });
    if (error) return toast.error(error.message);
    toast.success("Templo suspenso.");
    load();
  };
  const removeTemplo = async (t: Templo) => {
    const ok = window.confirm(
      `Excluir definitivamente o templo "${t.nome}"?\n\nTodos os médiuns, anexos, campos e histórico deste templo serão apagados. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    const { error } = await db.rpc("delete_templo", { _templo_id: t.id });
    if (error) return toast.error(error.message);
    toast.success("Templo excluído.");
    load();
  };

  const filtered = templos.filter((t) => {
    if (statusFilter !== "todos" && t.status !== statusFilter) return false;
    if (!q) return true;
    const s = `${t.nome} ${t.cidade ?? ""} ${t.estado ?? ""}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  const kpis = [
    { label: "Templos ativos", value: stats.ativ, icon: Building2, tint: "bg-primary/10 text-primary" },
    { label: "Aguardando aprovação", value: stats.pend, icon: Clock, tint: "bg-accent/20 text-accent-foreground" },
    { label: "Suspensos", value: stats.susp, icon: XCircle, tint: "bg-destructive/10 text-destructive" },
    { label: "Total de médiuns", value: stats.total, icon: Users, tint: "bg-primary/10 text-primary" },
    { label: "Novos templos (30d)", value: stats.novosT, icon: CheckCircle2, tint: "bg-accent/20 text-accent-foreground" },
    { label: "Novos médiuns (30d)", value: stats.novosM, icon: Users, tint: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel Global</h1>
        <p className="text-sm text-muted-foreground">Visão geral e gestão de todos os templos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
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
          <CardHeader><CardTitle className="text-base">Médiuns por templo (top 10)</CardTitle></CardHeader>
          <CardContent>
            {stats.top.length ? (
              <ul className="space-y-2">
                {stats.top.map((f) => (
                  <li key={f.id} className="flex items-center gap-3">
                    <span className="text-sm w-48 truncate">{f.nome}</span>
                    <div className="flex-1 h-2 bg-muted rounded">
                      <div className="h-2 bg-accent rounded" style={{ width: `${Math.min(100, f.qt * 5)}%` }} />
                    </div>
                    <span className="text-sm w-10 text-right">{f.qt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por função</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="Mestres" value={stats.mestres} />
            <Row label="Ninfas" value={stats.ninfas} />
            <Row label="Sem função definida" value={stats.total - stats.mestres - stats.ninfas} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-base">Templos cadastrados</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome, cidade ou UF"
                  className="pl-8 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="suspenso">Suspensos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum templo encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Templo</th>
                    <th className="py-2 pr-4">Cidade/UF</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Médiuns</th>
                    <th className="py-2 pr-4">Criado</th>
                    <th className="py-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{t.nome}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {[t.cidade, t.estado].filter(Boolean).join("/") || "—"}
                      </td>
                      <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                      <td className="py-2 pr-4">{stats.perTemplo.get(t.id) ?? 0}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-2 justify-end">
                          {t.status === "pendente" && (
                            <>
                              <Button size="sm" onClick={() => approve(t.id)}>Aprovar</Button>
                              <Button size="sm" variant="outline" onClick={() => reject(t.id)}>Rejeitar</Button>
                            </>
                          )}
                          {t.status === "ativo" && (
                            <Button size="sm" variant="outline" onClick={() => reject(t.id)}>Suspender</Button>
                          )}
                          {t.status === "suspenso" && (
                            <Button size="sm" onClick={() => approve(t.id)}>Reativar</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeTemplo(t)}
                            aria-label="Excluir templo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <BrandingCard />

      <CustomFieldsManager scope="global" />

      <EditTemploDialog templo={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function BrandingCard() {
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const { data } = await db.from("app_settings").select("logo_path").eq("id", 1).maybeSingle();
    setLogoPath((data as { logo_path: string | null } | null)?.logo_path ?? null);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const save = async (path: string | null) => {
    const { error } = await db
      .from("app_settings")
      .update({ logo_path: path, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLogoPath(path);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identidade visual do TemploHub</CardTitle>
      </CardHeader>
      <CardContent>
        {loaded ? (
          <LogoUploader
            bucket="app-branding"
            currentPath={logoPath}
            buildKey={(fileName) => `logo-${Date.now()}-${fileName}`}
            onSaved={save}
            label="Logo do sistema"
            helper="Aparece no menu lateral para todos os usuários."
          />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Templo["status"] }) {
  const map: Record<Templo["status"], string> = {
    ativo: "bg-primary/10 text-primary",
    pendente: "bg-accent/20 text-accent-foreground",
    suspenso: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${map[status]}`}>{status}</span>
  );
}

function EditTemploDialog({
  templo,
  onClose,
  onSaved,
}: {
  templo: Templo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<{ nome: string; cidade: string; estado: string; status: Templo["status"] }>({
    nome: "",
    cidade: "",
    estado: "",
    status: "ativo",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (templo) {
      setForm({
        nome: templo.nome,
        cidade: templo.cidade ?? "",
        estado: templo.estado ?? "",
        status: templo.status,
      });
    }
  }, [templo]);

  const save = async () => {
    if (!templo) return;
    setBusy(true);
    const { error } = await db.rpc("update_templo", {
      _templo_id: templo.id,
      _nome: form.nome,
      _cidade: form.cidade || null,
      _estado: form.estado || null,
      _status: form.status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Templo atualizado.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!templo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar templo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Templo["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
