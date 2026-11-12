// Função agendada, todo dia às 8h30 (Brasília):
// 1. compara a base publicada com a foto do dia anterior e registra mudanças (data confirmada,
//    prazo alterado, festival novo);
// 2. às quartas-feiras (depois da atualização de terça), envia um e-mail por pessoa com as
//    mudanças nos festivais salvos e os festivais novos que combinam com as buscas salvas.
import { fetchFestivals, todayBRT } from "../lib/festivals.mjs";
import { detectChanges, selectDigest, buildDigest } from "../lib/novidades.mjs";
import { unsubscribeToken } from "../lib/reminders.mjs";
import { admin } from "../lib/supabase-admin.mjs";
import { memberRows, selectActivity } from "../lib/equipe.mjs";

const FROM = process.env.RESEND_FROM || "Radar de Festivais <onboarding@resend.dev>";

export default async () => {
  const db = admin();
  const today = todayBRT();
  const festivals = await fetchFestivals({ fresh: true });

  // 1. Mudanças
  let snap;
  try {
    snap = await db.selectAll("/festival_snapshots?select=festival_id,deadline,date_status");
  } catch (e) {
    console.log("[novidades] migração 3 ainda não rodada no Supabase; nada a fazer");
    return new Response("ok");
  }
  const prev = new Map(snap.map((r) => [r.festival_id, { deadline: r.deadline, date_status: r.date_status }]));
  const changes = detectChanges(prev, festivals, today);
  if (changes.length) await db.insert("festival_changes", changes);
  await db.upsert(
    "festival_snapshots",
    festivals.map((f) => ({ festival_id: f.id, deadline: f.deadline || null, date_status: f.dateStatus, seen_at: new Date().toISOString() })),
    "festival_id",
  );
  console.log(`[novidades] ${today}: ${changes.length} mudança(s) registrada(s)${prev.size ? "" : " (primeira foto da base)"}`);

  // 2. E-mail semanal, às quartas
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (weekday !== 3) return new Response("ok");
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!process.env.RESEND_API_KEY || !secret) throw new Error("Configure RESEND_API_KEY e UNSUBSCRIBE_SECRET.");

  const since = new Date(Date.now() - 8 * 86400000).toISOString();
  const [recent, saved, searches] = await Promise.all([
    db.selectAll(`/festival_changes?select=id,festival_id,kind,before,after&detected_at=gte.${since}&order=id`),
    db.selectAll("/saved_festivals?select=user_id,festival_id,profiles!inner(email,email_opt_in,change_alerts)&profiles.email_opt_in=eq.true"),
    db.selectAll("/saved_searches?select=user_id,label,params,profiles!inner(email,email_opt_in)&notify=eq.true&profiles.email_opt_in=eq.true"),
  ]);
  // Equipe: mudanças nos projetos de que a pessoa participa e resumo da atividade
  let actUsers = new Map();
  try {
    const [members, filmSaved, activity, films, actSent] = await Promise.all([
      db.selectAll("/film_members?select=film_id,user_id,role,changes,activity,profiles!inner(email,email_opt_in,change_alerts,full_name)&profiles.email_opt_in=eq.true"),
      db.selectAll("/saved_festivals?select=film_id,festival_id,status"),
      db.selectAll(`/film_activity?select=id,film_id,actor,kind,festival_id,detail&at=gte.${since}&order=id`),
      db.selectAll("/films?select=id,title"),
      db.selectAll(`/activity_sent?select=user_id,activity_id&sent_at=gte.${since}`),
    ]);
    saved.push(...memberRows({ saved: filmSaved, members, flag: "changes" }));
    const actors = [...new Set(activity.map((a) => a.actor).filter(Boolean))];
    const people = actors.length ? await db.selectAll(`/profiles?select=id,full_name,email&id=in.(${actors.join(",")})`) : [];
    actUsers = selectActivity({
      activity, members, festivals,
      names: new Map(people.map((p) => [p.id, p.full_name || p.email])),
      films: new Map(films.map((f) => [f.id, f.title])),
      sent: new Set(actSent.map((r) => `${r.user_id}|${r.activity_id}`)),
    });
  } catch (e) {
    console.log("[novidades] migração 5 ainda não rodada; sem avisos da equipe");
  }
  if (!recent.length && !actUsers.size) return new Response("ok");
  const sentRows = await db.selectAll(`/digest_sent?select=user_id,change_id&sent_at=gte.${since}`);
  const sent = new Set(sentRows.map((r) => `${r.user_id}|${r.change_id}`));
  const batches = selectDigest({ changes: recent, festivals, saved, searches, sent });
  for (const b of batches) { const a = actUsers.get(b.userId); if (a) { b.activity = a.activity; b.activityIds = a.activityIds; actUsers.delete(b.userId); } }
  for (const a of actUsers.values()) batches.push({ userId: a.userId, email: a.email, changes: [], searches: [], ids: [], activity: a.activity, activityIds: a.activityIds });
  const siteUrl = process.env.SITE_URL || process.env.URL || "";

  let delivered = 0;
  for (let i = 0; i < batches.length; i += 100) {
    const chunk = batches.slice(i, i + 100);
    const payload = chunk.map((u) => {
      const unsub = `${siteUrl}/api/unsubscribe?u=${u.userId}&t=${unsubscribeToken(u.userId, secret)}`;
      const { subject, html, text } = buildDigest({ changes: u.changes, searches: u.searches, activity: u.activity || [], siteUrl, unsubscribeUrl: unsub });
      return { from: FROM, to: [u.email], subject, html, text, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
    });
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { console.error(`[novidades] Resend ${res.status}: ${await res.text()}`); continue; }
    const dsent = chunk.flatMap((u) => u.ids.map((id) => ({ user_id: u.userId, change_id: id })));
    if (dsent.length) await db.insert("digest_sent", dsent, "user_id,change_id");
    const asent = chunk.flatMap((u) => (u.activityIds || []).map((id) => ({ user_id: u.userId, activity_id: id })));
    if (asent.length) await db.insert("activity_sent", asent, "user_id,activity_id");
    delivered += chunk.length;
  }
  console.log(`[novidades] ${today}: ${delivered} e-mail(s) de novidades enviados`);
  return new Response("ok");
};

// 11:30 UTC = 08:30 em Brasília (depois dos lembretes das 8h)
export const config = { schedule: "30 11 * * *" };
