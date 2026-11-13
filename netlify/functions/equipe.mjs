// /api/equipe: a dona do projeto convida alguém (ou reenvia o convite) e o Radar manda o e-mail.
// Corpo: { action: "invite", film_id, email, role } ou { action: "resend", invite_id }
// Cabeçalho: Authorization: Bearer <token da sessão do Supabase>
import { admin } from "../lib/supabase-admin.mjs";
import { buildInviteEmail, normEmail, validEmail } from "../lib/equipe.mjs";

const FROM = process.env.RESEND_FROM || "Radar de Festivais <onboarding@resend.dev>";
const MAX_PER_FILM = 20;
const json = (body, status = 200) => Response.json(body, { status });
const UUID = /^[0-9a-f-]{36}$/i;

async function whoIs(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? u : null;
}

// O link do convite aponta para o mesmo endereço de onde o convite foi feito (site ou prévia)
function siteOf(req) {
  const origin = new URL(req.url).origin;
  const ok = /^https:\/\/(www\.)?radardefestivais\.com\.br$/.test(origin) || /^https:\/\/[a-z0-9-]+--lovely-bubblegum-406f05\.netlify\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return ok ? origin : (process.env.SITE_URL || process.env.URL || origin);
}

async function send(db, req, { invite, film, inviter }) {
  const link = `${siteOf(req)}/?convite=${invite.id}`;
  const { subject, html, text } = buildInviteEmail({ inviter, film: film.title, role: invite.role, email: invite.email, link });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [invite.email], subject, html, text }),
  });
  if (!res.ok) { console.error(`[equipe] Resend ${res.status}: ${await res.text()}`); return false; }
  await db.patch(`/film_invites?id=eq.${invite.id}`, { sent_at: new Date().toISOString() });
  return true;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!process.env.RESEND_API_KEY) return json({ error: "E-mail indisponível no momento." }, 503);
  const user = await whoIs(req);
  if (!user) return json({ error: "Entre com Google para convidar." }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const db = admin();

  let invite, film;
  if (body.action === "resend") {
    if (!UUID.test(body.invite_id || "")) return json({ error: "Convite inválido." }, 400);
    [invite] = await db.selectAll(`/film_invites?select=id,film_id,email,role,sent_at&id=eq.${body.invite_id}`);
    if (!invite) return json({ error: "Convite não encontrado." }, 404);
    [film] = await db.selectAll(`/films?select=id,title,user_id,general&id=eq.${invite.film_id}`);
    if (!film || film.user_id !== user.id) return json({ error: "Só a criadora do projeto reenvia convites." }, 403);
    if (invite.sent_at && Date.now() - new Date(invite.sent_at).getTime() < 60000) return json({ error: "Convite enviado há menos de um minuto. Aguarde um pouco." }, 429);
  } else if (body.action === "invite") {
    const email = normEmail(body.email);
    const role = body.role === "leitor" ? "leitor" : "editor";
    if (!UUID.test(body.film_id || "")) return json({ error: "Projeto inválido." }, 400);
    if (!validEmail(email)) return json({ error: "Digite um e-mail válido." }, 400);
    [film] = await db.selectAll(`/films?select=id,title,user_id,general&id=eq.${body.film_id}`);
    if (!film || film.user_id !== user.id) return json({ error: "Só a criadora do projeto convida pessoas." }, 403);
    if (film.general) return json({ error: "A lista Para acompanhar é pessoal. Convide a equipe em um projeto." }, 400);
    if (email === normEmail(user.email)) return json({ error: "Esse é o seu próprio e-mail." }, 400);
    const [members, invites] = await Promise.all([
      db.selectAll(`/film_members?select=user_id,profiles!inner(email)&film_id=eq.${film.id}`),
      db.selectAll(`/film_invites?select=id,email&film_id=eq.${film.id}`),
    ]);
    if (members.some((m) => normEmail(m.profiles?.email) === email)) return json({ error: "Essa pessoa já faz parte da equipe." }, 409);
    if (members.length + invites.length >= MAX_PER_FILM) return json({ error: `Cada projeto aceita até ${MAX_PER_FILM} pessoas.` }, 400);
    // A criadora entra na equipe como "dono" (guarda as preferências dela de resumo da atividade)
    await db.insert("film_members", [{ film_id: film.id, user_id: user.id, role: "dono" }], "film_id,user_id");
    await db.upsert("film_invites", [{ film_id: film.id, email, role, invited_by: user.id }], "film_id,email");
    [invite] = await db.selectAll(`/film_invites?select=id,film_id,email,role,sent_at&film_id=eq.${film.id}&email=eq.${encodeURIComponent(email)}`);
  } else {
    return json({ error: "Ação desconhecida." }, 400);
  }

  const meta = user.user_metadata || {};
  const inviter = meta.full_name || meta.name || user.email;
  const ok = await send(db, req, { invite, film, inviter });
  if (!ok) return json({ error: "O convite foi registrado, mas o e-mail não saiu. Tente reenviar.", invite_id: invite.id }, 502);
  return json({ ok: true, invite: { id: invite.id, email: invite.email, role: invite.role } });
};

export const config = { path: "/api/equipe" };
