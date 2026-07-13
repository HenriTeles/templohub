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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // create_templo_request usa auth.uid() internamente. Como o admin client não
    // possui contexto de usuário, replicamos a lógica aqui usando context.userId.
    const uid = context.userId;

    // Bloqueia super admins
    const { data: sa } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", uid)
      .eq("role", "super_admin")
      .limit(1);
    if (sa && sa.length > 0) throw new Error("super admins do not belong to a templo");

    // Garante perfil
    const email = context.claims?.email as string | undefined;
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: uid, email: email ?? null, nome: (email ?? "").split("@")[0] || "usuario" },
        { onConflict: "id", ignoreDuplicates: true },
      );

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("templo_id")
      .eq("id", uid)
      .maybeSingle();
    if (prof?.templo_id) throw new Error("user already belongs to a templo");

    const { data: templo, error: tErr } = await supabaseAdmin
      .from("templos")
      .insert({
        nome: data.nome,
        cidade: data.cidade,
        estado: data.estado,
        status: "pendente",
        created_by: uid,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);

    await supabaseAdmin.from("profiles").update({ templo_id: templo.id }).eq("id", uid);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: "admin", templo_id: templo.id }, { ignoreDuplicates: true });

    return { templo_id: templo.id };
  });
