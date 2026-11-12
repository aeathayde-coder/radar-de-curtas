// Gera uma página estática por festival (site/festival/<id>.html) e o sitemap.xml completo.
// Roda no build do Netlify (netlify.toml → [build] command), a cada publicação:
// as páginas saem sempre da base atual, sem trabalho manual e sem publicação extra.
// Uso local: node scripts/gerar-paginas.mjs [pasta-de-saída]  (padrão: site)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseCSV, rowsToFestivals } from "../site/sheet.js";

const SITE = "https://www.radardefestivais.com.br";
const OUT = process.argv[2] || "site";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const QUAL_LABEL = { Oscar: "Oscar", BAFTA: "BAFTA", EFA: "European Film Awards", Goya: "Goya" };
const ORIGIN_LABEL = {
  any: "Filmes de qualquer país",
  national: "Só filmes do país do festival",
  "regional-br": "Recorte regional (inclui o Brasil)",
  regional: "Recorte regional (não inclui o Brasil)",
};
const CUR = { BRL: "R$", EUR: "€", USD: "US$", GBP: "£", CHF: "CHF " };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${String(d).padStart(2, "0")} ${MESES[m - 1]} ${y}`; };
const br = (iso) => iso.split("-").reverse().join("/");
const money = (v, c) => (v === 0 ? "Gratuita" : v == null ? "" : `${CUR[c] || (c ? c + " " : "")}${String(v).replace(".", ",")}`);

export function load(csvPath = "site/dados/festivais.csv") {
  return rowsToFestivals(parseCSV(readFileSync(csvPath, "utf8")));
}

function related(f, all, today) {
  const upcoming = (x) => (x.deadline && x.deadline >= today ? x.deadline : "9999");
  const pool = all.filter((x) => x.id !== f.id);
  const same = pool.filter((x) => x.country === f.country);
  const scope = pool.filter((x) => x.scope === f.scope && x.country !== f.country);
  return [...same, ...scope].sort((a, b) => upcoming(a).localeCompare(upcoming(b))).slice(0, 5);
}

export function page(f, all, shell, today = new Date().toISOString().slice(0, 10)) {
  const where = [f.local, f.local && f.country && !f.local.includes(f.country) ? f.country : !f.local ? f.country : ""].filter(Boolean).join(" · ");
  const prazo = f.deadline ? `inscrições até ${br(f.deadline)}` : "prazo de inscrição a confirmar";
  const title = `${f.name}: ${prazo} · Radar de Festivais`;
  const desc = [
    `${f.name}${where ? ` (${where})` : ""}: ${prazo}${f.deadline && f.dateStatus !== "Confirmada" ? " (data prevista)" : ""}.`,
    f.maxDuration ? `Curtas de até ${f.maxDuration} min.` : "",
    f.qualifies.length ? `Qualifica para ${f.qualifies.map((q) => QUAL_LABEL[q]).join(", ")}.` : "",
    "Taxa, requisitos, regulamento e lembretes de prazo no Radar de Festivais.",
  ].filter(Boolean).join(" ");
  const url = `${SITE}/festival/${f.id}.html`;

  const tags = [
    ...f.qualifies.map((q) => `<span class="fp-tg q">${esc(q)}</span>`),
    f.maxDuration ? `<span class="fp-tg">até ${f.maxDuration} min</span>` : "",
    ...f.genres.map((g) => `<span class="fp-tg">${esc(g)}</span>`),
    f.restrictions ? `<span class="fp-tg warn">${esc(f.restrictions)}</span>` : "",
  ].filter(Boolean).join("");

  const rows = [];
  const add = (k, v) => v && rows.push(`<dt>${k}</dt><dd>${v}</dd>`);
  add("Valor da inscrição", esc(f.fee));
  add("Estreia", esc(f.premiere));
  add("Origem dos filmes", esc(ORIGIN_LABEL[f.origin] || ""));
  add("Quem pode inscrever", esc(f.restrictions));
  add("Temas", esc(f.themes.join(", ")));
  add("Prêmios e benefícios", esc(f.benefit));
  add("Observações", esc(f.notes));

  const acts = [
    f.url ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">Página de inscrição ↗</a>` : "",
    f.rulesUrl ? `<a class="btn ghost" href="${esc(f.rulesUrl)}" target="_blank" rel="noopener">Regulamento ↗</a>` : "",
    `<a class="btn ghost" href="/?f=${encodeURIComponent(f.id)}">☆ Salvar e receber lembretes</a>`,
    `<button class="btn ghost" id="fp-share" type="button">Compartilhar</button>`,
  ].join("");

  const rel = related(f, all, today)
    .map((x) => `<li><a href="/festival/${x.id}.html">${esc(x.name)}</a><span>${x.deadline ? fmt(x.deadline) : "a confirmar"}</span></li>`)
    .join("");
  const relTitle = all.some((x) => x.id !== f.id && x.country === f.country) ? `Outros festivais ${f.scope === "BR" ? "no Brasil" : `em ${esc(f.country)}`}` : "Outros festivais";
  const fee = money(f.feeValue, f.feeCurrency);

  const main = `<div class="wrap">
  <main class="doc fp">
    <div class="fp-crumb"><a href="/">Festivais</a> · ${esc(f.scope === "BR" ? "Brasil" : f.country)} · Curta-metragem</div>
    <h1>${esc(f.name)}</h1>
    <p class="fp-where">${esc(where)}${f.url ? ` · <a href="${esc(f.url)}" target="_blank" rel="noopener">site oficial ↗</a>` : ""}</p>
    <div class="fp-facts">
      <div><span class="k">Inscrições até</span><span class="v">${f.deadline ? fmt(f.deadline) : "a confirmar"}</span></div>
      <div><span class="k">Situação</span><span class="pill" id="fp-st" data-deadline="${f.deadline || ""}" data-confirmed="${f.dateStatus === "Confirmada" ? 1 : 0}">${f.deadline ? (f.dateStatus === "Confirmada" ? "confirmado" : "previsto") : "a confirmar"}</span></div>
      <div><span class="k">Próxima edição</span><span class="v">${esc(f.event || "a definir")}</span></div>
      ${fee ? `<div><span class="k">Taxa atual</span><span class="v">${esc(fee)}</span></div>` : ""}
    </div>
    ${tags ? `<div class="fp-tags">${tags}</div>` : ""}
    ${rows.length ? `<dl class="fp-dl">${rows.join("")}</dl>` : ""}
    <div class="fp-acts">${acts}</div>
    <p class="fp-chk">${f.checkedAt ? `conferido em ${fmt(f.checkedAt)} · ` : ""}confira sempre o regulamento oficial antes de inscrever</p>
    ${rel ? `<h2>${relTitle}</h2><ul class="fp-rel">${rel}</ul>` : ""}
    <p class="doc-cta"><a class="btn" href="/">Ver todos os festivais</a></p>
  </main>
</div>
<script>
(function () {
  var b = document.getElementById("fp-share"); if (!b) return;
  b.onclick = function () {
    var url = location.href.split("#")[0].split("?")[0], t = document.title;
    if (matchMedia("(pointer: coarse)").matches && navigator.share) { navigator.share({ title: t, url: url }).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = "Link copiado"; setTimeout(function () { b.textContent = "Compartilhar"; }, 2500); }, function () { prompt("Copie o link:", url); });
  };
})();
(function () {
  var el = document.getElementById("fp-st"); var dl = el && el.dataset.deadline; if (!dl) return;
  var now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  var t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var p = dl.split("-"); var d = Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - t) / 864e5);
  if (d < 0) { el.textContent = "encerrado"; el.className = "pill p-off"; return; }
  if (el.dataset.confirmed === "1") {
    if (d <= 30) { el.textContent = d === 0 ? "hoje" : d === 1 ? "falta 1 dia" : "faltam " + d + " dias"; el.className = "pill p-hot"; }
    else { el.textContent = "confirmado · " + d + " d"; el.className = "pill p-ok"; }
  } else { el.textContent = "previsto · ~" + d + " d"; el.className = "pill p-est"; }
})();
</script>
`;
  return shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace("<!--MAIN-->", main);
}

function shellFrom(html) {
  // usa o topo e o rodapé da página Como funciona, para manter a identidade do site
  const head = html.slice(0, html.indexOf('<div class="wrap">')).replace(' aria-current="page"', "");
  const foot = html.slice(html.indexOf('<footer class="sitebar">'));
  return head + "<!--MAIN-->" + foot;
}

export function sitemap(all) {
  const fixed = [
    ["/", "weekly", "1.0"],
    ["/por-onde-comecar.html", "monthly", "0.7"],
    ["/como-funciona.html", "monthly", "0.6"],
    ["/privacidade.html", "yearly", "0.2"],
  ].map(([p, c, pr]) => `  <url><loc>${SITE}${p}</loc><changefreq>${c}</changefreq><priority>${pr}</priority></url>`);
  const fest = all.map((f) => `  <url><loc>${SITE}/festival/${f.id}.html</loc>${f.checkedAt ? `<lastmod>${f.checkedAt}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...fixed, ...fest].join("\n")}\n</urlset>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = load();
  const shell = shellFrom(readFileSync("site/como-funciona.html", "utf8"));
  const dir = join(OUT, "festival");
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  for (const f of all) writeFileSync(join(dir, `${f.id}.html`), page(f, all, shell));
  writeFileSync(join(OUT, "sitemap.xml"), sitemap(all));
  console.log(`${all.length} páginas de festival geradas em ${dir}`);
}
