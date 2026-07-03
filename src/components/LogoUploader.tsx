import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

type Props = {
  bucket: string;
  currentPath: string | null;
  buildKey: (fileName: string) => string;
  onSaved: (newPath: string | null) => Promise<void> | void;
  label?: string;
  helper?: string;
  aspect?: "square" | "wide";
};

export function LogoUploader({
  bucket,
  currentPath,
  buildKey,
  onSaved,
  label = "Logo",
  helper,
  aspect = "square",
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentPath) {
        setPreview(null);
        return;
      }
      const { data } = await db.storage.from(bucket).createSignedUrl(currentPath, 3600);
      if (alive && data?.signedUrl) setPreview(data.signedUrl);
    })();
    return () => {
      alive = false;
    };
  }, [bucket, currentPath]);

  const onPick = async (file: File) => {
    setBusy(true);
    try {
      const key = buildKey(file.name);
      const { error } = await db.storage.from(bucket).upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      await onSaved(key);
      toast.success("Imagem atualizada.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!currentPath) return;
    if (!confirm("Remover a imagem?")) return;
    setBusy(true);
    try {
      await db.storage.from(bucket).remove([currentPath]);
      await onSaved(null);
      toast.success("Imagem removida.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const boxCls = aspect === "square" ? "aspect-square w-32" : "aspect-video w-64";

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{label}</div>
      {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
      <div className="flex items-start gap-4">
        <div className={`${boxCls} rounded-md border bg-muted overflow-hidden flex items-center justify-center`}>
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Sem imagem</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <Button type="button" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> {busy ? "Enviando…" : "Enviar imagem"}
          </Button>
          {currentPath && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={clear}>
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
