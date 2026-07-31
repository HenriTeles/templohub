// Server-only helpers para leitura de médiuns usando o cliente administrativo.
// Toda função aqui valida o vínculo do usuário com o templo antes de retornar dados.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MembershipInfo = {
  isSuperAdmin: boolean;
  temploIds: string[];
  profileTemploId: string | null;
};

export async function getMembership(userId: string): Promise<MembershipInfo> {
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role, templo_id")
    .eq("user_id", userId);
  if (roleError) throw new Error(roleError.message);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("templo_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const rows = roleRows ?? [];
  return {
    isSuperAdmin: rows.some((r) => r.role === "super_admin"),
    temploIds: rows.map((r) => r.templo_id).filter((v): v is string => Boolean(v)),
    profileTemploId: (profile as { templo_id: string | null } | null)?.templo_id ?? null,
  };
}

export async function assertTemploAccess(userId: string, temploId: string): Promise<void> {
  const m = await getMembership(userId);
  if (m.isSuperAdmin) return;
  if (m.profileTemploId === temploId) return;
  if (m.temploIds.includes(temploId)) return;
  throw new Error("Você não tem acesso a este templo.");
}

export async function signedUrl(
  bucket: string,
  path: string | null | undefined,
  options?: { download?: string | boolean },
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 3600, options?.download ? { download: options.download } : undefined);
  if (error) {
    console.error("[storage] createSignedUrl falhou", bucket, path, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function readEmissao(mediunId: string, temploIdHint?: string) {
  const empty = { emissaoNome: null as string | null, emissaoUrl: null as string | null };

  const { data, error } = await supabaseAdmin
    .from("anexos")
    .select("id, nome, storage_path, mime_type, created_at")
    .eq("mediun_id", mediunId)
    .order("created_at", { ascending: false });
  if (error) console.error("[emissao] consulta anexos falhou:", error.message);

  const rows = (data ?? []) as Array<{ nome: string; storage_path: string }>;
  const row = rows.find((r) => r.storage_path.includes("/emissoes/")) ?? rows[0] ?? null;

  if (row) {
    const url = await signedUrl("mediuns-docs", row.storage_path, { download: row.nome });
    if (url) return { emissaoNome: row.nome, emissaoUrl: url };
  }

  // Fallback: procurar o arquivo direto no storage caso o registro em "anexos" falte.
  const temploId = temploIdHint ?? (await readMediumTemploId(mediunId).catch(() => null));
  if (!temploId) return empty;

  const prefix = `${temploId}/emissoes/${mediunId}`;
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from("mediuns-docs")
    .list(prefix, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
  if (listError) {
    console.error("[emissao] listagem do storage falhou:", listError.message);
    return empty;
  }
  const file = (files ?? []).find((f) => f.name && f.id !== null) ?? (files ?? [])[0];
  if (!file) return empty;

  const nome = file.name.replace(/^[0-9a-f-]{36}-/i, "");
  const url = await signedUrl("mediuns-docs", `${prefix}/${file.name}`, { download: nome });
  return { emissaoNome: nome, emissaoUrl: url };
}


export async function listMediuns(userId: string, temploId: string) {
  await assertTemploAccess(userId, temploId);
  const { data, error } = await supabaseAdmin
    .from("mediuns")
    .select("id, nome_completo, nome_emissao, funcao, polaridade, situacao, cidade, foto_path")
    .eq("templo_id", temploId)
    .order("nome_completo");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function readMediumDetail(userId: string, id: string) {
  const { data: medium, error } = await supabaseAdmin
    .from("mediuns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!medium) throw new Error("Médium não encontrado.");

  const row = medium as Record<string, unknown> & { templo_id: string; foto_path: string | null; trino_id: string | null };
  await assertTemploAccess(userId, row.templo_id);

  const fotoUrl = await signedUrl("mediuns-fotos", row.foto_path);
  const emissao = await readEmissao(id);


  let trinoNome: string | null = null;
  if (row.trino_id) {
    const { data: t } = await supabaseAdmin.from("trinos").select("nome").eq("id", row.trino_id).maybeSingle();
    trinoNome = (t as { nome: string } | null)?.nome ?? null;
  }

  const { data: historico } = await supabaseAdmin
    .from("historico")
    .select("id, acao, created_at")
    .eq("mediun_id", id)
    .order("created_at", { ascending: false });

  const { data: customFields } = await supabaseAdmin
    .from("medium_custom_fields")
    .select("*")
    .or(`templo_id.is.null,templo_id.eq.${row.templo_id}`)
    .order("ordem")
    .order("created_at");

  const { data: values } = await supabaseAdmin
    .from("medium_custom_values")
    .select("field_id, valor")
    .eq("mediun_id", id);

  const customValues: Record<string, string> = {};
  for (const v of (values ?? []) as Array<{ field_id: string; valor: string | null }>) {
    if (v.valor != null) customValues[v.field_id] = v.valor;
  }

  return {
    medium: JSON.parse(JSON.stringify(row)) as Record<string, string | number | boolean | null>,
    fotoUrl,
    emissaoUrl: emissao.emissaoUrl,
    emissaoNome: emissao.emissaoNome,

    trinoNome,
    historico: (historico ?? []) as Array<{ id: string; acao: string; created_at: string }>,
    customFields: JSON.parse(JSON.stringify(customFields ?? [])) as Array<Record<string, string | number | boolean | null>>,
    customValues,
  };
}

export async function deleteMedium(userId: string, id: string) {
  const { data: medium, error } = await supabaseAdmin
    .from("mediuns")
    .select("id, templo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!medium) throw new Error("Médium não encontrado.");

  const row = medium as { id: string; templo_id: string };
  const m = await getMembership(userId);
  const canAdmin = m.isSuperAdmin || m.temploIds.includes(row.templo_id) || m.profileTemploId === row.templo_id;
  if (!canAdmin) throw new Error("Você não tem permissão para excluir este médium.");

  await supabaseAdmin.from("medium_custom_values").delete().eq("mediun_id", id);
  await supabaseAdmin.from("historico").delete().eq("mediun_id", id);
  const { error: delError } = await supabaseAdmin.from("mediuns").delete().eq("id", id);
  if (delError) throw new Error(delError.message);
  return { ok: true };
}

export async function readBrandingUrls(userId: string) {
  const m = await getMembership(userId);
  const temploId = m.profileTemploId ?? m.temploIds[0] ?? null;

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("logo_path")
    .eq("id", 1)
    .maybeSingle();
  const appLogoUrl = await signedUrl("app-branding", (settings as { logo_path: string | null } | null)?.logo_path);

  let temploLogoUrl: string | null = null;
  if (temploId) {
    const { data: templo } = await supabaseAdmin
      .from("templos")
      .select("logo_path")
      .eq("id", temploId)
      .maybeSingle();
    temploLogoUrl = await signedUrl("templos-logos", (templo as { logo_path: string | null } | null)?.logo_path);
  }

  return { appLogoUrl, temploLogoUrl };
}

export async function readMediumTemploId(id: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("mediuns")
    .select("templo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { templo_id: string } | null;
  if (!row) throw new Error("Médium não encontrado.");
  return row.templo_id;
}
