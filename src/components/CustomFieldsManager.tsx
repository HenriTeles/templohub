import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Plus, Pencil } from "lucide-react";

export type CustomField = {
  id: string;
  templo_id: string | null;
  parent_field_id: string | null;
  label: string;
  chave: string;
  tipo: "text" | "number" | "date" | "textarea" | "boolean" | "select";
  opcoes: string[] | null;
  ordem: number;
  obrigatorio: boolean;
};

const TIPOS: Array<{ v: CustomField["tipo"]; l: string }> = [
  { v: "text", l: "Texto curto" },
  { v: "textarea", l: "Texto longo" },
  { v: "number", l: "Número" },
  { v: "date", l: "Data" },
  { v: "boolean", l: "Sim/Não" },
  { v: "select", l: "Lista suspensa" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

type DialogState =
  | { mode: "add"; parent: string | null }
  | { mode: "edit"; field: CustomField }
  | null;

/**
 * scope="global"  → super admin manages templo_id = NULL
 * scope="templo"  → templo admin manages fields for a single templo_id
 */
export function CustomFieldsManager({
  scope,
  temploId,
}: {
  scope: "global" | "templo";
  temploId?: string | null;
}) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);

  const load = async () => {
    setLoading(true);
    let q = db.from("medium_custom_fields").select("*").order("ordem").order("created_at");
    if (scope === "global") q = q.is("templo_id", null);
    else if (temploId) q = q.eq("templo_id", temploId);
    const { data } = await q;
    setFields((data ?? []) as CustomField[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, temploId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este campo? Todos os valores preenchidos serão apagados.")) return;
    const { error } = await db.from("medium_custom_fields").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Campo removido.");
      load();
    }
  };

  const roots = fields.filter((f) => !f.parent_field_id);
  const childrenOf = (id: string) => fields.filter((f) => f.parent_field_id === id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">
            {scope === "global" ? "Campos globais da ficha" : "Campos personalizados"}
          </CardTitle>
          <CardDescription>
            {scope === "global"
              ? "Aparecem em todas as fichas de todos os templos."
              : "Aparecem apenas nas fichas dos médiuns deste templo."}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialog({ mode: "add", parent: null })}>
          <Plus className="w-4 h-4 mr-1" /> Novo campo
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo cadastrado ainda.</p>
        ) : (
          <ul className="divide-y">
            {roots.map((f) => (
              <li key={f.id} className="py-3">
                <FieldRow
                  field={f}
                  onDelete={() => remove(f.id)}
                  onEdit={() => setDialog({ mode: "edit", field: f })}
                  onAddChild={() => setDialog({ mode: "add", parent: f.id })}
                />
                {childrenOf(f.id).length > 0 && (
                  <ul className="mt-2 ml-6 border-l pl-4 space-y-2">
                    {childrenOf(f.id).map((c) => (
                      <li key={c.id}>
                        <FieldRow
                          field={c}
                          onDelete={() => remove(c.id)}
                          onEdit={() => setDialog({ mode: "edit", field: c })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {dialog && (
        <FieldDialog
          scope={scope}
          temploId={temploId ?? null}
          state={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function FieldRow({
  field,
  onDelete,
  onEdit,
  onAddChild,
}: {
  field: CustomField;
  onDelete: () => void;
  onEdit: () => void;
  onAddChild?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-sm font-medium">{field.label}</div>
        <div className="text-xs text-muted-foreground">
          <span className="uppercase mr-2">{field.tipo}</span>
          <span className="opacity-70">{field.chave}</span>
          {field.obrigatorio && <span className="ml-2 text-destructive">obrigatório</span>}
        </div>
      </div>
      <div className="flex gap-1">
        {onAddChild && (
          <Button size="sm" variant="ghost" onClick={onAddChild} title="Adicionar subcampo">
            <Plus className="w-4 h-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} title="Editar campo">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir campo">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function FieldDialog({
  scope,
  temploId,
  state,
  onClose,
  onSaved,
}: {
  scope: "global" | "templo";
  temploId: string | null;
  state: Exclude<DialogState, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state.mode === "edit" ? state.field : null;
  const parentId = state.mode === "add" ? state.parent : editing?.parent_field_id ?? null;

  const [label, setLabel] = useState(editing?.label ?? "");
  const [chave, setChave] = useState(editing?.chave ?? "");
  const [chaveTouched, setChaveTouched] = useState(false);
  const [tipo, setTipo] = useState<CustomField["tipo"]>(editing?.tipo ?? "text");
  const [opcoes, setOpcoes] = useState((editing?.opcoes ?? []).join("\n"));
  const [obrigatorio, setObrigatorio] = useState(editing?.obrigatorio ?? false);
  const [busy, setBusy] = useState(false);

  // Auto-slug from label until the user manually edits the chave.
  useEffect(() => {
    if (!chaveTouched) setChave(slugify(label));
  }, [label, chaveTouched]);

  const save = async () => {
    if (!label.trim() || !chave.trim()) return;

    if (editing) {
      if (chave !== editing.chave) {
        if (!confirm("Alterar a chave pode quebrar integrações que dependem dela. Continuar?")) return;
      }
      if (tipo !== editing.tipo) {
        if (!confirm("Alterar o tipo pode deixar valores já preenchidos inválidos. Continuar?")) return;
      }
    }

    setBusy(true);
    const payload: Record<string, unknown> = {
      label: label.trim(),
      chave: chave.trim(),
      tipo,
      obrigatorio,
      opcoes: tipo === "select"
        ? opcoes.split("\n").map((s) => s.trim()).filter(Boolean)
        : null,
    };

    let error;
    if (editing) {
      ({ error } = await db.from("medium_custom_fields").update(payload).eq("id", editing.id));
    } else {
      payload.parent_field_id = parentId;
      payload.templo_id = scope === "global" ? null : temploId;
      ({ error } = await db.from("medium_custom_fields").insert(payload));
    }

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Campo atualizado." : "Campo criado.");
    onSaved();
  };

  const title = editing
    ? "Editar campo"
    : parentId
      ? "Novo subcampo"
      : "Novo campo";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {scope === "global"
              ? "Este campo será visto por todos os templos."
              : "Este campo será visto apenas neste templo."}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Nome do campo</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Alergia a medicamento" />
        </div>
        <div className="space-y-2">
          <Label>Chave interna</Label>
          <Input
            value={chave}
            onChange={(e) => {
              setChaveTouched(true);
              setChave(slugify(e.target.value));
            }}
            placeholder="alergia_a_medicamento"
          />
          <p className="text-[11px] text-muted-foreground">Somente letras, números e _.</p>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as CustomField["tipo"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {tipo === "select" && (
          <div className="space-y-2">
            <Label>Opções (uma por linha)</Label>
            <textarea
              className="w-full min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
              value={opcoes}
              onChange={(e) => setOpcoes(e.target.value)}
              placeholder={"Opção 1\nOpção 2"}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={obrigatorio} onCheckedChange={(v) => setObrigatorio(!!v)} />
          Obrigatório no preenchimento
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy || !label.trim() || !chave.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
