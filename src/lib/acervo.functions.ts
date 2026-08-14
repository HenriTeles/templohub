import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const fileMeta = z.object({
  name: z.string().min(1).max(180),
  contentType: z.string().min(1).max(160),
  size: z.number().int().positive().max(20 * 1024 * 1024),
});

export const listAcervoFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listAcervo } = await import("./acervo.server");
    return { items: await listAcervo(context.userId) };
  });

export const prepareAcervoUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ file: fileMeta }).parse(input))
  .handler(async ({ data, context }) => {
    const { prepareAcervoUpload } = await import("./acervo.server");
    return prepareAcervoUpload(context.userId, data.file);
  });

export const completeAcervoUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ upload: fileMeta.extend({ path: z.string().min(1).max(500) }) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { completeAcervoUpload } = await import("./acervo.server");
    return completeAcervoUpload(context.userId, data.upload);
  });

export const renameAcervoFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), nome: z.string().min(1).max(180) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { renameAcervoItem } = await import("./acervo.server");
    return renameAcervoItem(context.userId, data.id, data.nome);
  });

export const deleteAcervoFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { deleteAcervoItem } = await import("./acervo.server");
    return deleteAcervoItem(context.userId, data.id);
  });
