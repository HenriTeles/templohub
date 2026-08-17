import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMediunsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ temploId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { listMediuns } = await import("./mediuns-read.server");
    return { rows: await listMediuns(context.userId, data.temploId) };
  });

export const getMediumDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { readMediumDetail } = await import("./mediuns-read.server");
    return readMediumDetail(context.userId, data.id);
  });

export const deleteMediumRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { deleteMedium } = await import("./mediuns-read.server");
    return deleteMedium(context.userId, data.id);
  });

export const getBrandingUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readBrandingUrls } = await import("./mediuns-read.server");
    return readBrandingUrls(context.userId);
  });

export const getMediumEmissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { readEmissao, readMediumTemploId, assertTemploAccess } = await import("./mediuns-read.server");
    const temploId = await readMediumTemploId(data.id);
    await assertTemploAccess(context.userId, temploId);
    return readEmissao(data.id);
  });

export const prepareMediumEmissaoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      file: z.object({
        name: z.string().min(1).max(180),
        contentType: z.string().min(1).max(120),
        size: z.number().int().positive().max(8 * 1024 * 1024),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { prepareMediumEmissaoUpload: prepareUpload } = await import("./mediuns-read.server");
    return prepareUpload(context.userId, data.id, data.file);
  });

export const completeMediumEmissaoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      upload: z.object({
        path: z.string().min(1).max(500),
        name: z.string().min(1).max(180),
        contentType: z.string().min(1).max(120),
        size: z.number().int().positive().max(8 * 1024 * 1024),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { completeMediumEmissaoUpload: completeUpload } = await import("./mediuns-read.server");
    return completeUpload(context.userId, data.id, data.upload);
  });

export const removeMediumEmissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { deleteMediumEmissao } = await import("./mediuns-read.server");
    return deleteMediumEmissao(context.userId, data.id);
  });


export const getMediumEditData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ temploId: z.string().uuid(), id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { readMediumEditData } = await import("./mediuns-read.server");
    return readMediumEditData(context.userId, data.temploId, data.id);
  });
