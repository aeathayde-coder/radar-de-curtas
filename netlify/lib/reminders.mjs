import { createHmac, timingSafeEqual } from "node:crypto";
import { daysBetween } from "./festivals.mjs";

// saved: [{ user_id, festival_id, profiles: { email, reminder_days, email_opt_in } }]
// festivals: lista pública; sent: Set de chaves "user|festival|deadline|days"
export function selectReminders({ saved, festivals, today, sent = new Set() }) {
  const byId = new Map(festivals.map((f) => [f.id, f]));
  const byUser = new Map();
  for (const row of saved) {
    const prof = row.profiles;
    if (!prof || !prof.email_opt_in || !prof.email) continue;
    // Quem já se inscreveu (ou já teve resultado) não precisa de lembrete de prazo
    if (row.status && row.status !== "quero") continue;
    const f = byId.get(row.festival_id);
    if (!f || !f.deadline) continue;
    const days = daysBetween(today, f.deadline);
    if (!(prof.reminder_days || []).includes(days)) continue;
    const key = `${row.user_id}|${f.id}|${f.deadline}|${days}`;
    if (sent.has(key)) continue;
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, { userId: row.user_id, email: prof.email, items: [] });
    byUser.get(row.user_id).items.push({ festival: f, days });
  }
  for (const u of byUser.values()) u.items.sort((a, b) => a.days - b.days);
  return [...byUser.values()];
}

export function unsubscribeToken(userId, secret) {
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}
export function verifyUnsubscribe(userId, token, secret) {
  if (!userId || !token || !secret) return false;
  const a = Buffer.from(unsubscribeToken(userId, secret));
  const b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
};
const when = (days) => (days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`);

export function buildEmail({ items, siteUrl, unsubscribeUrl }) {
  const first = items[0];
  const subject =
    items.length === 1
      ? `Prazo ${when(first.days)}: ${first.festival.name}`
      : `${items.length} prazos de festivais se aproximando`;

  const rows = items
    .map(({ festival: f, days }) => {
      const est = f.dateStatus === "Confirmada" ? "" : " · data estimada, confirme no regulamento";
      const link = f.url ? `<a href="${esc(f.url)}" style="color:#d9480f">página de inscrição</a>` : "";
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #d9dce2">
        <div style="font-family:Menlo,monospace;font-size:13px;color:#5b6270">${esc(fmtDate(f.deadline))} · ${when(days)}${est}</div>
        <div style="font-size:17px;font-weight:600;margin:3px 0">${esc(f.name)}</div>
        <div style="font-size:14px;color:#5b6270">${esc(f.local || f.country || "")}${f.fee ? ` · ${esc(f.fee)}` : ""}</div>
        <div style="font-size:14px;margin-top:4px">${link}</div>
      </td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#16191f">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9dce2;border-radius:8px;padding:8px 24px 20px">
    <tr><td style="padding-top:16px;font-family:Menlo,monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6270">Radar de Curtas · lembrete</td></tr>
    ${rows}
    <tr><td style="padding-top:16px;font-size:13px;color:#5b6270">
      <a href="${esc(siteUrl)}" style="color:#16191f">Abrir o Radar de Curtas</a> para ver todos os festivais salvos e ajustar os lembretes.<br><br>
      <a href="${esc(unsubscribeUrl)}" style="color:#5b6270">Parar de receber lembretes</a>
    </td></tr>
  </table></body></html>`;

  const text =
    items
      .map(({ festival: f, days }) => `${f.name}: prazo ${fmtDate(f.deadline)} (${when(days)})${f.dateStatus === "Confirmada" ? "" : ", data estimada"}${f.url ? `\n${f.url}` : ""}`)
      .join("\n\n") + `\n\n${siteUrl}\nParar de receber: ${unsubscribeUrl}`;

  return { subject, html, text };
}
