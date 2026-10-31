import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV, parseDate, rowsToFestivals, sortFestivals, deriveCountry, daysBetween, todayBRT, fetchFestivals } from "../netlify/lib/festivals.mjs";
import { selectReminders, buildEmail, unsubscribeToken, verifyUnsubscribe } from "../netlify/lib/reminders.mjs";

const CSV = readFileSync(new URL("../site/dados/festivais.csv", import.meta.url), "utf8");
const list = sortFestivals(rowsToFestivals(parseCSV(CSV)));
const by = (id) => list.find((f) => f.id === id);

test("colunas novas: qualificação, estreia, restrições, temas", () => {
  assert.deepEqual(by("zinebi").qualifies, ["Oscar", "BAFTA", "EFA", "Goya"]);
  assert.deepEqual(by("clermont-ferrand").qualifies, ["Oscar", "BAFTA", "EFA"]);
  assert.equal(by("veneza").premiere, "Mundial");
  assert.equal(by("go-short").restrictions, "Competição europeia: só produções europeias");
  assert.deepEqual(by("filmambiente").themes, ["Meio ambiente"]);
  assert.equal(by("tampere").rulesUrl, null);
  const rows = parseCSV("Nome,Qualificação,Regulamento\nX,\"oscar qualifying; BAFTA\",https://x.org/reg.pdf\n");
  const [x] = rowsToFestivals(rows);
  assert.deepEqual(x.qualifies, ["Oscar", "BAFTA"]);
  assert.equal(x.rulesUrl, "https://x.org/reg.pdf");
});

test("base inicial: 52 festivais com IDs únicos", () => {
  assert.equal(list.length, 52);
  assert.equal(new Set(list.map((f) => f.id)).size, 52);
});

test("CSV com aspas, vírgulas e quebra de linha", () => {
  const rows = parseCSV('Nome,Valor inscrição\r\n"A, B","€1 ""x""\nlinha 2"\n');
  assert.deepEqual(rows, [["Nome", "Valor inscrição"], ["A, B", '€1 "x"\nlinha 2']]);
});

test("datas no formato do Sheets em pt-BR", () => {
  assert.equal(parseDate("15/11/2026"), "2026-11-15");
  assert.equal(parseDate("5/1/27"), "2027-01-05");
  assert.equal(parseDate("2026-11-15"), "2026-11-15");
  assert.equal(parseDate("a confirmar"), null);
});

test("país, escopo, gêneros e duração", () => {
  assert.equal(by("tampere").country, "Finlândia");
  assert.equal(by("tampere").scope, "INT");
  assert.equal(by("curta-cinema").scope, "BR");
  assert.equal(by("sxsw").country, "EUA");
  assert.deepEqual(by("annecy").genres, ["Animação"]);
  assert.equal(by("cannes-curtas").maxDuration, 15);
  assert.equal(by("fest").maxDuration, null);
  assert.equal(deriveCountry("Recife / PE"), "Brasil");
  assert.equal(deriveCountry("Lisboa, Portugal"), "Portugal");
});

test("coluna Publicar = Não esconde; sem prazo vai para o fim; cabeçalhos tolerantes", () => {
  const rows = parseCSV("ID,NOME,pais,DEADLINE,Publicar\na,Festival A,Brasil,10/12/2026,Sim\nb,Festival B,França,,Não\n,Festival C,França,,\n");
  const out = sortFestivals(rowsToFestivals(rows));
  assert.deepEqual(out.map((f) => f.id), ["a", "festival-c"]);
  assert.equal(out[0].deadline, "2026-12-10");
  assert.equal(list.at(-1).deadline, null);
});

test("datas no fuso de Brasília", () => {
  assert.equal(todayBRT(new Date("2026-10-30T02:00:00Z")), "2026-10-29");
  assert.equal(daysBetween("2026-10-29", "2027-01-08"), 71);
});

test("lembretes: dias certos, opt-out e deduplicação", () => {
  const prof = { email: "a@x.com", reminder_days: [30, 7, 1], email_opt_in: true };
  const saved = [
    { user_id: "u1", festival_id: "tampere", profiles: prof },
    { user_id: "u1", festival_id: "go-short", profiles: prof },
    { user_id: "u2", festival_id: "tampere", profiles: { ...prof, email_opt_in: false } },
  ];
  assert.equal(selectReminders({ saved, festivals: list, today: "2026-10-27" }).length, 1);
  const r = selectReminders({ saved, festivals: list, today: "2026-11-02" });
  assert.deepEqual(r.map((u) => [u.email, u.items.map((i) => i.days)]), [["a@x.com", [1]]]);
  const inscrito = saved.map((r) => ({ ...r, status: r.festival_id === "tampere" ? "inscrito" : "quero" }));
  assert.equal(selectReminders({ saved: inscrito, festivals: list, today: "2026-11-02" }).length, 0);
  const sent = new Set(["u1|tampere|2026-11-03|1"]);
  assert.equal(selectReminders({ saved, festivals: list, today: "2026-11-02", sent }).length, 0);
});

test("e-mail escapa HTML; token de descadastro", () => {
  const { subject, html } = buildEmail({ items: [{ festival: { ...list[0], name: "<script>x</script>" }, days: 1 }], siteUrl: "https://s", unsubscribeUrl: "https://s/u" });
  assert.match(subject, /amanhã/);
  assert.ok(!html.includes("<script>"));
  const id = "11111111-1111-1111-1111-111111111111";
  assert.ok(verifyUnsubscribe(id, unsubscribeToken(id, "seg"), "seg"));
  assert.ok(!verifyUnsubscribe(id, unsubscribeToken(id, "seg"), "outro"));
});

test("busca da planilha publicada e erro claro quando o link não é CSV", async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("﻿" + CSV);
    assert.equal((await fetchFestivals({ csvUrl: "https://x", fresh: true })).length, 52);
    globalThis.fetch = async () => new Response("<!DOCTYPE html><html>");
    await assert.rejects(fetchFestivals({ csvUrl: "https://x", fresh: true }), /publique a aba/);
  } finally { globalThis.fetch = orig; }
});
