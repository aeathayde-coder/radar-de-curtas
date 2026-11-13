// Agenda assinável: /agenda/<código>.ics devolve os prazos dos festivais salvos da pessoa.
// O código fica no perfil (profiles.calendar_token) e é criado no site, em Meus salvos.
import { fetchFestivals, todayBRT } from "../lib/festivals.mjs";
import { buildCalendar } from "../lib/agenda.mjs";
import { admin } from "../lib/supabase-admin.mjs";

export default async (req) => {
  const token = (new URL(req.url).pathname.split("/").pop() || "").replace(/\.ics$/i, "").toLowerCase();
  if (!/^[a-z0-9]{20,64}$/.test(token)) return new Response("Não encontrado", { status: 404 });
  // ?filme=<id>: só os festivais de um filme (planejamento por filme)
  const film = (new URL(req.url).searchParams.get("filme") || "").toLowerCase();
  if (film && !/^[0-9a-f-]{36}$/.test(film)) return new Response("Não encontrado", { status: 404 });
  const db = admin();
  const prof = await db.selectAll(`/profiles?select=id&calendar_token=eq.${token}`);
  if (!prof.length) return new Response("Não encontrado", { status: 404 });
  const [festivals, saved] = await Promise.all([
    fetchFestivals(),
    db.selectAll(`/saved_festivals?select=festival_id&user_id=eq.${prof[0].id}${film ? `&film_id=eq.${film}` : ""}`),
  ]);
  const ids = new Set(saved.map((r) => r.festival_id));
  const siteUrl = process.env.SITE_URL || process.env.URL || "";
  const body = buildCalendar(festivals.filter((f) => ids.has(f.id)), { siteUrl, today: todayBRT() });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="radar-de-festivais.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
};

export const config = { path: "/agenda/*" };
