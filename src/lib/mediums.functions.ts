import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveMediumRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.union([z.string().uuid(), z.literal("new")]),
        temploId: z.string().uuid(),
        payload: z.record(z.string(), z.unknown()),
        customValues: z.record(z.string().uuid(), z.string().nullable()).default({}),
        foto: z
          .object({
            name: z.string().min(1).max(180),
            contentType: z.string().min(1).max(120),
            base64: z.string().min(1),
          })
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, templo_id")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);

    const canWrite = (roleRows ?? []).some((row) => {
      if (row.role === "super_admin") return true;
      return ["admin", "secretario"].includes(row.role) && row.templo_id === data.temploId;
    });
    if (!canWrite) throw new Error("Apenas administradores do templo podem cadastrar ou editar médiuns.");

    const payload: Record<string, unknown> = { ...data.payload };
    for (const key of ["id", "created_at", "updated_at"] as const) delete payload[key];
    for (const key of Object.keys(payload)) if (payload[key] === "") payload[key] = null;
    payload.templo_id = data.temploId;
    payload.created_by = context.userId;

    if (data.foto) {
      const estimatedBytes = Math.floor((data.foto.base64.length * 3) / 4);
      if (estimatedBytes > 8 * 1024 * 1024) throw new Error("A foto deve ter no máximo 8 MB.");

      const binary = atob(data.foto.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const safeName = data.foto.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 140) || "foto.jpg";
      const storagePath = `${data.temploId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("mediuns-fotos")
        .upload(storagePath, bytes, {
          contentType: data.foto.contentType || "application/octet-stream",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
      payload.foto_path = storagePath;
    }

    let savedId = data.id;
    if (data.id === "new") {
      const { data: inserted, error: insertError } = await (supabaseAdmin as any)
        .from("mediuns")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      savedId = inserted.id;
    } else {
      const { data: updated, error: updateError } = await (supabaseAdmin as any)
        .from("mediuns")
        .update(payload)
        .eq("id", data.id)
        .eq("templo_id", data.temploId)
        .select("id")
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);
      if (!updated) throw new Error("Médium não encontrado neste templo.");
    }

    // A emissão é enviada diretamente ao Storage por URL assinada
    // (prepareMediumEmissaoUpload / completeMediumEmissaoUpload).





    await supabaseAdmin.from("historico").insert({
      templo_id: data.temploId,
      mediun_id: savedId,
      user_id: context.userId,
      acao: data.id === "new" ? "cadastro_criado" : "cadastro_atualizado",
      detalhes: { origem: "server_function" },
    });

    const rows = Object.entries(data.customValues)
      .filter(([, valor]) => valor !== undefined)
      .map(([field_id, valor]) => ({ mediun_id: savedId, field_id, valor: valor || null }));
    if (rows.length > 0) {
      const fieldIds = rows.map((row) => row.field_id);
      const { data: fields, error: fieldsError } = await supabaseAdmin
        .from("medium_custom_fields")
        .select("id, templo_id")
        .in("id", fieldIds);
      if (fieldsError) throw new Error(fieldsError.message);

      const allowedFieldIds = new Set(
        (fields ?? [])
          .filter((field) => field.templo_id === null || field.templo_id === data.temploId)
          .map((field) => field.id),
      );
      if (allowedFieldIds.size !== fieldIds.length) {
        throw new Error("Um ou mais campos personalizados não pertencem a este templo.");
      }

      const { error: valuesError } = await supabaseAdmin
        .from("medium_custom_values")
        .upsert(rows, { onConflict: "mediun_id,field_id" });
      if (valuesError) throw new Error(valuesError.message);
    }

    return { id: savedId };
  });