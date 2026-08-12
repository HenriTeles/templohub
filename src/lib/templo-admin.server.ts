// Helpers server-only usados pelas server functions de administração.
// Mantidos fora de *.functions.ts para que o split de server functions do
// TanStack Start não perca referências em runtime.

export async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("forbidden");
}

// Troca de senha administrativa: usa a Admin API do Supabase Auth diretamente,
// sem gravar o valor da senha em nenhuma tabela (nem temporariamente).
export async function adminUpdatePasswordByEmail(email: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    userId = users.find((u) => (u.email ?? "").trim().toLowerCase() === email)?.id;
    if (users.length < 200) break;
  }

  if (!userId) throw new Error("Usuário não encontrado para o e-mail informado.");

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (updateError) throw new Error(updateError.message);

  return { userId };
}
