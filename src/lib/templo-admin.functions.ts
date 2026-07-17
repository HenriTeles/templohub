import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Todas as chamadas administrativas passam por server functions autenticadas.
// O backend usa o admin client (service_role) para executar as SECURITY DEFINER
// que agora estão revogadas de authenticated.

async function assertSuperAdmin(userId: string) {
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

export const approveTemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("approve_templo", { _templo_id: data.templo_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectTemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("reject_templo", { _templo_id: data.templo_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("delete_templo", { _templo_id: data.templo_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTemplo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        templo_id: z.string().uuid(),
        nome: z.string().min(1),
        cidade: z.string().nullable(),
        estado: z.string().nullable(),
        status: z.enum(["pendente", "ativo", "suspenso"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("update_templo", {
      _templo_id: data.templo_id,
      _nome: data.nome,
      _cidade: (data.cidade ?? "") as string,
      _estado: (data.estado ?? "") as string,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTemploRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        nome: z.string().min(1),
        cidade: z.string().min(1),
        estado: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Usa o client autenticado do usuário; a RPC create_templo_request é
    // SECURITY DEFINER e cuida de perfil, templo e user_roles via auth.uid().
    const { data: templo_id, error } = await context.supabase.rpc("create_templo_request", {
      _nome: data.nome,
      _cidade: data.cidade,
      _estado: data.estado,
    });
    if (error) throw new Error(error.message);
    return { templo_id: templo_id as string };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Busca o usuário pelo e-mail (case-insensitive) via Admin API paginada.
    const target = data.email.trim().toLowerCase();
    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (match) userId = match.id;
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error(`Usuário não encontrado: ${data.email}`);
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
    });
    if (updErr) throw new Error(updErr.message);
    return { ok: true, email: target };
  });


