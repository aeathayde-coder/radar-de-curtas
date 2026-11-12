// Equipe do projeto: convites, avisos de quem participa e resumo da atividade.
import { fmtDate } from "./reminders.mjs";

export const ROLE_LABEL = { dono: "criadora", editor: "editor", leitor: "apenas visualização" };
const STATUS_LABEL = { quero: "quero inscrever", inscrito: "inscrito", selecionado: "selecionado", nao_selecionado: "não selecionado" };

export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 254;

// Linhas "salvas" de quem participa de projetos alheios, no formato que os lembretes e as novidades já usam.
// saved: [{ film_id, festival_id, status }] · members: [{ film_id, user_id, role, remind, changes, profiles }]
export function memberRows({ saved, members, flag }) {
  const byFilm = new Map();
  for (const s of saved) {
    if (!byFilm.has(s.film_id)) byFilm.set(s.film_id, []);
    byFilm.get(s.film_id).push(s);
  }
  const out = [];
  for (const m of members) {
    if (m.role === "dono" || !m[flag]) continue;
    for (const s of byFilm.get(m.film_id) || []) out.push({ user_id: m.user_id, festival_id: s.festival_id, status: s.status, profiles: m.profiles });
  }
  return out;
}

// Atividade feita por outras pessoas nos projetos de quem pediu o resumo.
// activity: [{ id, film_id, actor, kind, festival_id, detail }]
// members: [{ film_id, user_id, activity, profiles: { email, email_opt_in } }]
// names: Map user_id → nome · films: Map film_id → título · sent: Set "user|activity_id"
export function selectActivity({ activity, members, festivals, names, films, sent = new Set() }) {
  const byId = new Map(festivals.map((f) => [f.id, f]));
  const users = new Map();
  for (const m of members) {
    if (!m.activity || !m.profiles?.email || !m.profiles.email_opt_in) continue;
    for (const a of activity) {
      if (a.film_id !== m.film_id || a.actor === m.user_id || !a.actor || sent.has(`${m.user_id}|${a.id}`)) continue;
      if (!users.has(m.user_id)) users.set(m.user_id, { userId: m.user_id, email: m.profiles.email, activity: [], activityIds: [] });
      const u = users.get(m.user_id);
      const f = byId.get(a.festival_id);
      u.activity.push({
        film: films.get(a.film_id) || "seu projeto",
        who: names.get(a.actor) || "Alguém da equipe",
        what: a.kind === "incluiu" ? "incluiu" : a.kind === "tirou" ? "tirou" : `marcou como ${STATUS_LABEL[a.detail] || a.detail}`,
        festival: f ? f.name : a.festival_id,
      });
      u.activityIds.push(a.id);
    }
  }
  return users;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildInviteEmail({ inviter, film, role, email, link }) {
  const subject = `${inviter} convidou você para o projeto ${film} no Radar de Festivais`;
  const INK = "#0e0e0e", MUTED = "#62625f", LINE = "#d8d8d4", NEON = "#c6ff3d", PAPER = "#fcfcfb";
  const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
  const SANS = "Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  const MONO = "'Geist Mono',Menlo,Consolas,monospace";
  const can = role === "editor"
    ? "Como editor, você inclui e tira festivais, muda a situação de cada inscrição e marca o checklist."
    : "Com o perfil apenas visualização, você acompanha os festivais, a situação de cada inscrição e o checklist, sem alterar.";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${PAPER};padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid ${LINE}">
    <tr><td style="background:${INK};padding:22px 28px">
      <span style="font-family:${SERIF};font-size:26px;color:#f2f2ee;letter-spacing:-.01em">Radar de <i>Festivais</i></span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${NEON};border:3px solid ${INK};outline:1.5px solid #f2f2ee;margin-left:10px;vertical-align:8px"></span>
      <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a3a39e;margin-top:6px">Convite para a equipe</div>
    </td></tr>
    <tr><td style="padding:26px 28px 8px;font-family:${SERIF};font-size:30px;line-height:1.1;color:${INK}">Você foi convidado para planejar a circulação de <i>${esc(film)}</i></td></tr>
    <tr><td style="padding:10px 28px;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK}">
      ${esc(inviter)} convidou você como <b>${esc(ROLE_LABEL[role])}</b>. ${can} As notas de cada pessoa são privadas, a não ser as que ela escolher compartilhar.
    </td></tr>
    <tr><td style="padding:8px 28px 4px">
      <a href="${esc(link)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-family:${SANS};font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px">Abrir o convite</a>
    </td></tr>
    <tr><td style="padding:14px 28px 24px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">
      Entre no Radar com a conta Google deste e-mail, ${esc(email)}. O convite não funciona em outra conta.<br>
      Se não esperava este convite, ignore esta mensagem.
    </td></tr>
    <tr><td style="border-top:1px dotted #a9a9a4;padding:16px 28px;font-family:${SANS};font-size:12px;color:${MUTED}">
      Radar de Festivais · um projeto sem fins lucrativos da Subtexto Creative Co.
    </td></tr>
  </table></body></html>`;
  const text = `${inviter} convidou você como ${ROLE_LABEL[role]} para o projeto ${film} no Radar de Festivais.\n\n${can}\n\nAbrir o convite: ${link}\n\nEntre com a conta Google deste e-mail, ${email}. O convite não funciona em outra conta.`;
  return { subject, html, text };
}

export function activityHTML(items, { INK, MUTED, SANS }) {
  const byFilm = new Map();
  for (const it of items) {
    if (!byFilm.has(it.film)) byFilm.set(it.film, []);
    byFilm.get(it.film).push(it);
  }
  return [...byFilm.entries()]
    .map(([film, list]) => `<tr><td style="padding:22px 0 6px;font-family:${SANS};font-size:14px;color:${INK}">Na equipe de <b>${esc(film)}</b>:</td></tr>` +
      list.map((it) => `<tr><td style="padding:6px 0;border-bottom:1px dotted #a9a9a4;font-family:${SANS};font-size:14px;color:${INK}">${esc(it.who)} ${esc(it.what)} <b>${esc(it.festival)}</b></td></tr>`).join(""))
    .join("") + `<tr><td style="padding:8px 0 0;font-family:${SANS};font-size:12px;color:${MUTED}"></td></tr>`;
}
export const activityText = (items) => items.map((it) => `${it.film}: ${it.who} ${it.what} ${it.festival}`).join("\n");
export { fmtDate };
