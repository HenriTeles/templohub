// Server-only helpers do Acervo do templo (arquivos gerais, sem vínculo com médium).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMembership, signedUrl } from "./mediuns-read.server";

const BUCKET = "mediuns-docs";
const MAX_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type AcervoUploadMetadata = { name: string; contentType: string; size: number };

function validate(file: AcervoUploadMetadata) {
  const ok =
    ALLOWED_TYPES.includes(file.contentType.toLowerCase()) ||
    /\.(pdf|docx|png|jpe?g)$/i.test(file.name);
  if (!ok) throw new Error("Formato inválido. Envie PDF, DOCX, PNG ou JPEG.");
  if (file.size > MAX_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
}

async function resolveTemplo(userId: string, write: boolean): Promise<string> {
  const m = await getMembership(userId);
  const temploId = m.profileTemploId ?? m.temploIds[0] ?? null;
  if (!temploId) throw new Error("Nenhum templo vinculado a esta conta.");
  if (write) {
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("role, templo_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const canWrite = (roles ?? []).some(
      (r) => r.role === "super_admin" || (["admin", "secretario"].includes(r.role) && r.templo_id === temploId),
    );
    if (!canWrite) throw new Error("Você não tem permissão para alterar o acervo deste templo.");
  }
  return temploId;
}

export type AcervoItem = {
  id: string;
  nome: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  url: string | null;
};

export async function listAcervo(userId: string): Promise<AcervoItem[]> {
  const temploId = await resolveTemplo(userId, false);
  const { data, error } = await supabaseAdmin
    .from("anexos")
    .select("id, nome, storage_path, mime_type, size_bytes, created_at")
    .eq("templo_id", temploId)
    .is("mediun_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((r) => r.storage_path.includes("/acervo/"));
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id as string,
      nome: r.nome as string,
      mimeType: (r.mime_type as string | null) ?? null,
      sizeBytes: (r.size_bytes as number | null) ?? null,
      createdAt: r.created_at as string,
      url: await signedUrl(BUCKET, r.storage_path as string, { download: r.nome as string }),
    })),
  );
}

export async function prepareAcervoUpload(userId: string, file: AcervoUploadMetadata) {
  validate(file);
  const temploId = await resolveTemplo(userId, true);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 140) || "arquivo";
  const path = `${temploId}/acervo/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    throw new Error(`Não foi possível preparar o envio: ${error?.message ?? "erro desconhecido"}`);
  }
  return { path, token: data.token };
}

export async function completeAcervoUpload(
  userId: string,
  upload: AcervoUploadMetadata & { path: string },
) {
  validate(upload);
  const temploId = await resolveTemplo(userId, true);
  const prefix = `${temploId}/acervo/`;
  if (!upload.path.startsWith(prefix) || upload.path.includes("..")) {
    throw new Error("Caminho de arquivo inválido.");
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage.from(BUCKET).download(upload.path);
  if (downloadError || !file) {
    throw new Error(`O arquivo não foi confirmado após o envio: ${downloadError?.message ?? "arquivo ausente"}`);
  }

  const { error } = await supabaseAdmin.from("anexos").insert({
    templo_id: temploId,
    mediun_id: null,
    nome: upload.name,
    storage_path: upload.path,
    mime_type: upload.contentType.toLowerCase(),
    size_bytes: upload.size,
    created_by: userId,
  });
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([upload.path]);
    throw new Error(`Não foi possível registrar o arquivo: ${error.message}`);
  }
  return { ok: true };
}

async function findItem(temploId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from("anexos")
    .select("id, storage_path, templo_id, mediun_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.templo_id !== temploId || data.mediun_id !== null || !String(data.storage_path).includes("/acervo/")) {
    throw new Error("Arquivo não encontrado no acervo deste templo.");
  }
  return data as { id: string; storage_path: string };
}

export async function renameAcervoItem(userId: string, id: string, nome: string) {
  const temploId = await resolveTemplo(userId, true);
  await findItem(temploId, id);
  const nomeLimpo = nome.trim().slice(0, 180);
  if (!nomeLimpo) throw new Error("Informe um nome válido.");
  const { error } = await supabaseAdmin.from("anexos").update({ nome: nomeLimpo }).eq("id", id);
  if (error) throw new Error(error.message);
  return { nome: nomeLimpo };
}

export async function deleteAcervoItem(userId: string, id: string) {
  const temploId = await resolveTemplo(userId, true);
  const item = await findItem(temploId, id);
  await supabaseAdmin.storage.from(BUCKET).remove([item.storage_path]);
  const { error } = await supabaseAdmin.from("anexos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { removed: true };
}
