// Temporary schema-migrator edge function. Delete after schema is applied.
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const SQL = `
-- ============================================================
-- TemploHub — Initial schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------- ENUMS ---------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'secretario', 'consulta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.templo_status AS ENUM ('pendente', 'ativo', 'suspenso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mediun_situacao AS ENUM ('ativo','em_desenvolvimento','licenciado','afastado','desligado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mediun_sexo AS ENUM ('masculino','feminino');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mediun_funcao AS ENUM ('mestre','ninfa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mediun_polaridade AS ENUM ('apara','doutrinador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mentor_tipo AS ENUM (
    'cavaleiro','ministro','preto_velho','caboclo','medico_cura','guia_missionaria',
    'princesa','preta_velha','cabocla','medica_cura'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------- TABLES ---------

CREATE TABLE IF NOT EXISTS public.templos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text,
  estado text,
  status public.templo_status NOT NULL DEFAULT 'pendente',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  templo_id uuid REFERENCES public.templos(id) ON DELETE SET NULL,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, templo_id)
);

-- Configurable lookup tables (templo_id nullable = global template)
CREATE TABLE IF NOT EXISTS public.falanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.centurias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.mentores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo public.mentor_tipo NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (templo_id, tipo, nome)
);

CREATE TABLE IF NOT EXISTS public.adjuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.trinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.povos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.legioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  UNIQUE (templo_id, nome)
);

CREATE TABLE IF NOT EXISTS public.reinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid REFERENCES public.templos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  UNIQUE (templo_id, nome)
);

-- MEDIUNS (main table)
CREATE TABLE IF NOT EXISTS public.mediuns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid NOT NULL REFERENCES public.templos(id) ON DELETE CASCADE,

  -- Dados Pessoais
  foto_path text,
  nome_completo text NOT NULL,
  nome_emissao text,
  nome_pai text,
  nome_mae text,
  sexo public.mediun_sexo,
  cpf text,
  rg text,
  data_nascimento date,
  estado_civil text,
  nacionalidade text,
  profissao text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  cidade text,
  estado text,
  cep text,

  -- Dados Doutrinários
  numero_ficha text,
  data_ingresso date,
  situacao public.mediun_situacao NOT NULL DEFAULT 'em_desenvolvimento',

  -- Desenvolvimento
  data_inicio_desenvolvimento date,
  data_emplacamento date,
  data_elevacao_espadas date,
  data_centuria date,
  data_consagracao date,

  -- Particularidades
  funcao public.mediun_funcao,
  polaridade public.mediun_polaridade,
  adjuracao_id uuid REFERENCES public.adjuracoes(id) ON DELETE SET NULL,
  trino_id uuid REFERENCES public.trinos(id) ON DELETE SET NULL,
  centuria_id uuid REFERENCES public.centurias(id) ON DELETE SET NULL,
  falange_id uuid REFERENCES public.falanges(id) ON DELETE SET NULL,
  falange_missionaria_id uuid REFERENCES public.falanges(id) ON DELETE SET NULL,
  povo_id uuid REFERENCES public.povos(id) ON DELETE SET NULL,
  legiao_id uuid REFERENCES public.legioes(id) ON DELETE SET NULL,
  reino_id uuid REFERENCES public.reinos(id) ON DELETE SET NULL,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mediuns_templo_nome ON public.mediuns (templo_id, nome_completo);
CREATE INDEX IF NOT EXISTS idx_mediuns_templo_cpf ON public.mediuns (templo_id, cpf);
CREATE INDEX IF NOT EXISTS idx_mediuns_templo_situacao ON public.mediuns (templo_id, situacao);
CREATE INDEX IF NOT EXISTS idx_mediuns_templo_funcao ON public.mediuns (templo_id, funcao);
CREATE INDEX IF NOT EXISTS idx_mediuns_data_nasc ON public.mediuns (templo_id, data_nascimento);

-- Junction: mediun <-> mentores
CREATE TABLE IF NOT EXISTS public.mediun_mentores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid NOT NULL REFERENCES public.templos(id) ON DELETE CASCADE,
  mediun_id uuid NOT NULL REFERENCES public.mediuns(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES public.mentores(id) ON DELETE CASCADE,
  tipo public.mentor_tipo NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mediun_id, tipo)
);

-- Placeholders for future
CREATE TABLE IF NOT EXISTS public.historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid NOT NULL REFERENCES public.templos(id) ON DELETE CASCADE,
  mediun_id uuid REFERENCES public.mediuns(id) ON DELETE CASCADE,
  user_id uuid,
  acao text NOT NULL,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historico_mediun ON public.historico (mediun_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  templo_id uuid NOT NULL REFERENCES public.templos(id) ON DELETE CASCADE,
  mediun_id uuid REFERENCES public.mediuns(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes (
  templo_id uuid PRIMARY KEY REFERENCES public.templos(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------- SECURITY DEFINER FUNCTIONS ---------

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.user_templo(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT templo_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_write_templo(_user_id uuid, _templo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN ('admin','secretario')
        AND (ur.templo_id = _templo_id OR ur.templo_id IS NULL)
    );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['templos','profiles','mediuns','configuracoes']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- Onboarding: create templo (pending) + admin role
CREATE OR REPLACE FUNCTION public.create_templo_request(_nome text, _cidade text, _estado text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _templo_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF (SELECT templo_id FROM public.profiles WHERE id = _uid) IS NOT NULL THEN
    RAISE EXCEPTION 'user already belongs to a templo';
  END IF;

  INSERT INTO public.templos (nome, cidade, estado, status, created_by)
  VALUES (_nome, _cidade, _estado, 'pendente', _uid)
  RETURNING id INTO _templo_id;

  UPDATE public.profiles SET templo_id = _templo_id WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, templo_id)
  VALUES (_uid, 'admin', _templo_id)
  ON CONFLICT DO NOTHING;

  RETURN _templo_id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_templo(_templo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.templos SET status = 'ativo' WHERE id = _templo_id;
  -- copy global seeds
  INSERT INTO public.falanges (templo_id, nome, categoria)
    SELECT _templo_id, nome, categoria FROM public.falanges WHERE templo_id IS NULL
    ON CONFLICT DO NOTHING;
  INSERT INTO public.mentores (templo_id, nome, tipo)
    SELECT _templo_id, nome, tipo FROM public.mentores WHERE templo_id IS NULL
    ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_templo(_templo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.templos SET status = 'suspenso' WHERE id = _templo_id;
END; $$;

-- Promote by email (used to bootstrap the first super_admin)
CREATE OR REPLACE FUNCTION public.promote_super_admin_by_email(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'user not found: %', _email; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
  ON CONFLICT DO NOTHING;
END; $$;

-- --------- GRANTS ---------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.falanges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centurias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adjuracoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trinos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.povos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legioes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reinos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mediuns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mediun_mentores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anexos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- --------- RLS ---------
ALTER TABLE public.templos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.falanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centurias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.povos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediun_mentores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- templos: own templo or super_admin
DROP POLICY IF EXISTS "templos_select" ON public.templos;
CREATE POLICY "templos_select" ON public.templos FOR SELECT TO authenticated
  USING (id = public.user_templo(auth.uid()) OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "templos_insert" ON public.templos;
CREATE POLICY "templos_insert" ON public.templos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "templos_update" ON public.templos;
CREATE POLICY "templos_update" ON public.templos FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (id = public.user_templo(auth.uid()) AND public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (id = public.user_templo(auth.uid()) AND public.has_role(auth.uid(),'admin')));

-- profiles: user sees own; super_admin sees all; templo admin sees users of same templo
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()) OR templo_id = public.user_templo(auth.uid()));
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));

-- user_roles: user sees own; super_admin sees all
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR templo_id = public.user_templo(auth.uid()));

-- helper macro applied to templo-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['falanges','centurias','mentores','adjuracoes','trinos','povos','legioes','reinos','mediuns','mediun_mentores','historico','anexos','configuracoes']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated
      USING (templo_id = public.user_templo(auth.uid()) OR public.is_super_admin(auth.uid()) OR templo_id IS NULL)$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.can_write_templo(auth.uid(), templo_id))$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated
      USING (public.can_write_templo(auth.uid(), templo_id))
      WITH CHECK (public.can_write_templo(auth.uid(), templo_id))$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated
      USING (public.can_write_templo(auth.uid(), templo_id))$p$, t, t);
  END LOOP;
END $$;

-- --------- SEED GLOBAL FALANGES (Ninfas) ---------
INSERT INTO public.falanges (templo_id, nome, categoria) VALUES
  (NULL, 'Muruaicy', 'ninfa'),
  (NULL, 'Ypuena', 'ninfa'),
  (NULL, 'Mayante', 'ninfa'),
  (NULL, 'Aganaras', 'ninfa'),
  (NULL, 'Samaras', 'ninfa'),
  (NULL, 'Cayçaras', 'ninfa'),
  (NULL, 'Iratares', 'ninfa'),
  (NULL, 'Iraés', 'ninfa'),
  (NULL, 'Niatas', 'ninfa'),
  (NULL, 'Jaçanãs', 'ninfa'),
  (NULL, 'Nityamas', 'ninfa'),
  (NULL, 'Franciscanas', 'ninfa'),
  (NULL, 'Yasnaia', 'ninfa'),
  (NULL, 'Mestres', 'mestre'),
  (NULL, 'Magos', 'mestre'),
  (NULL, 'Príncipes', 'mestre')
ON CONFLICT DO NOTHING;

-- --------- STORAGE BUCKETS ---------
INSERT INTO storage.buckets (id, name, public)
VALUES ('mediuns-fotos','mediuns-fotos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('mediuns-docs','mediuns-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "fotos_read" ON storage.objects;
CREATE POLICY "fotos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'mediuns-fotos');
DROP POLICY IF EXISTS "fotos_write" ON storage.objects;
CREATE POLICY "fotos_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mediuns-fotos');
DROP POLICY IF EXISTS "fotos_update" ON storage.objects;
CREATE POLICY "fotos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mediuns-fotos');
DROP POLICY IF EXISTS "fotos_delete" ON storage.objects;
CREATE POLICY "fotos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mediuns-fotos');

DROP POLICY IF EXISTS "docs_all" ON storage.objects;
CREATE POLICY "docs_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'mediuns-docs')
  WITH CHECK (bucket_id = 'mediuns-docs');
`;


Deno.serve(async (_req) => {


  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("SUPABASE_DB_URL missing", { status: 500 });

  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), stack: (e as Error).stack }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
