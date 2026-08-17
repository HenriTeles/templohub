import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getLogoFn,
  prepareLogoUploadFn,
  completeLogoUploadFn,
  removeLogoFn,
} from "@/lib/branding-upload.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

type Props = {
  /** "app" = logo do sistema (Administrador Geral) | "templo" = foto do templo */
  target: "app" | "templo";
  onSaved?: (newPath: string | null) => Promise<void> | void;
  label?: string;
  helper?: string;
  aspect?: "square" | "wide";
};

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];

export function LogoUploader({ target, onSaved, label = "Logo", helper, aspect = "square" }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const readLogo = useServerFn(getLogoFn);
  const prepareUpload = useServerFn(prepareLogoUploadFn);
  const completeUpload = useServerFn(completeLogoUploadFn);
  const removeLogo = useServerFn(removeLogoFn);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await readLogo({ data: { target } });
        if (!alive) return;
        setPreview(res.url);
        setHasLogo(!!res.path);
      } catch {
        if (alive) setPreview(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const onPick = async (file: File) => {
    const contentType = file.type || "application/octet-stream";
    // Pré-validação no cliente; o servidor revalida tipo e tamanho antes de aceitar.
    if (!ALLOWED.includes(contentType.toLowerCase())) {
      toast.error("Envie uma imagem PNG, JPG, WEBP, GIF ou SVG.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const meta = { name: file.name, contentType, size: file.size };
      const prepared = await prepareUpload({ data: { target, file: meta } });
      const { error } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType });
      if (error) throw error;
      const saved = await completeUpload({ data: { target, upload: { ...meta, path: prepared.path } } });
      setPreview(saved.url);
      setHasLogo(true);
      await onSaved?.(saved.path);
      toast.success("Imagem atualizada.");
    } catch (err) {
      toast.error((err as Error).message || "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!hasLogo) return;
    if (!confirm("Remover a imagem?")) return;
    setBusy(true);
    try {
      await removeLogo({ data: { target } });
      setPreview(null);
      setHasLogo(false);
      await onSaved?.(null);
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
          {hasLogo && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={clear}>
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, GIF ou SVG • até 5 MB.</p>
    </div>
  );
}
