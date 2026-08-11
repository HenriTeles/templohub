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

    // ---- Emissão (PDF/JPG) armazenada no bucket privado "mediuns-docs" ----
    if (data.removerEmissao || data.emissao) {
      const { data: antigos } = await supabaseAdmin
        .from("anexos")
        .select("id, storage_path")
        .eq("mediun_id", savedId)
        .like("storage_path", "%/emissoes/%");
      const rowsAntigos = (antigos ?? []) as Array<{ id: string; storage_path: string }>;
      if (rowsAntigos.length > 0) {
        await supabaseAdmin.storage.from("mediuns-docs").remove(rowsAntigos.map((r) => r.storage_path));
        await supabaseAdmin
          .from("anexos")
          .delete()
          .in("id", rowsAntigos.map((r) => r.id));
      }
    }

    if (data.emissao) {
      const tipo = (data.emissao.contentType || "").toLowerCase();
      const nomeLower = data.emissao.name.toLowerCase();
      const tipoOk =
        tipo === "application/pdf" ||
        tipo === "image/jpeg" ||
        tipo === "image/jpg" ||
        /\.(pdf|jpe?g)$/.test(nomeLower);
      if (!tipoOk) throw new Error("A emissão deve ser um arquivo PDF, JPG ou JPEG.");

      const estimatedBytes = Math.floor((data.emissao.base64.length * 3) / 4);
      if (estimatedBytes > 8 * 1024 * 1024) throw new Error("A emissão deve ter no máximo 8 MB.");

      const binary = atob(data.emissao.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const safeName = data.emissao.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 140) || "emissao.pdf";
      const storagePath = `${data.temploId}/emissoes/${savedId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("mediuns-docs")
        .upload(storagePath, bytes, {
          contentType: tipo || "application/octet-stream",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { error: anexoError } = await supabaseAdmin.from("anexos").insert({
        templo_id: data.temploId,
        mediun_id: savedId,
        nome: data.emissao.name.slice(0, 180),
        storage_path: storagePath,
        mime_type: tipo || null,
        size_bytes: estimatedBytes,
        created_by: context.userId,
      });
      if (anexoError) throw new Error(anexoError.message);
    }



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