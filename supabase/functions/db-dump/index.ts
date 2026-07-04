import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const url = Deno.env.get("SUPABASE_DB_URL")!;
const sql = postgres(url, { prepare: false, max: 1 });

const TABLES = [
  "profiles","user_roles","templos","app_settings","configuracoes",
  "adjuracoes","centurias","falanges","legioes","povos","reinos","trinos",
  "mentores","mediuns","mediun_mentores","anexos","historico",
  "medium_custom_fields","medium_custom_values",
];

async function dump() {
  const out: string[] = [];
  out.push("-- =========================================================");
  out.push("-- TemploHub — Full schema + data dump");
  out.push(`-- Generated ${new Date().toISOString()}`);
  out.push("-- =========================================================\n");

  // Enums
  const enums = await sql`
    select t.typname, e.enumlabel, e.enumsortorder
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder`;
  const enumMap = new Map<string, string[]>();
  for (const r of enums) {
    if (!enumMap.has(r.typname)) enumMap.set(r.typname, []);
    enumMap.get(r.typname)!.push(r.enumlabel);
  }
  out.push("-- === ENUM TYPES ===");
  for (const [name, labels] of enumMap) {
    out.push(`DO $$ BEGIN CREATE TYPE public.${name} AS ENUM (${labels.map(l=>`'${l}'`).join(",")}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
  out.push("");

  // Tables via information_schema, then constraints
  out.push("-- === TABLES ===");
  for (const t of TABLES) {
    const cols = await sql`
      select column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
      from information_schema.columns
      where table_schema='public' and table_name=${t}
      order by ordinal_position`;
    if (!cols.length) { out.push(`-- (table ${t} not found)`); continue; }
    const lines: string[] = [];
    for (const c of cols) {
      let type = c.data_type;
      if (type === "USER-DEFINED") type = `public.${c.udt_name}`;
      else if (type === "ARRAY") type = `${c.udt_name.replace(/^_/, "")}[]`;
      else if (type === "character varying") type = c.character_maximum_length ? `varchar(${c.character_maximum_length})` : "text";
      else if (type === "timestamp with time zone") type = "timestamptz";
      else if (type === "timestamp without time zone") type = "timestamp";
      let line = `  ${c.column_name} ${type}`;
      if (c.column_default) line += ` DEFAULT ${c.column_default}`;
      if (c.is_nullable === "NO") line += " NOT NULL";
      lines.push(line);
    }
    out.push(`CREATE TABLE IF NOT EXISTS public.${t} (\n${lines.join(",\n")}\n);`);
  }
  out.push("");

  // PK/UNIQUE/CHECK/FK constraints
  const cons = await sql`
    select conname, contype, pg_get_constraintdef(c.oid) as def, rel.relname as tbl
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname='public' and rel.relname = ANY(${TABLES})
    order by rel.relname, contype`;
  out.push("-- === CONSTRAINTS ===");
  for (const c of cons) {
    out.push(`ALTER TABLE public.${c.tbl} ADD CONSTRAINT ${c.conname} ${c.def};`);
  }
  out.push("");

  // Indexes (non pk/unique from constraints)
  const idx = await sql`
    select indexname, tablename, indexdef
    from pg_indexes
    where schemaname='public' and tablename = ANY(${TABLES})
      and indexname not in (select conname from pg_constraint where connamespace='public'::regnamespace)`;
  out.push("-- === INDEXES ===");
  for (const i of idx) out.push(`${i.indexdef};`);
  out.push("");

  // Functions
  const fns = await sql`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'`;
  out.push("-- === FUNCTIONS ===");
  for (const f of fns) out.push(`${f.def};\n`);

  // Triggers
  const trigs = await sql`
    select tgname, pg_get_triggerdef(t.oid) as def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and not t.tgisinternal`;
  out.push("-- === TRIGGERS ===");
  for (const t of trigs) out.push(`${t.def};`);
  out.push("");

  // RLS + Policies
  out.push("-- === RLS & POLICIES ===");
  for (const t of TABLES) {
    out.push(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
  }
  const pols = await sql`
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='public'`;
  for (const p of pols) {
    const roles = (p.roles as string[]).join(",");
    let s = `CREATE POLICY "${p.policyname}" ON public.${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${roles}`;
    if (p.qual) s += ` USING (${p.qual})`;
    if (p.with_check) s += ` WITH CHECK (${p.with_check})`;
    out.push(s + ";");
  }
  out.push("");

  // Grants (default sensible set)
  out.push("-- === GRANTS ===");
  for (const t of TABLES) {
    out.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO authenticated;`);
    out.push(`GRANT ALL ON public.${t} TO service_role;`);
  }
  out.push("");

  // Data
  out.push("-- === DATA ===");
  for (const t of TABLES) {
    const rows = await sql.unsafe(`select * from public.${t}`);
    if (!rows.length) { out.push(`-- ${t}: 0 rows`); continue; }
    const cols = Object.keys(rows[0]);
    out.push(`-- ${t}: ${rows.length} rows`);
    for (const r of rows) {
      const vals = cols.map(c => {
        const v = r[c];
        if (v === null) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "true" : "false";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (Array.isArray(v)) return `ARRAY[${v.map(x=>`'${String(x).replace(/'/g,"''")}'`).join(",")}]`;
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g,"''")}'::jsonb`;
        return `'${String(v).replace(/'/g,"''")}'`;
      });
      out.push(`INSERT INTO public.${t} (${cols.join(",")}) VALUES (${vals.join(",")}) ON CONFLICT DO NOTHING;`);
    }
  }

  // Storage buckets info
  const buckets = await sql`select id, name, public, file_size_limit, allowed_mime_types from storage.buckets`;
  out.push("\n-- === STORAGE BUCKETS ===");
  for (const b of buckets) {
    out.push(`-- bucket: ${b.name} (public=${b.public})`);
    out.push(`INSERT INTO storage.buckets (id, name, public) VALUES ('${b.id}','${b.name}',${b.public}) ON CONFLICT (id) DO NOTHING;`);
  }

  return out.join("\n");
}

Deno.serve(async () => {
  try {
    const body = await dump();
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response("ERROR: " + (e as Error).message + "\n" + (e as Error).stack, { status: 500 });
  }
});
