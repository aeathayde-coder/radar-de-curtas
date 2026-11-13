import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV, rowsToFestivals } from "../netlify/lib/festivals.mjs";
import { detectChanges, selectDigest, buildDigest } from "../netlify/lib/novidades.mjs";
import { buildCalendar } from "../netlify/lib/agenda.mjs";
import { matchesParams, describeParams } from "../site/filtros.js";

const all = rowsToFestivals(parseCSV(readFileSync(new URL("../site/dados/festivais.csv", import.meta.url), "utf8")));
const F = (o) => ({ id: "x", name: "Festival X", genres: [], qualifies: [], themes: [], scope: "BR", country: "Brasil", dateStatus: "Confirmada", ...o });

test("primeira execução só cria a foto, sem avisar", () => {
  assert.deepEqual(detectChanges(new Map(), all, "2026-11-12"), []);
});

test("detecta festival novo, data confirmada e prazo alterado", () => {
  const prev = new Map([
    ["a", { deadline: "2026-12-01", date_status: "Estimada" }],
    ["b", { deadline: "2026-12-01", date_status: "Confirmada" }],
    ["c", { deadline: "2026-12-01", date_status: "Confirmada" }],
    ["d", { deadline: "2026-11-01", date_status: "Confirmada" }],
  ]);
  const now = [
    F({ id: "a", deadline: "2026-12-05" }),
    F({ id: "b", deadline: "2026-12-10" }),
    F({ id: "c", deadline: "2026-12-01" }),
    F({ id: "d", deadline: "2027-11-01", dateStatus: "Estimada" }), // renovação anual: não avisa
    F({ id: "e", deadline: "2027-01-10" }),
  ];
  const ch = detectChanges(prev, now, "2026-11-12");
  assert.deepEqual(ch.map((c) => `${c.festival_id}:${c.kind}`), ["a:confirmada", "b:prazo", "e:novo"]);
});

test("e-mail semanal junta mudanças dos salvos e festivais novos das buscas", () => {
  const festivals = [F({ id: "a", deadline: "2026-12-05", genres: ["Documentário"], maxDuration: 30, origin: "any" }), F({ id: "n", name: "Novo Doc", deadline: "2027-01-10", genres: ["Documentário"], maxDuration: 25, origin: "any" })];
  const changes = [{ id: 1, festival_id: "a", kind: "confirmada", before: "2026-12-01", after: "2026-12-05" }, { id: 2, festival_id: "n", kind: "novo", before: null, after: "2027-01-10" }];
  const prof = { email: "x@ex.com", email_opt_in: true, change_alerts: true };
  const saved = [{ user_id: "u1", festival_id: "a", profiles: prof }];
  const searches = [{ user_id: "u1", label: "", params: "g=Documentário&dur=20&br=1", profiles: prof }, { user_id: "u2", label: "", params: "g=Animação", profiles: prof }];
  const out = selectDigest({ changes, festivals, saved, searches });
  assert.equal(out.length, 1);
  assert.equal(out[0].changes.length, 1);
  assert.equal(out[0].searches[0].festivals[0].id, "n");
  assert.deepEqual(out[0].ids.sort(), [1, 2]);
  const again = selectDigest({ changes, festivals, saved, searches, sent: new Set(["u1|1", "u1|2"]) });
  assert.equal(again.length, 0);
  const off = selectDigest({ changes, festivals, saved: [{ ...saved[0], profiles: { ...prof, change_alerts: false } }], searches: [] });
  assert.equal(off.length, 0);
  const mail = buildDigest({ changes: out[0].changes, searches: out[0].searches, siteUrl: "https://www.radardefestivais.com.br", unsubscribeUrl: "u" });
  assert.ok(!mail.subject.includes("—") && !mail.html.includes("—") && !mail.text.includes("—"));
  assert.match(mail.html, /festival\/n\.html/);
});

test("filtros da busca salva seguem as regras do site", () => {
  const f = all.find((x) => x.id === "go-short");
  assert.equal(matchesParams(f, "br=1"), false); // só produções europeias
  assert.equal(matchesParams(f, "ql=Oscar&r=INT"), true);
  assert.equal(describeParams("g=Documentário&dur=20&br=1&gratis=1"), "Documentário · filme de 20 min · inscrição gratuita · aceitam filmes brasileiros");
});

test("agenda assinável: só prazos futuros, linhas dobradas e sem dados pessoais", () => {
  const ics = buildCalendar(all.slice(0, 20), { siteUrl: "https://www.radardefestivais.com.br", today: "2026-11-12" });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  const past = all.find((x) => x.deadline && x.deadline < "2026-11-12");
  if (past) assert.ok(!ics.includes(`UID:${past.id}@`));
});
