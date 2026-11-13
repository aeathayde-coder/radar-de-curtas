import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load, page, sitemap } from "../scripts/gerar-paginas.mjs";

const all = load();
const html = readFileSync(new URL("../site/como-funciona.html", import.meta.url), "utf8");
const shell = html.slice(0, html.indexOf('<div class="wrap">')) + "<!--MAIN-->" + html.slice(html.indexOf('<footer class="sitebar">'));

test("uma página por festival publicado, com título, canonical e sem travessão", () => {
  for (const f of all) {
    const p = page(f, all, shell, "2026-11-12");
    assert.match(p, new RegExp(`<link rel="canonical" href="https://www.radardefestivais.com.br/festival/${f.id}.html">`));
    assert.ok(p.includes("· Radar de Festivais</title>"), f.id);
    assert.ok(!p.includes("—"), `travessão na página de ${f.id}`);
    assert.ok(!p.includes("<!--MAIN-->"), f.id);
  }
});

test("sitemap lista as páginas fixas e todos os festivais", () => {
  const s = sitemap(all);
  assert.equal((s.match(/<url>/g) || []).length, all.length + 4);
});
