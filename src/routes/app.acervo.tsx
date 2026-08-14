import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { db as supabase } from "@/lib/db";
import {
  completeAcervoUploadFn,
  deleteAcervoFile,
  listAcervoFiles,
  prepareAcervoUploadFn,
  renameAcervoFile,
} from "@/lib/acervo.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/acervo")({
  component: AcervoPage,
  head: () => ({
    meta: [
      { title: "Acervo do templo | TemploHub" },
      { name: "description", content: "Envie, renomeie e baixe documentos do acervo do seu templo." },
      { property: "og:title", content: "Acervo do templo | TemploHub" },
      { property: "og:description", content: "Envie, renomeie e baixe documentos do acervo do seu templo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Item = {
  id: string;
  nome: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  url: string | null;
};

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg";
const MAX = 20 * 1024 * 1024;

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AcervoPage() {
  const list = useServerFn(listAcervoFiles);
  const prepare = useServerFn(prepareAcervoUploadFn);
  const complete = useServerFn(completeAcervoUploadFn);
  const rename = useServerFn(renameAcervoFile);
  const remove = useServerFn(deleteAcervoFile);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await list({});
      setItems(res.items as Item[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar o acervo.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFile(file: File) {
    if (!/\.(pdf|docx|png|jpe?g)$/i.test(file.name)) {
      toast.error("Formato inválido. Envie PDF, DOCX, PNG ou JPEG.");
      return;
    }
    if (file.size > MAX) {
      toast.error("O arquivo deve ter no máximo 20 MB.");
      return;
    }
    setUploading(true);
    try {
      const contentType = file.type || "application/octet-stream";
      const meta = { name: file.name, contentType, size: file.size };
      const prepared = await prepare({ data: { file: meta } });
      const { error } = await supabase.storage
        .from("mediuns-docs")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType });
      if (error) throw new Error(error.message);
      await complete({ data: { upload: { ...meta, path: prepared.path } } });
      toast.success("Arquivo enviado.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio do arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveNome(id: string) {
    const nome = editingNome.trim();
    if (!nome) {
      toast.error("Informe um nome válido.");
      return;
    }
    try {
      await rename({ data: { id, nome } });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, nome } : i)));
      setEditingId(null);
      toast.success("Nome atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível renomear.");
    }
  }

  async function excluir(id: string) {
    if (!window.confirm("Remover este arquivo do acervo?")) return;
    try {
      await remove({ data: { id } });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Arquivo removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Acervo</h1>
        <p className="text-sm text-muted-foreground">
          Documentos do templo em PDF, DOCX, PNG ou JPEG (até 20 MB por arquivo).
        </p>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Enviando…" : "Enviar arquivo"}
          </Button>
          <span className="text-xs text-muted-foreground">Formatos aceitos: PDF, DOCX, PNG, JPEG.</span>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum arquivo no acervo ainda.
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </span>
                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={editingNome}
                        onChange={(e) => setEditingNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveNome(item.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => void saveNome(item.id)}>
                          Salvar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="truncate font-medium text-sm">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                        {item.sizeBytes ? ` · ${formatSize(item.sizeBytes)}` : ""}
                      </div>
                    </>
                  )}
                </div>
                {editingId !== item.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Renomear"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingNome(item.nome);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {item.url && (
                      <Button asChild size="icon" variant="ghost" aria-label="Baixar">
                        <a href={item.url} target="_blank" rel="noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={() => void excluir(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
