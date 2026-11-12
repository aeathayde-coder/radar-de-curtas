// Agenda assinável: um arquivo .ics com os prazos dos festivais salvos, gerado na hora.
const ymd = (iso) => iso.replace(/-/g, "");
const nextDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const icsEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
// Linhas de .ics têm no máximo 75 octetos: dobra as longas
const fold = (line) => {
  const out = []; let cur = ""; let len = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (len + n > 74) { out.push(cur); cur = " "; len = 1; }
    cur += ch; len += n;
  }
  out.push(cur);
  return out.join("\r\n");
};

export function buildCalendar(festivals, { siteUrl = "", today, stamp = new Date() } = {}) {
  const dt = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events = festivals
    .filter((f) => f.deadline && (!today || f.deadline >= today))
    .flatMap((f) => {
      const desc = [
        f.dateStatus === "Confirmada" ? "Prazo confirmado pelo festival." : "Data prevista com base na edição anterior; aguardando confirmação.",
        f.url ? `Inscrição: ${f.url}` : "",
        siteUrl ? `No Radar: ${siteUrl}/festival/${f.id}.html` : "",
      ].filter(Boolean).join("\n");
      return [
        "BEGIN:VEVENT",
        `UID:${f.id}@radardefestivais.com.br`,
        `DTSTAMP:${dt}`,
        `DTSTART;VALUE=DATE:${ymd(f.deadline)}`,
        `DTEND;VALUE=DATE:${ymd(nextDay(f.deadline))}`,
        `SUMMARY:${icsEsc(`Prazo: ${f.name}${f.dateStatus === "Confirmada" ? "" : " (previsto)"}`)}`,
        `DESCRIPTION:${icsEsc(desc)}`,
        f.url ? `URL:${f.url}` : "",
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`Prazo em 7 dias: ${f.name}`)}`, "TRIGGER:-P7D", "END:VALARM",
        "END:VEVENT",
      ].filter(Boolean);
    });
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radar de Festivais//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Radar de Festivais", "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
    ...events, "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}
