// Regra de estilo do site: nada de travessão (—) em texto público.
// Vale para as páginas e para as bases (curtas e, quando existir, longas).
// Em nomes de festival use dois-pontos ("Festival X: Competição de Curtas"); em outros textos, ponto e vírgula, vírgula ou ponto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("../site/", import.meta.url);
const files = [
  ...readdirSync(root).filter((f) => f.endsWith(".html")),
  "dados/festivais.csv",
  ...(existsSync(new URL("dados/longas.csv", root)) ? ["dados/longas.csv"] : []),
];

for (const f of files) {
  test(`sem travessão em ${f}`, () => {
    const lines = readFileSync(new URL(f, root), "utf8").split("\n");
    const bad = lines.flatMap((l, i) => (l.includes("—") && !/^\s*<!--/.test(l) ? [`linha ${i + 1}: ${l.trim().slice(0, 90)}`] : []));
    assert.deepEqual(bad, [], `travessão (—) encontrado em ${f}`);
  });
}
