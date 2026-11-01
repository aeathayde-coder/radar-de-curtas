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

  const INK = "#0e0e0e", MUTED = "#62625f", LINE = "#d8d8d4", NEON = "#c6ff3d", PAPER = "#fcfcfb";
  const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
  const SANS = "Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  const MONO = "'Geist Mono',Menlo,Consolas,monospace";

  const rows = items
    .map(({ festival: f, days }) => {
      const confirmed = f.dateStatus === "Confirmada";
      const tag = days <= 7 && confirmed
        ? `<span style="background:${NEON};color:${INK};font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px">prazo acabando</span>`
        : confirmed
          ? `<span style="border:1px solid ${INK};font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px">confirmado</span>`
          : `<span style="border:1px dotted ${MUTED};color:${MUTED};font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px">previsto</span>`;
      const big = days === 0 ? "Hoje" : `${confirmed ? "" : "~"}${days}`;
      const unit = days === 0 ? "último dia" : days === 1 ? "dia" : "dias";
      const link = f.url
        ? `<a href="${esc(f.url)}" style="display:inline-block;margin-top:12px;background:${INK};color:#ffffff;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px">Página de inscrição ↗</a>`
        : "";
      return `<tr><td style="padding:22px 0;border-bottom:1px dotted #a9a9a4">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="font-family:${SANS};color:${INK}">
            <div>${tag}</div>
            <div style="font-size:18px;font-weight:600;line-height:1.25;margin:10px 0 2px">${esc(f.name)}</div>
            <div style="font-size:13px;color:${MUTED}">${esc(f.local || f.country || "")}${f.fee ? ` · ${esc(f.fee)}` : ""}</div>
            <div style="font-family:${MONO};font-size:12px;color:${MUTED};margin-top:8px">Prazo: ${esc(fmtDate(f.deadline))}${confirmed ? "" : " · aguardando confirmação do festival"}</div>
            ${link}
          </td>
          <td valign="top" align="right" width="110" style="font-family:${SERIF};color:${INK};font-size:52px;line-height:.9;white-space:nowrap">${big}<div style="font-family:${SANS};font-size:12px;color:${MUTED};line-height:1.4">${unit}</div></td>
        </tr></table>
      </td></tr>`;
    })
    .join("");

  const intro = items.length === 1
    ? "Um festival que você salvou está com o prazo de inscrição chegando."
    : `${items.length} festivais que você salvou estão com o prazo de inscrição chegando.`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${PAPER};padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid ${LINE}">
    <tr><td style="background:${INK};padding:22px 28px">
      <span style="font-family:${SERIF};font-size:26px;color:#f2f2ee;letter-spacing:-.01em">Radar de <i>Festivais</i></span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${NEON};border:3px solid ${INK};outline:1.5px solid #f2f2ee;margin-left:10px;vertical-align:8px"></span>
      <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a3a39e;margin-top:6px">Lembrete de prazo</div>
    </td></tr>
    <tr><td style="padding:24px 28px 6px;font-family:${SANS};font-size:15px;color:${INK};line-height:1.5">${intro}</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td style="padding:20px 28px 26px;font-family:${SANS};font-size:13px;color:${MUTED};line-height:1.6">
      Antes de inscrever, confira o regulamento oficial: regras de estreia e duração mudam entre edições.<br><br>
      <a href="${esc(siteUrl)}" style="color:${INK};text-decoration:underline">Abrir o Radar de Festivais</a> para ver seus festivais salvos e ajustar os lembretes.
    </td></tr>
    <tr><td style="border-top:1px dotted #a9a9a4;padding:16px 28px;font-family:${SANS};font-size:12px;color:${MUTED}">
      Radar de Festivais · um projeto sem fins lucrativos da Subtexto Creative Co.<br>
      <a href="${esc(unsubscribeUrl)}" style="color:${MUTED}">Parar de receber lembretes</a>
    </td></tr>
  </table></body></html>`;

  const text =
    intro + "\n\n" +
    items
      .map(({ festival: f, days }) => `${f.name}: prazo ${fmtDate(f.deadline)} (${when(days)})${f.dateStatus === "Confirmada" ? "" : ", data prevista"}${f.url ? `\n${f.url}` : ""}`)
      .join("\n\n") + `\n\nAntes de inscrever, confira o regulamento oficial.\n${siteUrl}\nParar de receber: ${unsubscribeUrl}`;

  return { subject, html, text };
}
