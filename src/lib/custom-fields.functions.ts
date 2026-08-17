import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeSchema = z.object({
  scope: z.enum(["global", "templo"]),
  temploId: z.string().uuid().nullable().optional(),
});

const fieldInput = z.object({
  label: z.string().min(1).max(120),
  chave: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/),
  tipo: z.enum(["text", "number", "date", "textarea", "boolean", "select"]),
  obrigatorio: z.boolean(),
  opcoes: z.array(z.string().max(120)).max(100).nullable(),
  parentFieldId: z.string().uuid().nullable(),
});

export const listCustomFieldsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { listCustomFields } = await import("./custom-fields.server");
    return { fields: await listCustomFields(context.userId, data.scope, data.temploId ?? null) };
  });

export const createCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.extend({ field: fieldInput }).parse(input))
  .handler(async ({ data, context }) => {
    const { createCustomField } = await import("./custom-fields.server");
    return createCustomField(context.userId, data.scope, data.temploId ?? null, data.field);
  });

export const updateCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), field: fieldInput }).parse(input))
  .handler(async ({ data, context }) => {
    const { updateCustomField } = await import("./custom-fields.server");
    return updateCustomField(context.userId, data.id, data.field);
  });

export const deleteCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { deleteCustomField } = await import("./custom-fields.server");
    return deleteCustomField(context.userId, data.id);
  });
