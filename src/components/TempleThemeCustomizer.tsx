import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, RotateCcw } from "lucide-react";
import { extractPaletteFromFile, type Palette } from "@/lib/palette";

const DEFAULTS: Palette = {
  primary: "#0B1F4D",
  accent: "#C9A24B",
  sidebar: "#0B1F4D",
};

export function TempleThemeCustomizer() {
  const s = useSession();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [pal, setPal] = useState<Palette>(DEFAULTS);

  useEffect(() => {
    if (!s.templo) return;
    const t = s.templo as unknown as {
      theme_primary?: string | null;
      theme_accent?: string | null;
      theme_sidebar?: string | null;
    };
    setPal({
      primary: t.theme_primary || DEFAULTS.primary,
      accent: t.theme_accent || DEFAULTS.accent,
      sidebar: t.theme_sidebar || DEFAULTS.sidebar,
    });
  }, [s.templo]);

  if (!s.templo?.id) return null;

  const set = (k: keyof Palette) => (v: string) =>
    setPal((p) => ({ ...p, [k]: v }));

  const save = async (next: Palette) => {
    setBusy(true);
    const { error } = await db
      .from("templos")
      .update({
        theme_primary: next.primary,
        theme_accent: next.accent,
        theme_sidebar: next.sidebar,
      } as never)
      .eq("id", s.templo!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setPal(next);
    await s.refresh();
    toast.success("Cores aplicadas.");
  };

  const onPickImage = async (file: File) => {
    setBusy(true);
    try {
      const extracted = await extractPaletteFromFile(file);
      setPal(extracted);
      await save(extracted);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => save(DEFAULTS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customização</CardTitle>
        <CardDescription>
          Personalize a paleta de cores deste templo — escolha manualmente ou envie uma imagem
          para extrair as cores dominantes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          {(["primary", "accent", "sidebar"] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label className="capitalize">
                {k === "primary" ? "Cor primária" : k === "accent" ? "Cor de destaque" : "Menu lateral"}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={pal[k]}
                  onChange={(e) => set(k)(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input value={pal[k]} onChange={(e) => set(k)(e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => save(pal)} disabled={busy}>
            {busy ? "Salvando…" : "Aplicar cores"}
          </Button>
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4 mr-1" /> Extrair de uma imagem
          </Button>
          <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
            <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </div>

        <div className="rounded-lg overflow-hidden border">
          <div className="px-4 py-3 text-sm font-medium" style={{ background: pal.sidebar, color: "#fff" }}>
            Prévia — Menu lateral
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            <span className="px-3 py-2 rounded text-sm" style={{ background: pal.primary, color: "#fff" }}>
              Primária
            </span>
            <span className="px-3 py-2 rounded text-sm" style={{ background: pal.accent, color: "#111" }}>
              Destaque
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
