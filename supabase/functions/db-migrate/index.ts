// Temporary migration runner — deletes itself after use.
// deno-lint-ignore-file no-explicit-any
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

Deno.serve(async (req) => {
  const sql = await req.text();
  if (!sql.trim()) return new Response("empty sql", { status: 400 });


  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("SUPABASE_DB_URL missing", { status: 500 });

  const client = new Client(dbUrl);
  try {
    await client.connect();
    const result = await client.queryObject(sql);
    return new Response(JSON.stringify({ ok: true, rows: result.rows, rowCount: result.rowCount }), {
      headers: { "content-type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
