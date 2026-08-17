import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const target = z.enum(["app", "templo"]);

const fileMeta = z.object({
  name: z.string().min(1).max(180),
  contentType: z.string().min(1).max(160),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});

export const getLogoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ target }).parse(input))
  .handler(async ({ data, context }) => {
    const { readLogo } = await import("./branding-upload.server");
    return readLogo(context.userId, data.target);
  });

export const prepareLogoUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ target, file: fileMeta }).parse(input))
  .handler(async ({ data, context }) => {
    const { prepareLogoUpload } = await import("./branding-upload.server");
    return prepareLogoUpload(context.userId, data.target, data.file);
  });

export const completeLogoUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ target, upload: fileMeta.extend({ path: z.string().min(1).max(500) }) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { completeLogoUpload } = await import("./branding-upload.server");
    return completeLogoUpload(context.userId, data.target, data.upload);
  });

export const removeLogoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ target }).parse(input))
  .handler(async ({ data, context }) => {
    const { removeLogo } = await import("./branding-upload.server");
    return removeLogo(context.userId, data.target);
  });
