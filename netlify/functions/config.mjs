// Entrega ao navegador só as chaves públicas do Supabase (a anon key é pública por desenho;
// a proteção dos dados vem das políticas RLS em supabase/schema.sql).
export default async () =>
  Response.json(
    {
      supabaseUrl: process.env.SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );

export const config = { path: "/api/config" };
