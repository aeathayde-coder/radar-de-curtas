// Teste de interface com Playwright contra o preview local.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// Supabase simulado: sessão em memória + tabelas em memória
const FAKE_SUPABASE = `
const db = { films: [], saved_festivals: [], saved_searches: [], profiles: [{ id: "u1", email: "ana@example.com", email_opt_in: true, reminder_days: [30,7,1], change_alerts: true, calendar_token: null }] };
let session = null, listeners = [];
function q(table) {
  let filters = [], op = "select", payload = null;
  const api = {
    select() { return api; },
    eq(k, v) { filters.push([k, v]); return api; },
    insert(row) { op = "insert"; payload = row; return api; },
    delete() { op = "delete"; return api; },
    update(p) { op = "update"; payload = p; return api; },
    maybeSingle() { api._single = true; return api; },
    single() { api._single = true; return api; },
    order() { return api; },
    then(res, rej) {
      const match = (r) => filters.every(([k, v]) => r[k] === v);
      let data = null;
      if (op === "select") { data = db[table].filter(match); if (api._single) data = data[0] || null; }
      if (op === "insert") { const row = { id: String(Math.random()).slice(2), notify: true, ...payload }; db[table].push(row); data = api._single ? row : [row]; }
      if (op === "delete") db[table] = db[table].filter((r) => !match(r));
      if (op === "update") { db[table].filter(match).forEach((r) => Object.assign(r, payload)); if (api._single) data = db[table].filter(match)[0] || null; }
      window.__db = db;
      return Promise.resolve({ data, error: null }).then(res, rej);
    },
  };
  return api;
}
export function createClient() {
  return {
    from: q,
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => listeners.push(cb),
      signInWithOAuth: async () => { session = { user: { id: "u1", email: "ana@example.com", user_metadata: { full_name: "Ana Elisa" } } }; listeners.forEach((l) => l("SIGNED_IN", session)); },
      signOut: async () => { session = null; listeners.forEach((l) => l("SIGNED_OUT", null)); },
    },
  };
}`;

(async () => {
  const browser = await chromium.launch();
  const out = process.argv[2] || "/tmp";

  // 1) Visitante, desktop
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8888/");
  await page.waitForSelector("#tb tr td.name");
  const total = await page.locator("#tb tr").count();
  console.log("linhas:", total, "|", await page.textContent("#count"));
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });

  // busca livre sem acento
  await page.fill("#q", "sao paulo");
  await page.waitForTimeout(250);
  console.log("busca 'sao paulo':", await page.textContent("#count"));
  assert.match(await page.textContent("#tb"), /Kinoforum/);
  await page.fill("#q", "");
  await page.waitForTimeout(250);

  // busca avançada: animação, 20 min, sem desconhecidos
  if (await page.isHidden("#adv")) await page.click("#adv-toggle");
  await page.click("#genres label:has-text('Animação')");
  await page.fill("#dur", "20");
  await page.uncheck("#unknown");
  await page.waitForTimeout(100);
  const names = await page.locator("#tb td.name .fname").allTextContents();
  console.log("animação + 20min:", names.length, names.map((n) => n.slice(0, 20)));
  assert.ok(!names.some((n) => n.startsWith("Festival de Cannes: Competição de curtas")), "Cannes, competição de curtas (≤15 min), deve sair");
  assert.ok(!names.some((n) => n.startsWith("Fantaspoa")), "Fantaspoa (só fantástico) deve sair");
  assert.ok(names.some((n) => n.startsWith("Annecy")));
  console.log("URL:", new URL(page.url()).search);
  await page.screenshot({ path: `${out}/advanced.png`, fullPage: false });

  // URL compartilhável restaura filtros
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.goto(page.url());
  await p2.waitForSelector("#tb tr td.name");
  assert.equal(await p2.textContent("#count"), await page.textContent("#count"));
  assert.equal(await p2.isVisible("#adv"), true);
  await p2.selectOption("#country", "Brasil");
  console.log("país Brasil (com filtros):", await p2.textContent("#count"));
  await p2.close();

  // estrela sem login não quebra
  assert.equal(await page.isVisible("#account button"), false);

  // 2) Mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await m.goto("http://localhost:8888/");
  await m.waitForSelector("#tb tr td.name");
  await m.screenshot({ path: `${out}/mobile.png`, fullPage: false });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log("overflow horizontal mobile:", overflow);
  await m.close();

  // 3) Logado (Supabase simulado)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("https://esm.sh/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_SUPABASE }));
  await ctx.route(/frankfurter/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ date: "2026-11-04", rates: { EUR: 0.16, USD: 0.185, GBP: 0.14, CHF: 0.15 } }) }));
  const a = await ctx.newPage();
  a.on("pageerror", (e) => errors.push(e.message));
  await a.goto("http://localhost:8889/");
  await a.waitForSelector("#login");
  await a.click("#login");
  await a.waitForSelector("#open-profile");
  // sem projeto: salva em "Para acompanhar"
  await a.click("#tb tr:nth-child(3) .star");
  await a.waitForSelector("#savein[open] #si-list input");
  await a.screenshot({ path: `${out}/v4-primeiro-salvar.png` });
  await a.check("#si-list input >> nth=0");
  await a.waitForTimeout(150);
  await a.click("#savein button[value=close]");
  await a.click("#tb tr:nth-child(5) .star");
  await a.waitForSelector("#savein[open] #si-list input");
  await a.check("#si-list input >> nth=0");
  await a.waitForTimeout(150);
  await a.click("#savein button[value=close]");
  // com um projeto só, tocar de novo na estrela tira direto
  await a.click("#tb tr:nth-child(5) .star");
  await a.waitForTimeout(150);
  console.log("removeu direto:", await a.textContent("#toast"));
  await a.click("#tb tr:nth-child(5) .star");
  await a.waitForSelector("#savein[open] #si-list input");
  await a.check("#si-list input >> nth=0");
  await a.waitForTimeout(150);
  await a.click("#savein button[value=close]");
  await a.waitForTimeout(100);
  console.log("toast:", await a.textContent("#toast"));
  console.log("salvos no db:", await a.evaluate(() => window.__db.saved_festivals.map((r) => r.festival_name)));
  await a.click("#s-mine");
  console.log("aba salvos:", await a.textContent("#count"), "|", await a.textContent("#s-mine"));
  await a.screenshot({ path: `${out}/logged.png`, fullPage: false });
  // planilha dos salvos (.xlsx gerada no navegador)
  const [xl] = await Promise.all([a.waitForEvent("download"), a.click("#mine-xlsx")]);
  await xl.saveAs(`${out}/salvos.xlsx`);
  console.log("planilha:", xl.suggestedFilename(), require("fs").statSync(`${out}/salvos.xlsx`).size, "bytes");
  await a.locator("#mine-bar").screenshot({ path: `${out}/mine-bar.png` });
  await a.click("#open-profile");
  await a.click("#pf-days label:has-text('14 dias')");
  await a.waitForTimeout(100);
  console.log("perfil:", JSON.stringify(await a.evaluate(() => window.__db.profiles[0])), "|", await a.textContent("#pf-status"));
  await a.screenshot({ path: `${out}/profile.png` });
  await a.click("#profile button[value=close]");
  await a.click("[data-s='mine']"); // desliga o filtro de salvos (botões rápidos funcionam como liga/desliga)
  await a.click("#open-profile");
  console.log("botão salvos:", await a.textContent("#pf-saved"));
  await a.click("#pf-saved");
  await a.waitForTimeout(400);
  console.log("após clicar:", await a.textContent("#count"), "| diálogo aberto:", await a.evaluate(() => document.querySelector("#profile").open));

  // ——— v2: filtros novos, ficha, acompanhamento, agenda ———
  const v = await ctx.newPage();
  v.on("pageerror", (e) => errors.push(e.message));
  await v.goto("http://localhost:8889/");
  await v.waitForSelector("#tb td.name");
  if (await v.isHidden("#adv")) await v.click("#adv-toggle");
  await v.click("#quals label:has-text('BAFTA')");
  console.log("BAFTA:", await v.textContent("#count"));
  await v.check("#nopremiere");
  console.log("BAFTA + sem estreia:", await v.textContent("#count"), await v.locator("#tb td.name .fname").allTextContents());
  await v.click("#adv-clear");
  await v.check("#free");
  console.log("gratuitos:", await v.textContent("#count"));
  await v.click("#adv-clear");
  await v.screenshot({ path: `${out}/v2-adv.png`, clip: { x: 0, y: 700, width: 1280, height: 420 } });
  // ficha: clicar na linha (fora do link)
  await v.locator("#tb tr", { hasText: "Locarno" }).locator("td.ev").click();
  await v.waitForSelector("#detail[open]");
  console.log("ficha:", await v.textContent("#dt-title"), "|", (await v.textContent("#dt-body")).replace(/\s+/g, " ").slice(0, 220));
  await v.screenshot({ path: `${out}/v2-detail.png` });
  await v.click("#dt-save"); // abre login simulado
  await v.waitForSelector("#open-profile");
  await v.waitForTimeout(200);
  if (!(await v.isVisible("#detail[open]"))) { await v.locator("#tb tr", { hasText: "Locarno" }).locator("td.ev").click(); }
  if (!(await v.textContent("#dt-save")).includes("Salvo")) await v.click("#dt-save");
  await v.waitForSelector("#savein[open]");
  await v.click("#si-new");
  await v.fill("#si-name", "Meu projeto");
  await v.click("#si-create");
  await v.waitForTimeout(150);
  await v.click("#savein button[value=close]");
  await v.waitForSelector("#dt-track");
  await v.selectOption("#dt-track", "inscrito");
  await v.waitForTimeout(200);
  console.log("status db:", await v.evaluate(() => JSON.stringify(window.__db.saved_festivals.map((r) => [r.festival_id, r.status]))));
  console.log("toast:", await v.textContent("#toast"));
  const [dl] = await Promise.all([v.waitForEvent("download"), v.click("#dt-ics")]);
  const ics = require("fs").readFileSync(await dl.path(), "utf8");
  console.log("ics:", dl.suggestedFilename(), ics.split("\r\n").filter((l) => /^(DTSTART|SUMMARY|DESCRIPTION)/.test(l)).join(" | ").slice(0, 300));
  console.log("google:", await v.getAttribute("#dt-actions a:has-text('Google Agenda')", "href"));
  await v.screenshot({ path: `${out}/v2-detail-logged.png` });
  await v.click("#dt-close");
  console.log("linha com situação:", await v.locator("#tb tr", { hasText: "Locarno" }).locator(".mystatus").textContent());

  // ——— v3: busca salva, agenda assinável, aviso de mudança ———
  const w = await ctx.newPage();
  w.on("pageerror", (e) => errors.push(e.message));
  await w.goto("http://localhost:8889/?g=Documentário&br=1");
  await w.waitForSelector("#tb td.name");
  await w.click("#login");
  await w.waitForSelector("#open-profile");
  await w.waitForSelector("#save-search:not([hidden])");
  await w.click("#save-search");
  await w.waitForTimeout(150);
  console.log("busca salva:", await w.evaluate(() => JSON.stringify(window.__db.saved_searches.map((x) => [x.label, x.params]))), "|", await w.textContent("#save-search"));
  assert.equal(await w.evaluate(() => window.__db.saved_searches.length), 1);
  // tocar de novo em "★ Busca salva" remove; e salva outra vez para seguir o teste
  await w.click("#save-search");
  await w.waitForTimeout(150);
  console.log("remover busca:", await w.textContent("#toast"), "|", await w.textContent("#save-search"));
  assert.equal(await w.evaluate(() => window.__db.saved_searches.length), 0);
  await w.click("#save-search");
  await w.waitForTimeout(150);
  await w.click("#account #nav-saved");
  await w.waitForSelector("#searches:not([hidden])");
  console.log("lista de buscas:", (await w.textContent("#searches-list")).replace(/\s+/g, " ").trim());
  await w.click("#searches-list .ss-notify");
  await w.waitForTimeout(100);
  assert.equal(await w.evaluate(() => window.__db.saved_searches[0].notify), false);
  await w.click("#mine-cal");
  await w.waitForSelector("#agenda[open]");
  const agUrl = await w.inputValue("#ag-url");
  console.log("agenda:", agUrl, "|", await w.getAttribute("#ag-apple", "href"));
  assert.match(agUrl, /\/agenda\/[a-f0-9]{32}\.ics$/);
  await w.screenshot({ path: `${out}/v3-agenda.png` });
  await w.click("#agenda button[value=close]");
  await w.locator("#mine-bar").screenshot({ path: `${out}/v3-mine-bar.png` });
  await w.click("#open-profile");
  await w.uncheck("#pf-changes");
  await w.waitForTimeout(100);
  assert.equal(await w.evaluate(() => window.__db.profiles[0].change_alerts), false);
  await w.screenshot({ path: `${out}/v3-profile.png` });

  // ——— v4: filmes, rótulos de requisitos, checklist, notas, estreia, calendário, relatório ———
  const z = await ctx.newPage();
  z.on("pageerror", (e) => errors.push(e.message));
  await z.goto("http://localhost:8889/");
  await z.waitForSelector("#tb td.name");
  await z.click("#login");
  await z.waitForSelector("#open-profile");
  // primeira estrela: pede o nome do projeto
  await z.locator("#tb tr", { hasText: "Curta Cinema" }).first().locator(".star").click();
  await z.waitForSelector("#savein[open] #si-list input");
  await z.click("#si-new");
  await z.fill("#si-name", "Meu projeto");
  await z.screenshot({ path: `${out}/v4-novo-projeto.png` });
  await z.click("#si-create");
  await z.waitForTimeout(200);
  await z.click("#savein button[value=close]");
  for (const n of ["Go Short", "Festival de Cannes: Competição"]) {
    await z.locator("#tb tr", { hasText: n }).first().locator(".star").click();
    await z.waitForSelector("#savein[open]");
    await z.check("#si-list input >> nth=1");
    await z.waitForTimeout(150);
    await z.click("#savein button[value=close]");
  }
  await z.waitForTimeout(200);
  console.log("filmes:", await z.evaluate(() => JSON.stringify(window.__db.films.map((f) => f.title))), "| salvos:", await z.evaluate(() => window.__db.saved_festivals.filter((r) => r.film_id).length));
  await z.click("#account #nav-saved");
  await z.waitForSelector("#films:not([hidden])");
  await z.click("#film-edit");
  await z.fill("#fm-name", "Cuidado com o que deseja");
  await z.fill("#fm-dur", "14");
  await z.selectOption("#fm-genre", "Ficção");
  await z.click("#film-form button.btn:not(.ghost)");
  await z.waitForTimeout(200);
  const fits = await z.locator("#tb .fit").allTextContents();
  console.log("rótulos:", fits);
  assert.ok(fits.some((t) => t.startsWith("Fora dos requisitos")), "Go Short deve aparecer fora dos requisitos");
  await z.locator("#tb tr", { hasText: "Curta Cinema" }).first().locator("td.ev").click();
  await z.waitForSelector("#detail[open] #in-ck");
  await z.check("#in-ck input[data-i='0']");
  await z.fill("#in-notes", "Senha do link: teste");
  await z.locator("#in-notes").blur();
  await z.waitForTimeout(150);
  await z.selectOption("#dt-track", "selecionado");
  await z.waitForTimeout(250);
  console.log("estreia:", (await z.textContent("#toast")).slice(0, 120));
  const row = await z.evaluate(() => JSON.stringify(window.__db.saved_festivals.find((r) => r.festival_id.startsWith("curta-cinema"))));
  console.log("linha salva:", row.slice(0, 200));
  assert.match(row, /Senha do link/);
  await z.screenshot({ path: `${out}/v4-ficha.png` });
  await z.click("#dt-close");
  await z.locator("#mine-bar").screenshot({ path: `${out}/v4-mine-bar.png` });
  await z.screenshot({ path: `${out}/v4-lista.png`, fullPage: false });
  await z.click("[data-view='cal']");
  await z.waitForSelector("#calview:not([hidden]) .cal");
  await z.locator("#calview").screenshot({ path: `${out}/v4-calendario.png` });
  await z.click("[data-view='list']");
  const [rep] = await Promise.all([z.waitForEvent("popup"), z.click("#mine-report")]);
  await rep.waitForLoadState();
  console.log("relatório:", (await rep.textContent("h1")), "|", (await rep.textContent(".sum")).replace(/\s+/g, " "));
  await rep.screenshot({ path: `${out}/v4-relatorio.png`, fullPage: true });
  await rep.close();
  // segundo filme: a estrela abre "Salvar em…"
  await z.click("#film-new");
  await z.fill("#fm-name", "Curta do baterista");
  await z.selectOption("#fm-genre", "Documentário");
  await z.click("#film-form button.btn:not(.ghost)");
  await z.waitForTimeout(150);
  await z.click("#mine-all");
  await z.waitForTimeout(150);
  await z.locator("#tb tr", { hasText: "Curta Cinema" }).first().locator(".star").click();
  await z.waitForSelector("#savein[open]");
  await z.screenshot({ path: `${out}/v4-salvar-em.png` });
  await z.check("#si-list input >> nth=2");
  await z.waitForTimeout(200);
  const nrows = await z.evaluate(() => window.__db.saved_festivals.filter((r) => r.festival_id === "curta-cinema").length);
  console.log("Curta Cinema em", nrows, "filmes");
  assert.equal(nrows, 2);
  await z.click("#savein button[value=close]");
  // mover Go Short do primeiro projeto para o segundo, levando as notas
  await z.click("#account #nav-saved");
  await z.waitForTimeout(150);
  await z.click("#films [data-film] >> nth=0");
  await z.waitForTimeout(150);
  await z.locator("#tb tr", { hasText: "Go Short" }).first().locator("td.ev").click();
  await z.waitForSelector("#detail[open] #in-move");
  await z.fill("#in-notes", "nota que vai junto");
  await z.locator("#in-notes").blur();
  await z.waitForTimeout(150);
  await z.locator("#detail .move").screenshot({ path: `${out}/v4-mover.png` });
  await z.selectOption("#in-move", { label: "Curta do baterista" });
  await z.waitForTimeout(200);
  console.log("mover:", await z.textContent("#toast"));
  const moved = await z.evaluate(() => { const b = window.__db.films.find((f) => f.title === "Curta do baterista"); return window.__db.saved_festivals.filter((r) => r.festival_id.startsWith("go-short")).map((r) => [r.film_id === b.id, r.notes]); });
  console.log("go short:", JSON.stringify(moved));
  assert.deepEqual(moved, [[true, "nota que vai junto"]]);
  // apagar o último projeto também é possível
  await z.click("#films [data-film] >> nth=1");
  await z.waitForTimeout(150);
  await z.click("#film-edit");
  z.once("dialog", (d) => d.accept());
  await z.click("#fm-del");
  await z.waitForTimeout(200);
  z.once("dialog", (d) => d.accept());
  await z.click("#film-edit");
  await z.click("#fm-del");
  await z.waitForTimeout(200);
  console.log("projetos depois de apagar:", await z.evaluate(() => JSON.stringify(window.__db.films.map((f) => f.title))));
  assert.equal(await z.evaluate(() => window.__db.films.length), 0);
  await z.click("#mine-all");
  await z.waitForTimeout(150);
  // "Para acompanhar": sem situação nem checklist; dá para criar um projeto e mover
  await z.locator("#tb tr", { hasText: "Curta Cinema" }).first().locator(".star").click();
  await z.waitForSelector("#savein[open] #si-list input");
  await z.check("#si-list input >> nth=0");
  await z.waitForTimeout(150);
  await z.click("#savein button[value=close]");
  await z.click("#account #nav-saved");
  await z.waitForTimeout(150);
  await z.locator("#mine-bar").screenshot({ path: `${out}/v4-acompanhar.png` });
  await z.locator("#tb tr", { hasText: "Curta Cinema" }).first().locator("td.ev").click();
  await z.waitForSelector("#detail[open] #in-newproj");
  assert.equal(await z.isVisible("#dt-track"), false);
  assert.equal(await z.isVisible("#in-ck"), false);
  await z.fill("#in-notes", "ver categoria doc");
  await z.locator("#in-notes").blur();
  await z.waitForTimeout(150);
  await z.fill("#in-newproj", "Fala Comigo");
  await z.screenshot({ path: `${out}/v4-acompanhar-ficha.png` });
  await z.click("#in-newproj-go");
  await z.waitForTimeout(250);
  console.log("acompanhar → projeto:", await z.textContent("#toast"));
  const mv = await z.evaluate(() => { const p = window.__db.films.find((f) => f.title === "Fala Comigo"); const ids = new Set(window.__db.films.map((f) => f.id)); return window.__db.saved_festivals.filter((r) => r.festival_id.startsWith("curta-cinema") && ids.has(r.film_id)).map((r) => [r.film_id === p.id, r.notes]); });
  assert.deepEqual(mv, [[true, "ver categoria doc"]]);
  await z.click("#mine-all");

  // filtro "Fecham em 30 dias" e "Mostrar mais"
  await z.click("[data-s='hot']");
  console.log("fecham em 30 dias:", await z.textContent("#count"), "| mostrar mais visível:", await z.isVisible("#more"));
  await z.click("[data-s='hot']");
  await z.evaluate(() => { window.__lim = true; });

  console.log("erros JS:", errors);
  assert.equal(errors.length, 0);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
