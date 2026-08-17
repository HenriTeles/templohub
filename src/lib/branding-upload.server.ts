// Server-only helpers para upload de logos (sistema e templo).
// Valida tipo de arquivo e tamanho ANTES de emitir a URL assinada de upload,
// e confirma o arquivo no Storage antes de gravar o caminho no banco.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMembership, signedUrl } from "./mediuns-read.server";

export type LogoTarget = "app" | "templo";
export type LogoFileMeta = { name: string; contentType: string; size: number };

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];

const BUCKETS: Record<LogoTarget, string> = {
  app: "app-branding",
  templo: "templos-logos",
};

function validate(file: LogoFileMeta) {
  const type = file.contentType.toLowerCase();
  const okType = ALLOWED_TYPES.includes(type) && /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
  if (!okType) throw new Error("Envie uma imagem PNG, JPG, WEBP, GIF ou SVG.");
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("Arquivo inválido.");
  if (file.size > MAX_SIZE) throw new Error("A imagem deve ter no máximo 5 MB.");
}

/** Retorna o templo alvo (ou null para o logo global) após checar permissão. */
async function assertLogoAccess(userId: string, target: LogoTarget, write: boolean) {
  const m = await getMembership(userId);
  if (target === "app") {
    if (write && !m.isSuperAdmin) throw new Error("Apenas o Administrador Geral pode alterar o logo do sistema.");
    return null;
  }
  const temploId = m.profileTemploId ?? m.temploIds[0] ?? null;
  if (!temploId) throw new Error("Nenhum templo vinculado a esta conta.");
  if (!write || m.isSuperAdmin) return temploId;

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, templo_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const canWrite = (roles ?? []).some(
    (r) => ["admin", "secretario"].includes(r.role) && r.templo_id === temploId,
  );
  if (!canWrite) throw new Error("Você não tem permissão para alterar a imagem deste templo.");
  return temploId;
}

async function readLogoPath(target: LogoTarget, temploId: string | null) {
  if (target === "app") {
    const { data } = await supabaseAdmin.from("app_settings").select("logo_path").eq("id", 1).maybeSingle();
    return (data as { logo_path: string | null } | null)?.logo_path ?? null;
  }
  const { data } = await supabaseAdmin.from("templos").select("logo_path").eq("id", temploId!).maybeSingle();
  return (data as { logo_path: string | null } | null)?.logo_path ?? null;
}

async function writeLogoPath(target: LogoTarget, temploId: string | null, path: string | null) {
  if (target === "app") {
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ logo_path: path, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabaseAdmin.from("templos").update({ logo_path: path }).eq("id", temploId!);
  if (error) throw new Error(error.message);
}

export async function readLogo(userId: string, target: LogoTarget) {
  const temploId = await assertLogoAccess(userId, target, false);
  const path = await readLogoPath(target, temploId);
  return { path, url: await signedUrl(BUCKETS[target], path) };
}

export async function prepareLogoUpload(userId: string, target: LogoTarget, file: LogoFileMeta) {
  validate(file);
  const temploId = await assertLogoAccess(userId, target, true);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "logo.png";
  const prefix = target === "app" ? "global" : temploId!;
  const path = `${prefix}/logo-${Date.now()}-${safeName}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKETS[target]).createSignedUploadUrl(path);
  if (error || !data?.token) {
    throw new Error(`Não foi possível preparar o envio: ${error?.message ?? "erro desconhecido"}`);
  }
  return { path, token: data.token, bucket: BUCKETS[target] };
}

export async function completeLogoUpload(
  userId: string,
  target: LogoTarget,
  upload: LogoFileMeta & { path: string },
) {
  validate(upload);
  const temploId = await assertLogoAccess(userId, target, true);
  const bucket = BUCKETS[target];
  const requiredPrefix = target === "app" ? "global/" : `${temploId}/`;
  if (!upload.path.startsWith(requiredPrefix) || upload.path.includes("..")) {
    throw new Error("Caminho de imagem inválido.");
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage.from(bucket).download(upload.path);
  if (downloadError || !file) {
    throw new Error(`O arquivo não foi confirmado após o envio: ${downloadError?.message ?? "arquivo ausente"}`);
  }
  if (file.size > MAX_SIZE || file.size !== upload.size) {
    await supabaseAdmin.storage.from(bucket).remove([upload.path]);
    throw new Error("O arquivo enviado é inválido ou está incompleto. Tente novamente.");
  }

  const previous = await readLogoPath(target, temploId);
  await writeLogoPath(target, temploId, upload.path);
  if (previous && previous !== upload.path) {
    await supabaseAdmin.storage.from(bucket).remove([previous]);
  }
  return { path: upload.path, url: await signedUrl(bucket, upload.path) };
}

export async function removeLogo(userId: string, target: LogoTarget) {
  const temploId = await assertLogoAccess(userId, target, true);
  const bucket = BUCKETS[target];
  const previous = await readLogoPath(target, temploId);
  await writeLogoPath(target, temploId, null);
  if (previous) await supabaseAdmin.storage.from(bucket).remove([previous]);
  return { path: null as string | null, url: null as string | null };
}
