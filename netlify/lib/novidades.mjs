// Novidades semanais: mudanças nos festivais salvos e festivais novos que combinam com buscas salvas.
import { matchesParams, describeParams } from "../../site/filtros.js";
import { fmtDate } from "./reminders.mjs";

// prev: Map festival_id → { deadline, date_status } (foto da base na última execução)
// Devolve as mudanças a registrar. Sem foto anterior (primeira execução), só cria a foto.
export function detectChanges(prev, festivals, today) {
  if (!prev.size) return [];
  const out = [];
  for (const f of festivals) {
    const p = prev.get(f.id);
    if (!p) { out.push({ festival_id: f.id, kind: "novo", before: null, after: f.deadline || null }); continue; }
    const future = (d) => d && d >= today;
    if (p.date_status !== "Confirmada" && f.dateStatus === "Confirmada" && future(f.deadline)) {
      out.push({ festival_id: f.id, kind: "confirmada", before: p.deadline || null, after: f.deadline });
    } else if (f.dateStatus === "Confirmada" && p.deadline && f.deadline && p.deadline !== f.deadline && future(p.deadline) && future(f.deadline)) {
      out.push({ festival_id: f.id, kind: "prazo", before: p.deadline, after: f.deadline });
    }
  }
  return out;
}

// changes: [{ id, festival_id, kind, before, after }]
// saved: [{ user_id, festival_id, profiles: { email, email_opt_in, change_alerts } }]
// searches: [{ user_id, label, params, profiles: { email, email_opt_in } }]
// sent: Set "user|change_id"
export function selectDigest({ changes, festivals, saved, searches, sent = new Set() }) {
  const byId = new Map(festivals.map((f) => [f.id, f]));
  const users = new Map();
  const user = (id, email) => {
    if (!users.has(id)) users.set(id, { userId: id, email, changes: [], searches: new Map(), ids: new Set() });
    return users.get(id);
  };
  const updates = changes.filter((c) => c.kind !== "novo");
  for (const row of saved) {
    const prof = row.profiles;
    if (!prof?.email || !prof.email_opt_in || prof.change_alerts === false) continue;
    for (const c of updates) {
      if (c.festival_id !== row.festival_id || sent.has(`${row.user_id}|${c.id}`)) continue;
      const f = byId.get(c.festival_id);
      if (!f) continue;
      const u = user(row.user_id, prof.email);
      if (u.ids.has(c.id)) continue;
      u.ids.add(c.id);
      u.changes.push({ ...c, festival: f });
    }
  }
  const novos = changes.filter((c) => c.kind === "novo");
  for (const s of searches) {
    const prof = s.profiles;
    if (!prof?.email || !prof.email_opt_in) continue;
    for (const c of novos) {
      if (sent.has(`${s.user_id}|${c.id}`)) continue;
      const f = byId.get(c.festival_id);
      if (!f || !matchesParams(f, s.params)) continue;
      const u = user(s.user_id, prof.email);
      const label = s.label || describeParams(s.params) || "sua busca";
      if (!u.searches.has(label)) u.searches.set(label, { label, params: s.params, festivals: [] });
      const grp = u.searches.get(label);
      if (!grp.festivals.some((x) => x.id === f.id)) grp.festivals.push(f);
      u.ids.add(c.id);
    }
  }
  return [...users.values()]
    .filter((u) => u.changes.length || u.searches.size)
    .map((u) => ({ ...u, searches: [...u.searches.values()], ids: [...u.ids] }));
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildDigest({ changes, searches, siteUrl, unsubscribeUrl }) {
  const nNew = searches.reduce((n, s) => n + s.festivals.length, 0);
  const subject =
    changes.length && nNew
      ? `Novidades: ${changes.length} ${changes.length === 1 ? "festival salvo mudou" : "festivais salvos mudaram"} e ${nNew} ${nNew === 1 ? "festival novo" : "festivais novos"} para suas buscas`
      : changes.length
        ? changes.length === 1 ? `${changes[0].festival.name}: prazo ${changes[0].kind === "confirmada" ? "confirmado" : "alterado"}` : `${changes.length} festivais que você salvou mudaram`
        : nNew === 1 ? "1 festival novo para a sua busca" : `${nNew} festivais novos para suas buscas`;

  const INK = "#0e0e0e", MUTED = "#62625f", LINE = "#d8d8d4", NEON = "#c6ff3d", PAPER = "#fcfcfb";
  const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
  const SANS = "Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  const MONO = "'Geist Mono',Menlo,Consolas,monospace";
  const tag = (t, solid) =>
    solid
      ? `<span style="background:${NEON};color:${INK};font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px">${t}</span>`
      : `<span style="border:1px solid ${INK};font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px">${t}</span>`;
  const btn = (href, label) =>
    `<a href="${esc(href)}" style="display:inline-block;margin-top:12px;background:${INK};color:#ffffff;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px">${label}</a>`;
  const item = (t, solid, f, meta, link) => `<tr><td style="padding:20px 0;border-bottom:1px dotted #a9a9a4;font-family:${SANS};color:${INK}">
      <div>${tag(t, solid)}</div>
      <div style="font-size:18px;font-weight:600;line-height:1.25;margin:10px 0 2px">${esc(f.name)}</div>
      <div style="font-family:${MONO};font-size:12px;color:${MUTED};margin-top:6px">${meta}</div>
      ${link}
    </td></tr>`;
  const page = (f) => `${siteUrl}/festival/${encodeURIComponent(f.id)}.html`;

  const changeRows = changes
    .map((c) => {
      const f = c.festival;
      const before = c.before ? fmtDate(c.before) : "";
      return c.kind === "confirmada"
        ? item("data confirmada", true, f, `Inscrições até ${esc(fmtDate(c.after))}${before ? ` · antes: previsto para ~${esc(before)}` : ""}`, f.url ? btn(f.url, "Página de inscrição ↗") : "")
        : item("prazo mudou", false, f, `Inscrições até ${esc(fmtDate(c.after))} · antes: <s>${esc(before)}</s>`, f.url ? btn(f.url, "Página de inscrição ↗") : "");
    })
    .join("");
  const searchBlocks = searches
    .map((s) => `<tr><td style="padding:22px 0 0;font-family:${SANS};font-size:14px;color:${INK}">Para a busca <b>${esc(s.label)}</b>:</td></tr>` +
      s.festivals
        .map((f) => item("novo no radar", true, f, `${esc(f.local || f.country || "")}${f.deadline ? ` · inscrições até ${esc(fmtDate(f.deadline))}${f.dateStatus === "Confirmada" ? "" : " (prevista)"}` : ""}${f.fee ? ` · ${esc(f.fee)}` : ""}`, btn(page(f), "Ver no Radar →")))
        .join(""))
    .join("");

  const intro = [
    changes.length ? (changes.length === 1 ? "Um festival da sua lista teve novidade esta semana." : `${changes.length} festivais da sua lista tiveram novidades esta semana.`) : "",
    nNew ? (nNew === 1 ? "Entrou no Radar um festival que combina com uma busca que você salvou." : `Entraram no Radar ${nNew} festivais que combinam com buscas que você salvou.`) : "",
  ].filter(Boolean).join(" ");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${PAPER};padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid ${LINE}">
    <tr><td style="background:${INK};padding:22px 28px">
      <span style="font-family:${SERIF};font-size:26px;color:#f2f2ee;letter-spacing:-.01em">Radar de <i>Festivais</i></span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${NEON};border:3px solid ${INK};outline:1.5px solid #f2f2ee;margin-left:10px;vertical-align:8px"></span>
      <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a3a39e;margin-top:6px">Novidades da semana</div>
    </td></tr>
    <tr><td style="padding:24px 28px 6px;font-family:${SANS};font-size:15px;color:${INK};line-height:1.5">${intro}</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${changeRows}${searchBlocks}</table></td></tr>
    <tr><td style="padding:20px 28px 26px;font-family:${SANS};font-size:13px;color:${MUTED};line-height:1.6">
      Antes de inscrever, confira o regulamento oficial: regras de estreia e duração mudam entre edições.<br><br>
      <a href="${esc(siteUrl)}" style="color:${INK};text-decoration:underline">Abrir o Radar de Festivais</a> para ajustar seus avisos e buscas salvas.
    </td></tr>
    <tr><td style="border-top:1px dotted #a9a9a4;padding:16px 28px;font-family:${SANS};font-size:12px;color:${MUTED}">
      Radar de Festivais · um projeto sem fins lucrativos da Subtexto Creative Co.<br>
      <a href="${esc(unsubscribeUrl)}" style="color:${MUTED}">Parar de receber e-mails do Radar</a>
    </td></tr>
  </table></body></html>`;

  const text = [
    intro,
    ...changes.map((c) => `${c.festival.name}: ${c.kind === "confirmada" ? "data confirmada" : "prazo mudou"}, inscrições até ${fmtDate(c.after)}${c.before ? ` (antes: ${fmtDate(c.before)})` : ""}${c.festival.url ? `\n${c.festival.url}` : ""}`),
    ...searches.map((s) => `Para a busca ${s.label}:\n` + s.festivals.map((f) => `${f.name}${f.deadline ? `: inscrições até ${fmtDate(f.deadline)}` : ""}\n${page(f)}`).join("\n")),
    `Antes de inscrever, confira o regulamento oficial.\n${siteUrl}\nParar de receber: ${unsubscribeUrl}`,
  ].join("\n\n");

  return { subject, html, text };
}
