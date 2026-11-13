// Teste de interface da equipe do projeto (migração 5), com Supabase simulado.
// Uso: node tests/preview-server.mjs 8889 --auth & node tests/e2e-equipe.cjs [pasta-das-capturas]
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const USERS = {
  ana: { id: "u-ana", email: "ana@example.com", user_metadata: { full_name: "Ana Elisa" } },
  felipe: { id: "u-felipe", email: "felipe@example.com", user_metadata: { full_name: "Felipe Monteiro" } },
  outra: { id: "u-outra", email: "outra@example.com", user_metadata: { full_name: "Felipe (outra conta)" } },
};

// Banco simulado compartilhado entre as páginas (fica no Node; o navegador fala com ele por window.__db*)
const DB = {
  profiles: Object.values(USERS).map((u) => ({ id: u.id, email: u.email, full_name: u.user_metadata.full_name, email_opt_in: true, reminder_days: [30, 7, 1], change_alerts: true, calendar_token: null })),
  films: [{ id: "f1", user_id: "u-ana", title: "Cuidado com o que deseja", duration_min: 14, genre: "Ficção", finished_on: null, premiere_status: "inedito", country: "Brasil", general: false }],
  saved_festivals: [{ user_id: "u-ana", film_id: "f1", festival_id: "curta-cinema", festival_name: "Curta Cinema", status: "quero", notes: null, checklist: null, award: null }],
  saved_searches: [], film_members: [], film_invites: [], festival_notes: [],
};

const FAKE = `
let session = window.__USER ? { user: window.__USER, access_token: "t-" + window.__USER.id } : null, listeners = [];
const me = () => session?.user?.id;
const role = (fid) => { const f = window.__dbGet().films.find((x) => x.id === fid); if (!f) return null; if (f.user_id === me()) return "dono"; const m = window.__dbGet().film_members.find((x) => x.film_id === fid && x.user_id === me()); return m ? m.role : null; };
const visible = {
  films: (r) => r.user_id === me() || role(r.id),
  saved_festivals: (r) => r.user_id === me() || role(r.film_id),
  festival_notes: (r) => r.user_id === me() || (r.shared && role(r.film_id)),
  film_members: (r) => role(r.film_id),
};
function q(table) {
  let filters = [], op = "select", payload = null;
  const api = {
    select() { return api; }, order() { return api; },
    eq(k, v) { filters.push([k, v]); return api; },
    insert(row) { op = "insert"; payload = row; return api; },
    delete() { op = "delete"; return api; },
    update(p) { op = "update"; payload = p; return api; },
    maybeSingle() { api._single = true; return api; }, single() { api._single = true; return api; },
    then(res, rej) {
      const db = window.__dbGet();
      if (!db[table]) return Promise.resolve({ data: null, error: { message: "relation does not exist" } }).then(res, rej);
      const vis = visible[table] || (() => true);
      const match = (r) => vis(r) && filters.every(([k, v]) => r[k] === v);
      let data = null;
      if (op === "select") { data = db[table].filter(match); if (api._single) data = data[0] || null; }
      if (op === "insert") { const row = { id: "n" + String(Math.random()).slice(2, 8), shared: false, created_at: new Date().toISOString(), ...payload }; db[table].push(row); data = api._single ? row : [row]; }
      if (op === "delete") db[table] = db[table].filter((r) => !match(r));
      if (op === "update") { db[table].filter(match).forEach((r) => Object.assign(r, payload)); if (api._single) data = db[table].filter(match)[0] || null; }
      window.__dbSet(db);
      return Promise.resolve({ data, error: null }).then(res, rej);
    },
  };
  return api;
}
function rpc(name, args = {}) {
  const db = window.__dbGet();
  const email = session?.user?.email;
  let data = null, error = null;
  if (name === "my_invites") data = db.film_invites.filter((i) => i.email === email).map((i) => ({ id: i.id, film_id: i.film_id, film_title: db.films.find((f) => f.id === i.film_id).title, role: i.role, inviter: "Ana Elisa" }));
  if (name === "invite_info") { const i = db.film_invites.find((x) => x.id === args.p_id); data = i ? [{ film_title: db.films.find((f) => f.id === i.film_id).title, inviter: "Ana Elisa", email_hint: i.email.slice(0, 2) + "•••@" + i.email.split("@")[1], mine: i.email === email }] : []; }
  if (name === "accept_invite") {
    const i = db.film_invites.find((x) => x.id === args.p_id);
    if (!i || i.email !== email) error = { message: "Este convite é para outro e-mail." };
    else { db.film_members.push({ film_id: i.film_id, user_id: me(), role: i.role, remind: args.p_remind, changes: args.p_changes, activity: args.p_activity }); db.film_invites = db.film_invites.filter((x) => x.id !== i.id); data = i.film_id; }
  }
  if (name === "decline_invite") db.film_invites = db.film_invites.filter((x) => x.id !== args.p_id);
  if (name === "film_team") {
    const f = db.films.find((x) => x.id === args.p_film), p = (id) => db.profiles.find((x) => x.id === id);
    data = [{ kind: "dono", user_id: f.user_id, name: p(f.user_id).full_name, email: p(f.user_id).email, role: "dono" },
      ...db.film_members.filter((m) => m.film_id === f.id && m.role !== "dono").map((m) => ({ kind: "membro", user_id: m.user_id, name: p(m.user_id).full_name, email: p(m.user_id).email, role: m.role })),
      ...db.film_invites.filter((i) => i.film_id === f.id).map((i) => ({ kind: "convite", invite_id: i.id, email: i.email, role: i.role }))];
  }
  window.__dbSet(db);
  return Promise.resolve({ data, error });
}
export function createClient() {
  return {
    from: q, rpc,
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => listeners.push(cb),
      signInWithOAuth: async () => { session = { user: window.__NEXT_USER, access_token: "t" }; listeners.forEach((l) => l("SIGNED_IN", session)); },
      signOut: async () => { session = null; listeners.forEach((l) => l("SIGNED_OUT", null)); },
    },
  };
}`;

(async () => {
  const browser = await chromium.launch();
  const out = process.argv[2] || "/tmp";
  const errors = [];
  let db = JSON.parse(JSON.stringify(DB));

  async function open(user, path = "/", next = null) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.exposeFunction("__dbSync", (d) => { db = d; });
    await ctx.addInitScript(({ u, n, d }) => {
      window.__USER = u; window.__NEXT_USER = n; let local = d;
      window.__dbGet = () => local; window.__dbSet = (x) => { local = x; window.__dbSync(x); };
    }, { u: user, n: next, d: db });
    await ctx.route("https://esm.sh/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
    await ctx.route(/frankfurter/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ date: "2026-11-12", rates: { EUR: 0.16, USD: 0.185 } }) }));
    await ctx.route("**/api/equipe", async (r) => {
      const body = JSON.parse(r.request().postData());
      const id = require("node:crypto").randomUUID();
      // o servidor grava o convite no banco compartilhado
      await page.evaluate(({ b, id }) => { const d = window.__dbGet(); if (!d.film_members.some((m) => m.film_id === b.film_id && m.role === "dono")) d.film_members.push({ film_id: b.film_id, user_id: "u-ana", role: "dono", remind: true, changes: true, activity: false }); d.film_invites.push({ id, film_id: b.film_id, email: b.email, role: b.role }); window.__dbSet(d); }, { b: body, id });
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, invite: { id, email: body.email, role: body.role } }) });
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(`http://localhost:8889${path}`);
    return page;
  }

  // 1) Ana convida o Felipe como editor
  let a = await open(USERS.ana);
  await a.waitForSelector("#open-profile");
  await a.click("#nav-saved");
  await a.waitForSelector("#film-team");
  assert.match(await a.textContent("#film-team"), /Convidar equipe/);
  await a.click("#film-team");
  await a.waitForSelector("#team[open]");
  await a.fill("#tm-email", "felipe@example.com");
  await a.click('#team .seg label:has-text("Apenas visualização")');
  assert.match(await a.textContent("#tm-role-help"), /sem alterar/);
  await a.click('#team .seg label:has-text("Editor")');
  await a.click("#tm-send");
  await a.waitForFunction(() => /Convite enviado/.test(document.querySelector("#tm-status").textContent));
  await a.waitForFunction(() => /aguardando/.test(document.querySelector("#tm-list").textContent));
  console.log("equipe da Ana:", (await a.textContent("#tm-list")).replace(/\s+/g, " ").trim());
  await a.screenshot({ path: `${out}/equipe-1-convite.png` });
  await a.click('#team button[value="close"]');
  // Ana escreve duas notas: uma privada e uma compartilhada
  await a.click('#tb tr:has-text("Curta Cinema") td.name');
  await a.waitForSelector("#detail[open] #nt-add");
  await a.fill("#nt-new", "Senha do link: guardar no cofre");
  await a.click('#nt-add button');
  await a.waitForSelector('#nt-list .nt');
  await a.fill("#nt-new", "Mandar a versão com legenda em inglês");
  await a.click('#nt-add button');
  await a.waitForFunction(() => document.querySelectorAll("#nt-list .nt").length === 2);
  await a.click('#nt-list .nt:nth-child(2) [data-act="share"]');
  await a.waitForFunction(() => /Compartilhada/.test(document.querySelector("#nt-list").textContent));
  await a.screenshot({ path: `${out}/equipe-2-notas.png` });
  await a.context().close();

  const inviteId = db.film_invites[0].id;

  // 2) Felipe abre o link sem estar logado, entra com outra conta: aviso de conta errada
  let w = await open(null, `/?convite=${inviteId}`, USERS.outra);
  await w.waitForSelector("#invite[open]");
  assert.match(await w.textContent("#iv-title"), /Entre para aceitar/);
  await w.click("#iv-accept");
  await w.waitForFunction(() => /outra conta/.test(document.querySelector("#iv-title")?.textContent || ""));
  console.log("conta errada:", (await w.textContent("#iv-err")).trim());
  await w.screenshot({ path: `${out}/equipe-3-conta-errada.png` });
  await w.context().close();

  // 3) Felipe entra com a conta certa e aceita
  let f = await open(null, `/?convite=${inviteId}`, USERS.felipe);
  await f.waitForSelector("#invite[open]");
  await f.click("#iv-accept");
  await f.waitForFunction(() => /Aceitar/.test(document.querySelector("#iv-accept").textContent));
  await f.screenshot({ path: `${out}/equipe-4-aceitar.png` });
  await f.click("#iv-activity");
  await f.click("#iv-accept");
  await f.waitForFunction(() => /Ver equipe/.test(document.querySelector("#film-team")?.textContent || ""));
  console.log("membros:", JSON.stringify(db.film_members));
  console.log("faixa do Felipe:", (await f.textContent("#films")).replace(/\s+/g, " ").trim());
  await f.click('#tb tr:has-text("Curta Cinema") td.name');
  await f.waitForSelector("#detail[open] #nt-list");
  const notes = await f.textContent("#nt-list");
  console.log("notas que o Felipe vê:", notes.replace(/\s+/g, " ").trim());
  assert.match(notes, /legenda/);
  assert.doesNotMatch(notes, /Senha/);
  assert.ok(await f.$("#dt-track"), "editor muda a situação");
  await f.fill("#nt-new", "Falar com a distribuidora antes de inscrever");
  await f.click("#nt-add button");
  await f.waitForSelector(".nt-hint");
  await (await f.$("#nt-list")).scrollIntoViewIfNeeded();
  await f.screenshot({ path: `${out}/equipe-nota-nova.png` });
  await f.screenshot({ path: `${out}/equipe-5-felipe.png` });
  await f.click("#dt-close");
  await f.click("#film-team");
  await f.waitForFunction(() => /Felipe Monteiro/.test(document.querySelector("#tm-list").textContent));
  assert.ok(await f.isHidden("#tm-invite"));
  assert.ok(await f.isVisible("#tm-leave"));
  await f.screenshot({ path: `${out}/equipe-6-ver-equipe.png` });
  await f.context().close();

  // 3b) Ana compartilha uma nota nova depois da última visita do Felipe: selo "nota nova" na lista e na ficha
  db.festival_notes.push({ id: "nn1", film_id: "f1", festival_id: "curta-cinema", user_id: "u-ana", author_name: "Ana Elisa", body: "A curadoria confirmou: pode mandar a cópia de trabalho na inscrição.", shared: true, created_at: new Date(Date.now() - 60000).toISOString(), updated_at: new Date(Date.now() - 60000).toISOString() });
  f = await open(USERS.felipe);
  await f.evaluate(() => localStorage.setItem("rdf-notas-vistas:u-felipe", JSON.stringify({ _base: new Date(Date.now() - 3600000).toISOString() })));
  await f.reload();
  await f.waitForSelector("#open-profile");
  await f.click("#nav-saved");
  await f.waitForSelector(".insc-badge.note-new");
  await (await f.$('#tb tr:has-text("Curta Cinema")')).scrollIntoViewIfNeeded();
  await f.screenshot({ path: `${out}/equipe-nota-nova-lista.png` });
  await f.click('#tb tr:has-text("Curta Cinema") td.name');
  await f.waitForSelector(".nt.fresh");
  await (await f.$(".nt.fresh")).scrollIntoViewIfNeeded();
  await f.screenshot({ path: `${out}/equipe-nota-nova-ficha.png` });
  await f.click("#dt-close");
  await f.waitForFunction(() => !document.querySelector(".insc-badge.note-new"));
  await f.context().close();

  // 4) Ana muda o Felipe para apenas visualização; ele perde a edição
  a = await open(USERS.ana);
  await a.waitForSelector("#open-profile");
  await a.click("#nav-saved");
  await a.click("#film-team");
  await a.waitForFunction(() => document.querySelector('#tm-list select[data-k^="m:"]'));
  await a.selectOption('#tm-list select[data-k^="m:"]', "leitor");
  await a.waitForFunction(() => /Perfil alterado/.test(document.querySelector("#tm-status").textContent));
  await a.context().close();
  f = await open(USERS.felipe);
  await f.waitForSelector("#open-profile");
  await f.click("#nav-saved");
  await f.waitForSelector("#film-team");
  await f.click('#tb tr:has-text("Curta Cinema") td.name');
  await f.waitForSelector("#detail[open] .ro-msg");
  assert.ok(!(await f.$("#dt-track")), "apenas visualização não muda a situação");
  assert.ok(await f.$("#nt-add"), "apenas visualização escreve notas próprias");
  await f.screenshot({ path: `${out}/equipe-7-leitor.png` });
  await f.context().close();

  console.log("erros JS:", errors);
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
