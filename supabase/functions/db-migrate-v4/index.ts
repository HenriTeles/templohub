// Temporary schema migration for branding, temple logo and custom medium fields.
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const SQL = `
-- ============================================================
-- 1) App settings (super admin branding)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  logo_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS app_settings_update ON public.app_settings;
CREATE POLICY app_settings_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS app_settings_insert ON public.app_settings;
CREATE POLICY app_settings_insert ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- 2) Templos: logo column
-- ============================================================
ALTER TABLE public.templos ADD COLUMN IF NOT EXISTS logo_path text;

-- ============================================================
-- 3) Mediuns: personal-info columns
-- ============================================================
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS tipo_sanguineo text;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS medicamentos text;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS posologia text;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS medicamento_controlado boolean;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS medico_prescritor text;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS medico_crm text;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS possui_doenca boolean;
ALTER TABLE public.mediuns ADD COLUMN IF NOT EXISTS doenca_descricao text;

-- ============================================================
-- 4) Custom fields for medium fichas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medium_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  parent_field_id uuid REFERENCES public.medium_custom_fields(id) ON DELETE CASCADE,
  label text NOT NULL,
  chave text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  opcoes jsonb,
  ordem int NOT NULL DEFAULT 0,
  obrigatorio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medium_custom_fields_tipo_check CHECK (tipo IN ('text','number','date','textarea','boolean','select'))
);

CREATE UNIQUE INDEX IF NOT EXISTS medium_custom_fields_uq
  ON public.medium_custom_fields (
    COALESCE(templo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(parent_field_id, '00000000-0000-0000-0000-000000000000'::uuid),
    chave
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medium_custom_fields TO authenticated;
GRANT ALL ON public.medium_custom_fields TO service_role;

ALTER TABLE public.medium_custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcf_select ON public.medium_custom_fields;
CREATE POLICY mcf_select ON public.medium_custom_fields
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR templo_id IS NULL
    OR templo_id = public.user_templo(auth.uid())
  );

DROP POLICY IF EXISTS mcf_insert ON public.medium_custom_fields;
CREATE POLICY mcf_insert ON public.medium_custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_super_admin(auth.uid()))
    OR (
      templo_id IS NOT NULL
      AND templo_id = public.user_templo(auth.uid())
      AND public.can_write_templo(auth.uid(), templo_id)
    )
  );

DROP POLICY IF EXISTS mcf_update ON public.medium_custom_fields;
CREATE POLICY mcf_update ON public.medium_custom_fields
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (templo_id IS NOT NULL AND public.can_write_templo(auth.uid(), templo_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (templo_id IS NOT NULL AND public.can_write_templo(auth.uid(), templo_id))
  );

DROP POLICY IF EXISTS mcf_delete ON public.medium_custom_fields;
CREATE POLICY mcf_delete ON public.medium_custom_fields
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (templo_id IS NOT NULL AND public.can_write_templo(auth.uid(), templo_id))
  );

DROP TRIGGER IF EXISTS mcf_touch ON public.medium_custom_fields;
CREATE TRIGGER mcf_touch BEFORE UPDATE ON public.medium_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5) Values for custom fields
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medium_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mediun_id uuid NOT NULL REFERENCES public.mediuns(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.medium_custom_fields(id) ON DELETE CASCADE,
  valor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mediun_id, field_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medium_custom_values TO authenticated;
GRANT ALL ON public.medium_custom_values TO service_role;

ALTER TABLE public.medium_custom_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcv_select ON public.medium_custom_values;
CREATE POLICY mcv_select ON public.medium_custom_values
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mediuns m
      WHERE m.id = medium_custom_values.mediun_id
        AND m.templo_id = public.user_templo(auth.uid())
    )
  );

DROP POLICY IF EXISTS mcv_write ON public.medium_custom_values;
CREATE POLICY mcv_write ON public.medium_custom_values
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mediuns m
      WHERE m.id = medium_custom_values.mediun_id
        AND public.can_write_templo(auth.uid(), m.templo_id)
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mediuns m
      WHERE m.id = medium_custom_values.mediun_id
        AND public.can_write_templo(auth.uid(), m.templo_id)
    )
  );

DROP TRIGGER IF EXISTS mcv_touch ON public.medium_custom_values;
CREATE TRIGGER mcv_touch BEFORE UPDATE ON public.medium_custom_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6) Storage policies for app-branding (super admin only)
-- ============================================================
DROP POLICY IF EXISTS branding_select ON storage.objects;
CREATE POLICY branding_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-branding');

DROP POLICY IF EXISTS branding_write ON storage.objects;
CREATE POLICY branding_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'app-branding' AND public.is_super_admin(auth.uid()))
  WITH CHECK (bucket_id = 'app-branding' AND public.is_super_admin(auth.uid()));

-- ============================================================
-- 7) Storage policies for templos-logos (templo admin/secretario)
-- ============================================================
DROP POLICY IF EXISTS templos_logos_select ON storage.objects;
CREATE POLICY templos_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'templos-logos'
    AND (
      public.is_super_admin(auth.uid())
      OR public.user_templo(auth.uid())::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS templos_logos_insert ON storage.objects;
CREATE POLICY templos_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'templos-logos'
    AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS templos_logos_update ON storage.objects;
CREATE POLICY templos_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'templos-logos'
    AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'templos-logos'
    AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS templos_logos_delete ON storage.objects;
CREATE POLICY templos_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'templos-logos'
    AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
`;

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response(JSON.stringify({ ok: false, error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), { status: 500 });
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
