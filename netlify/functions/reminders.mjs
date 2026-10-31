// Função agendada: todo dia às 8h (Brasília) envia um e-mail por pessoa com os prazos
// dos festivais salvos que caem nos dias escolhidos no perfil (30, 14, 7, 3 ou 1 dia antes).
import { fetchFestivals, todayBRT } from "../lib/festivals.mjs";
import { selectReminders, buildEmail, unsubscribeToken } from "../lib/reminders.mjs";
import { admin } from "../lib/supabase-admin.mjs";

const FROM = process.env.RESEND_FROM || "Radar de Festivais <onboarding@resend.dev>";

export default async () => {
  const db = admin();
  const today = todayBRT();
  const siteUrl = process.env.SITE_URL || process.env.URL || "";
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!process.env.RESEND_API_KEY || !secret) throw new Error("Configure RESEND_API_KEY e UNSUBSCRIBE_SECRET.");

  const [festivals, saved] = await Promise.all([
    fetchFestivals({ fresh: true }),
    db.selectAll(
      "/saved_festivals?select=user_id,festival_id,status,profiles!inner(email,reminder_days,email_opt_in)&profiles.email_opt_in=eq.true",
    ),
  ]);

  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const sentRows = await db.selectAll(`/reminders_sent?select=user_id,festival_id,deadline,days_before&sent_at=gte.${since}`);
  const sent = new Set(sentRows.map((r) => `${r.user_id}|${r.festival_id}|${r.deadline}|${r.days_before}`));

  const batches = selectReminders({ saved, festivals, today, sent });
  if (!batches.length) {
    console.log(`[reminders] ${today}: nada a enviar`);
    return new Response("ok");
  }

  let delivered = 0;
  for (let i = 0; i < batches.length; i += 100) {
    const chunk = batches.slice(i, i + 100);
    const payload = chunk.map((u) => {
      const unsub = `${siteUrl}/api/unsubscribe?u=${u.userId}&t=${unsubscribeToken(u.userId, secret)}`;
      const { subject, html, text } = buildEmail({ items: u.items, siteUrl, unsubscribeUrl: unsub });
      return {
        from: FROM,
        to: [u.email],
        subject,
        html,
        text,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[reminders] Resend ${res.status}: ${await res.text()}`);
      continue; // não registra como enviado; a próxima execução no mesmo dia tenta de novo
    }
    await db.insert(
      "reminders_sent",
      chunk.flatMap((u) =>
        u.items.map(({ festival, days }) => ({
          user_id: u.userId,
          festival_id: festival.id,
          deadline: festival.deadline,
          days_before: days,
        })),
      ),
      "user_id,festival_id,deadline,days_before",
    );
    delivered += chunk.length;
  }

  console.log(`[reminders] ${today}: ${delivered} e-mail(s) enviados`);
  return new Response("ok");
};

// 11:00 UTC = 08:00 em Brasília
export const config = { schedule: "0 11 * * *" };
