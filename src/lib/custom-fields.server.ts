// Server-only helpers para campos personalizados da ficha do médium.
// Toda validação de tipo/nome/opções e autorização acontece aqui.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMembership } from "./mediuns-read.server";

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "textarea", "boolean", "select"] as const;
export type CustomFieldTipo = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldInput = {
  label: string;
  chave: string;
  tipo: CustomFieldTipo;
  obrigatorio: boolean;
  opcoes: string[] | null;
  parentFieldId: string | null;
};

export type CustomFieldScope = "global" | "templo";

const KEY_RE = /^[a-z0-9_]+$/;

function sanitize(input: CustomFieldInput) {
  const label = input.label.trim();
  const chave = input.chave.trim().toLowerCase();
  if (label.length < 1 || label.length > 120) throw new Error("O nome do campo deve ter entre 1 e 120 caracteres.");
  if (chave.length < 1 || chave.length > 60) throw new Error("A chave deve ter entre 1 e 60 caracteres.");
  if (!KEY_RE.test(chave)) throw new Error("A chave deve conter apenas letras minúsculas, números e _.");
  if (!CUSTOM_FIELD_TYPES.includes(input.tipo)) throw new Error("Tipo de campo inválido.");

  let opcoes: string[] | null = null;
  if (input.tipo === "select") {
    const list = (input.opcoes ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 100);
    if (list.length === 0) throw new Error("Informe ao menos uma opção para a lista suspensa.");
    if (list.some((o) => o.length > 120)) throw new Error("Cada opção deve ter no máximo 120 caracteres.");
    opcoes = Array.from(new Set(list));
  }

  return { label, chave, tipo: input.tipo, obrigatorio: !!input.obrigatorio, opcoes };
}

/** Resolve o templo alvo e garante que o usuário pode escrever naquele escopo. */
async function assertScopeWrite(userId: string, scope: CustomFieldScope, temploId: string | null) {
  const m = await getMembership(userId);
  if (scope === "global") {
    if (!m.isSuperAdmin) throw new Error("Apenas o Administrador Geral pode alterar campos globais.");
    return null;
  }
  const target = temploId ?? m.profileTemploId ?? m.temploIds[0] ?? null;
  if (!target) throw new Error("Nenhum templo vinculado a esta conta.");
  if (m.isSuperAdmin) return target;

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, templo_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const canWrite = (roles ?? []).some(
    (r) => ["admin", "secretario"].includes(r.role) && r.templo_id === target,
  );
  if (!canWrite) throw new Error("Você não tem permissão para alterar os campos deste templo.");
  return target;
}

async function assertScopeRead(userId: string, scope: CustomFieldScope, temploId: string | null) {
  const m = await getMembership(userId);
  if (scope === "global") return null;
  const target = temploId ?? m.profileTemploId ?? m.temploIds[0] ?? null;
  if (!target) throw new Error("Nenhum templo vinculado a esta conta.");
  if (m.isSuperAdmin || m.profileTemploId === target || m.temploIds.includes(target)) return target;
  throw new Error("Você não tem acesso a este templo.");
}

export async function listCustomFields(userId: string, scope: CustomFieldScope, temploId: string | null) {
  const target = await assertScopeRead(userId, scope, temploId);
  let query = supabaseAdmin.from("medium_custom_fields").select("*").order("ordem").order("created_at");
  query = target === null ? query.is("templo_id", null) : query.eq("templo_id", target);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return JSON.parse(JSON.stringify(data ?? [])) as Array<Record<string, unknown>>;
}

async function readField(id: string) {
  const { data, error } = await supabaseAdmin
    .from("medium_custom_fields")
    .select("id, templo_id, parent_field_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campo não encontrado.");
  return data as { id: string; templo_id: string | null; parent_field_id: string | null };
}

export async function createCustomField(
  userId: string,
  scope: CustomFieldScope,
  temploId: string | null,
  input: CustomFieldInput,
) {
  const target = await assertScopeWrite(userId, scope, temploId);
  const values = sanitize(input);

  let parentFieldId: string | null = null;
  if (input.parentFieldId) {
    const parent = await readField(input.parentFieldId);
    if (parent.templo_id !== target) throw new Error("O campo pai pertence a outro escopo.");
    if (parent.parent_field_id) throw new Error("Não é possível criar subcampo de um subcampo.");
    parentFieldId = parent.id;
  }

  const { data: siblings } = await supabaseAdmin
    .from("medium_custom_fields")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);
  const ordem = ((siblings ?? [])[0] as { ordem: number } | undefined)?.ordem ?? 0;

  const { error } = await supabaseAdmin.from("medium_custom_fields").insert({
    ...values,
    templo_id: target,
    parent_field_id: parentFieldId,
    ordem: ordem + 1,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateCustomField(userId: string, id: string, input: CustomFieldInput) {
  const existing = await readField(id);
  await assertScopeWrite(
    userId,
    existing.templo_id === null ? "global" : "templo",
    existing.templo_id,
  );
  const values = sanitize(input);
  const { error } = await supabaseAdmin.from("medium_custom_fields").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteCustomField(userId: string, id: string) {
  const existing = await readField(id);
  await assertScopeWrite(
    userId,
    existing.templo_id === null ? "global" : "templo",
    existing.templo_id,
  );
  const { data: children } = await supabaseAdmin
    .from("medium_custom_fields")
    .select("id")
    .eq("parent_field_id", id);
  const ids = [id, ...((children ?? []) as Array<{ id: string }>).map((c) => c.id)];
  await supabaseAdmin.from("medium_custom_values").delete().in("field_id", ids);
  const { error } = await supabaseAdmin.from("medium_custom_fields").delete().in("id", ids);
  if (error) throw new Error(error.message);
  return { ok: true };
}
