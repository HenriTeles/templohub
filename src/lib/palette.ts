// Simple dominant-color extractor via bucketed quantization from an image URL.

export type Palette = { primary: string; accent: string; sidebar: string };

const toHex = (n: number) => n.toString(16).padStart(2, "0");
export const rgbToHex = (r: number, g: number, b: number) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
};

const luminance = (r: number, g: number, b: number) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export async function extractPaletteFromFile(file: File): Promise<Palette> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // quantize to 5 bits per channel
      const key = `${r >> 3}-${g >> 3}-${b >> 3}`;
      const cur = buckets.get(key);
      if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n++; }
      else buckets.set(key, { r, g, b, n: 1 });
    }
    const sorted = [...buckets.values()]
      .map((v) => ({ r: v.r / v.n, g: v.g / v.n, b: v.b / v.n, n: v.n }))
      .sort((a, b) => b.n - a.n);
    // choose 3 distinct-ish colors: darkest, most saturated middle, lightest
    const top = sorted.slice(0, 12);
    const dark = [...top].sort(
      (a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b),
    )[0];
    const light = [...top].sort(
      (a, b) => luminance(b.r, b.g, b.b) - luminance(a.r, a.g, a.b),
    )[0];
    const mid = top.find((c) => c !== dark && c !== light) ?? top[0];
    return {
      sidebar: rgbToHex(Math.round(dark.r), Math.round(dark.g), Math.round(dark.b)),
      primary: rgbToHex(Math.round(mid.r), Math.round(mid.g), Math.round(mid.b)),
      accent: rgbToHex(Math.round(light.r), Math.round(light.g), Math.round(light.b)),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
