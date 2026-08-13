import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, adminUpdatePasswordByEmail } from "./templo-admin.server";

// Fonte única de verdade de autorização das RPCs administrativas:
// assertSuperAdmin(context.userId) AQUI, antes de qualquer chamada. As funções
// approve/reject/update/delete_templo são SECURITY DEFINER executáveis apenas
// por service_role (ver supabase/manual/rpc-admin-service-role-only-2026-08-13.sql)
// e não checam auth.uid() — com a chave de serviço auth.uid() é NULL.



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

    // Apenas o Administrador Geral pode trocar senhas.
    await assertSuperAdmin(context.userId);

    // A senha nunca é gravada em nenhuma tabela: vai direto para a Admin API.
    await adminUpdatePasswordByEmail(target, data.password);

    return { ok: true, email: target };
  });


