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
    const target = data.email.trim().toLowerCase();

    // Não depende mais de SUPABASE_SERVICE_ROLE_KEY no runtime do app.
    // O insert autenticado aciona um trigger SECURITY DEFINER no banco, que
    // valida o Administrador Geral e aplica a senha diretamente em auth.users.
    const { error } = await (context.supabase as any)
      .from("admin_password_resets")
      .insert({ target_email: target, new_password: data.password });

    if (error) {
      const message = error.message || "Falha ao trocar a senha.";
      console.error("[adminSetUserPassword] RPC via trigger falhou:", message);
      if (message.includes("admin_password_resets") && message.includes("does not exist")) {
        throw new Error("A estrutura segura de troca de senha ainda não foi aplicada no banco. Execute o script fix-troca-senha-sem-service-role-2026-07-20.sql no Supabase.");
      }
      if (message.toLowerCase().includes("forbidden")) {
        throw new Error("Apenas o Administrador Geral pode trocar senhas de usuários.");
      }
      throw new Error(message);
    }

    return { ok: true, email: target };
  });


