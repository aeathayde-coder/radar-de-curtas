// Radar de Festivais — front-end (sem build). Dados: site/dados/festivais.csv. Conta: Supabase + Google.
import CONFIG from "./config.js";
import { loadSheet } from "./sheet.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const GENRE_ORDER = ["Ficção", "Documentário", "Animação", "Experimental", "Videoclipe", "Fantástico"];
const REMINDER_OPTIONS = [30, 14, 7, 3, 1];
const QUAL_ORDER = ["Oscar", "BAFTA", "EFA", "Goya"];
const QUAL_LABEL = { Oscar: "Oscar", BAFTA: "BAFTA", EFA: "European Film Awards", Goya: "Goya" };
// Acompanhamento dos festivais salvos (como no FilmFreeway / Short Film Depot)
const TRACK = [
  ["quero", "Quero inscrever"],
  ["inscrito", "Inscrito"],
  ["selecionado", "Selecionado"],
  ["nao_selecionado", "Não selecionado"],
];
const TRACK_LABEL = Object.fromEntries(TRACK);
const MS = 86400000;

const now = new Date();
const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
const days = (iso) => Math.round((new Date(iso + "T12:00:00") - TODAY) / MS);
const fmt = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES[m - 1]} ${y}`;
};

// ——— estado ———
const S = {
  all: [],
  r: "all", s: "all", q: "", genres: new Set(), country: "", dur: null, unknown: true,
  quals: new Set(), themes: new Set(), free: false, noPremiere: false,
  sortKey: "deadline", sortDir: 1,
  sb: null, user: null, profile: null, saved: new Set(), track: new Map(), trackSupported: false,
};

function status(f) {
  if (!f.deadline) return { k: "est", label: "a confirmar", rank: 3 };
  const d = days(f.deadline);
  if (d < 0) return { k: "off", label: "encerrado", rank: 4 };
  if (f.dateStatus === "Confirmada") {
    if (d <= 30) return { k: "hot", label: d === 0 ? "hoje" : `faltam ${d} dia${d === 1 ? "" : "s"}`, rank: 0 };
    return { k: "ok", label: `confirmado · ${d} d`, rank: 1 };
  }
  return { k: "est", label: `estimativa · ~${d} d`, rank: 2 };
}

// ——— URL ⇄ filtros (busca compartilhável) ———
function readURL() {
  const p = new URLSearchParams(location.search);
  if (["BR", "INT"].includes(p.get("r"))) S.r = p.get("r");
  if (["open", "est", "mine"].includes(p.get("s"))) S.s = p.get("s");
  S.q = p.get("q") || "";
  (p.get("g") || "").split(",").filter(Boolean).forEach((g) => S.genres.add(g));
  S.country = p.get("pais") || "";
  const dur = parseInt(p.get("dur"), 10);
  S.dur = dur > 0 ? dur : null;
  S.unknown = p.get("inc") !== "0";
  (p.get("ql") || "").split(",").filter((q) => QUAL_ORDER.includes(q)).forEach((q) => S.quals.add(q));
  (p.get("tema") || "").split(",").filter(Boolean).forEach((t) => S.themes.add(t));
  S.free = p.get("gratis") === "1";
  S.noPremiere = p.get("semestreia") === "1";
}
function writeURL() {
  const p = new URLSearchParams();
  if (S.r !== "all") p.set("r", S.r);
  if (S.s !== "all") p.set("s", S.s);
  if (S.q) p.set("q", S.q);
  if (S.genres.size) p.set("g", [...S.genres].join(","));
  if (S.country) p.set("pais", S.country);
  if (S.dur) p.set("dur", S.dur);
  if (!S.unknown) p.set("inc", "0");
  if (S.quals.size) p.set("ql", [...S.quals].join(","));
  if (S.themes.size) p.set("tema", [...S.themes].join(","));
  if (S.free) p.set("gratis", "1");
  if (S.noPremiere) p.set("semestreia", "1");
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// ——— filtros ———
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Palavras que as pessoas usam na busca → termos que existem na base (sem acento, minúsculas)
const SYNONYMS = {
  terror: ["fantastico"], horror: ["fantastico"], suspense: ["fantastico"], thriller: ["fantastico"],
  "sci-fi": ["fantastico"], scifi: ["fantastico"], fantasia: ["fantastico"], genero: ["fantastico"],
  doc: ["documentario"], docs: ["documentario"], documentarios: ["documentario"], "nao-ficcao": ["documentario"],
  animado: ["animacao"], animacoes: ["animacao"], animation: ["animacao"],
  clipe: ["videoclipe"], clip: ["videoclipe"],
  experimentais: ["experimental"], videoarte: ["experimental"],
  fiction: ["ficcao"], ficcoes: ["ficcao"],
  gratis: ["gratuito", "gratis"], gratuita: ["gratuito"], free: ["gratuito"],
  usa: ["eua"], germany: ["alemanha"], netherlands: ["holanda"], holland: ["holanda"],
};
// Cada termo da busca vira uma lista de alternativas aceitas
const queryTerms = (q) => norm(q).split(/[^a-z0-9$€£-]+/).filter(Boolean).map((t) => [t, ...(SYNONYMS[t] || [])]);

// "Gratuito": taxa ou observação dizem que a inscrição é grátis (inclui gratuito só para brasileiros)
const isFree = (f) => /\b(gratuit|gr[aá]tis|isent|free)/i.test(`${f.fee || ""} ${f.notes || ""}`);
const noPremiere = (f) => /n[aã]o exige|sem exig|n[aã]o requer/i.test(f.premiere || "");

function matches(f) {
  if (S.r !== "all" && f.scope !== S.r) return false;
  const st = f._st;
  if (S.s === "open" && !(st.k === "ok" || st.k === "hot")) return false;
  if (S.s === "est" && st.k !== "est") return false;
  if (S.s === "mine" && !S.saved.has(f.id)) return false;
  if (S.country && f.country !== S.country) return false;
  if (S.genres.size) {
    if (!f.genres.length) { if (!S.unknown) return false; }
    else if (!f.genres.some((g) => S.genres.has(g))) return false;
  }
  if (S.dur) {
    if (f.maxDuration == null) { if (!S.unknown) return false; }
    else if (f.maxDuration < S.dur) return false;
  }
  if (S.quals.size && !f.qualifies.some((q) => S.quals.has(q))) return false;
  if (S.themes.size && !f.themes.some((t) => S.themes.has(t))) return false;
  if (S.free && !isFree(f)) return false;
  if (S.noPremiere && !noPremiere(f)) return false;
  if (S.q) {
    // Cada termo precisa casar com o começo de alguma palavra ("rio" acha Rio de Janeiro, não "documentário")
    const words = (f._words ||= norm([f.name, f.local, f.country, f.region, f.fee, f.benefit, f.event, f.genres.join(" "), f.qualifies.join(" "), f.themes.join(" "), f.notes, f.restrictions, f.premiere].join(" ")).split(/[^a-z0-9$€£]+/).filter(Boolean));
    if (!queryTerms(S.q).every((alts) => alts.some((t) => words.some((w) => w.startsWith(t))))) return false;
  }
  return true;
}

function sorter(a, b) {
  let v;
  if (S.sortKey === "status") v = a._st.rank - b._st.rank || (a.deadline || "9").localeCompare(b.deadline || "9");
  else if (S.sortKey === "deadline") v = (a.deadline || "9999").localeCompare(b.deadline || "9999");
  else if (S.sortKey === "event") v = String(a.event || "~").localeCompare(String(b.event || "~"), "pt");
  else v = a.name.localeCompare(b.name, "pt");
  return v * S.sortDir;
}

// ——— render ———
function renderStrip() {
  const el = $("#strip");
  const list = S.all.filter((f) => f.deadline && days(f.deadline) >= 0 && days(f.deadline) <= 90);
  if (!list.length) { el.innerHTML = `<p class="muted">Nenhum prazo nos próximos 90 dias.</p>`; return; }
  el.innerHTML = list
    .map((f) => {
      const d = days(f.deadline);
      const confirmed = f.dateStatus === "Confirmada";
      const tag = f.url ? "a" : "div";
      const href = f.url ? ` href="${esc(f.url)}" target="_blank" rel="noopener"` : "";
      return `<${tag} class="tick${d <= 7 && confirmed ? " hot" : ""}"${href}>
        <span class="d">${fmt(f.deadline)}${confirmed ? "" : " · estimado"}</span>
        <span class="n">${esc(f.name)}</span>
        <span class="c">${d === 0 ? "hoje" : `em ${d} dia${d === 1 ? "" : "s"}`} · ${f.scope === "BR" ? "Brasil" : esc(f.country || f.local || "")}</span>
      </${tag}>`;
    })
    .join("");
}

function reqCell(f) {
  const flags = [];
  f.qualifies.forEach((q) => flags.push(`<span class="flag q" title="Qualifica para ${esc(QUAL_LABEL[q])}">${esc(q)}</span>`));
  if (f.maxDuration != null) flags.push(`<span class="flag dur">até ${f.maxDuration} min</span>`);
  f.genres.forEach((g) => flags.push(`<span class="flag">${esc(g)}</span>`));
  if (f.premiere) flags.push(`<span class="flag prem">estreia: ${esc(f.premiere.toLowerCase())}</span>`);
  if (f.restrictions) flags.push(`<span class="flag warn">${esc(f.restrictions)}</span>`);
  const lines = [];
  if (f.fee) lines.push(`Inscrição: ${esc(f.fee)}`);
  if (f.benefit) lines.push(esc(f.benefit));
  return `${flags.length ? `<div class="req">${flags.join("")}</div>` : ""}${lines.join("<br>") || (flags.length ? "" : "Requisitos não informados; ver regulamento.")}`;
}

function renderTable() {
  if (!S.loaded) return;
  const rows = S.all.filter(matches).sort(sorter);
  const logged = !!S.user;
  $("#tb").innerHTML = rows.length
    ? rows
        .map((f) => {
          const st = f._st;
          const saved = S.saved.has(f.id);
          const name = f.url
            ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>`
            : `<strong>${esc(f.name)}</strong>`;
          const sub =
            st.k === "off" ? `<span class="sub">aguardando próximo ciclo</span>`
            : f.deadline && f.dateStatus !== "Confirmada" ? `<span class="sub">projetado pela edição anterior</span>` : "";
          const tr = saved && S.trackSupported ? `<span class="mystatus">${esc(TRACK_LABEL[S.track.get(f.id)] || "Quero inscrever")}</span>` : "";
          return `<tr class="clickable" data-open="${esc(f.id)}">
            <td class="save"><button class="star" data-id="${esc(f.id)}" aria-pressed="${saved}" aria-label="${saved ? "Remover dos salvos" : "Salvar"}: ${esc(f.name)}" title="${logged ? (saved ? "Remover dos salvos" : "Salvar e receber lembrete") : "Entre com Google para salvar"}">${saved ? "★" : "☆"}</button></td>
            <td class="name">${name}<span class="loc">${esc(f.local || f.country || "")}</span>${tr}</td>
            <td class="mono dl-cell" data-label="Prazo">${f.deadline ? (f.dateStatus === "Confirmada" ? "" : "~") + fmt(f.deadline) : "a confirmar"}${sub}</td>
            <td class="st"><span class="pill p-${st.k}">${st.label}</span></td>
            <td class="ev" data-label="Próxima edição">${esc(f.event || "—")}</td>
            <td class="notes">${reqCell(f)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">${S.s === "mine" && !S.saved.size ? "Você ainda não salvou nenhum festival. Use a estrela ☆ ao lado do nome." : `Nenhum festival com esses filtros.${S.q ? " Tente outra palavra ou use a Busca avançada para filtrar por gênero, país e duração." : ""}`}</td></tr>`;
  $("#count").textContent = `${rows.length} de ${S.all.length} festivais`;
}

function syncControls() {
  $$("[data-r]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.r === S.r));
  $$("[data-s]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.s === S.s));
  $("#q").value = S.q;
  $$("#genres input").forEach((i) => (i.checked = S.genres.has(i.value)));
  $("#country").value = S.country;
  $("#dur").value = S.dur ?? "";
  $("#unknown").checked = S.unknown;
  $$("#quals input").forEach((i) => (i.checked = S.quals.has(i.value)));
  $$("#themes input").forEach((i) => (i.checked = S.themes.has(i.value)));
  $("#free").checked = S.free;
  $("#nopremiere").checked = S.noPremiere;
  $$("th[data-k]").forEach((th) =>
    th.setAttribute("aria-sort", th.dataset.k === S.sortKey ? (S.sortDir === 1 ? "ascending" : "descending") : "none"),
  );
}

function update() { syncControls(); syncAdvCount(); renderTable(); writeURL(); }

function buildAdvanced() {
  // Ordem fixa para os principais; qualquer gênero novo escrito na planilha entra depois, em ordem alfabética
  const used = new Set(S.all.flatMap((f) => f.genres));
  const extra = [...used].filter((g) => !GENRE_ORDER.includes(g)).sort((a, b) => a.localeCompare(b, "pt"));
  const genres = [...GENRE_ORDER.filter((g) => used.has(g)), ...extra];
  $("#genres").innerHTML = genres
    .map((g) => `<label class="chip"><input type="checkbox" value="${esc(g)}"><span>${esc(g)}</span></label>`)
    .join("");
  const chip = (v, label) => `<label class="chip"><input type="checkbox" value="${esc(v)}"><span>${esc(label || v)}</span></label>`;
  $("#quals").innerHTML = QUAL_ORDER.filter((q) => S.all.some((f) => f.qualifies.includes(q))).map((q) => chip(q, q === "EFA" ? "European Film Awards" : q)).join("");
  const themes = [...new Set(S.all.flatMap((f) => f.themes))].sort((a, b) => a.localeCompare(b, "pt"));
  $("#themes").innerHTML = themes.map((t) => chip(t)).join("");
  $("#themes-set").hidden = !themes.length;
  const countries = [...new Set(S.all.map((f) => f.country).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  $("#country").insertAdjacentHTML("beforeend", countries.map((c) => `<option>${esc(c)}</option>`).join(""));
  // Aberta por padrão em telas largas; no celular abre pelo botão (ou se a URL já trouxer filtros)
  if (S.genres.size || S.country || S.dur || !S.unknown || S.quals.size || S.themes.size || S.free || S.noPremiere || matchMedia("(min-width: 900px)").matches) toggleAdv(true);
}

function syncAdvCount() {
  const n = S.genres.size + S.quals.size + S.themes.size + (S.country ? 1 : 0) + (S.dur ? 1 : 0) + (S.unknown ? 0 : 1) + (S.free ? 1 : 0) + (S.noPremiere ? 1 : 0);
  const b = $("#adv-count");
  b.hidden = !n;
  b.textContent = n;
}

function toggleAdv(open) {
  $("#adv").hidden = !open;
  $("#adv-toggle").setAttribute("aria-expanded", open);
}

function renderHeader() {
  const checked = S.all.map((f) => f.checkedAt).filter(Boolean).sort().pop();
  $("#eyebrow").textContent = `Festivais de curta-metragem · Brasil e mundo${checked ? ` · atualizado em ${fmt(checked).replace(/^0/, "")}` : ""}`;
  $("#lede").textContent = `Um site brasileiro que reúne prazos e informações de ${S.all.length} festivais de curta-metragem de ${new Set(S.all.map((f) => f.country).filter(Boolean)).size} países, nacionais e internacionais. Busque por nome, gênero, país, duração e o que mais importar para o seu filme. Salve os festivais que fazem sentido para você, acompanhe tudo no seu perfil e receba lembretes por e-mail, no seu ritmo. Navegar é livre: o login só serve para salvar.`;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

// ——— conta (Supabase) ———
function renderAccount() {
  const el = $("#account");
  if (!S.sb) { el.innerHTML = ""; }
  if (!S.sb || !S.user) {
    if (S.s === "mine") S.s = "all";
    $("#s-mine").hidden = true;
  }
  if (!S.sb) return;
  if (!S.user) {
    el.innerHTML = `<span class="login-hint">Salve festivais e receba lembretes de prazo</span><button class="btn" id="login">Entrar com Google</button>`;
    $("#login").onclick = login;
    $("#s-mine").hidden = true;
    if (S.s === "mine") S.s = "all";
    return;
  }
  const meta = S.user.user_metadata || {};
  const pic = meta.avatar_url || meta.picture;
  el.innerHTML = `<button class="btn ghost" id="open-profile">${pic ? `<img class="avatar" src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : ""}<span class="label">${esc(meta.full_name || meta.name || S.user.email)}</span></button>`;
  $("#open-profile").onclick = openProfile;
  $("#s-mine").hidden = false;
  $("#s-mine").textContent = `Salvos (${S.saved.size})`;
}

function login() {
  S.sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname + location.search },
  });
}

async function loadUserData() {
  if (!S.user) { S.saved = new Set(); S.track = new Map(); S.profile = null; return; }
  const [savedFull, prof] = await Promise.all([
    S.sb.from("saved_festivals").select("festival_id,status"),
    S.sb.from("profiles").select("email,email_opt_in,reminder_days").eq("id", S.user.id).maybeSingle(),
  ]);
  let saved = savedFull;
  S.trackSupported = !savedFull.error;
  // Se a coluna "status" ainda não existe no banco (migração 2 não rodada), funciona sem acompanhamento
  if (savedFull.error) saved = await S.sb.from("saved_festivals").select("festival_id");
  if (saved.error) console.error(saved.error);
  S.saved = new Set((saved.data || []).map((r) => r.festival_id));
  S.track = new Map((saved.data || []).map((r) => [r.festival_id, r.status || "quero"]));
  S.profile = prof.data || null;
}

async function toggleSave(id) {
  if (!S.sb) return toast("Login indisponível no momento.");
  if (!S.user) return login();
  const f = S.all.find((x) => x.id === id);
  const was = S.saved.has(id);
  was ? S.saved.delete(id) : S.saved.add(id);
  if (!was) S.track.set(id, "quero");
  renderTable(); renderAccount(); refreshDetail(id);
  const { error } = was
    ? await S.sb.from("saved_festivals").delete().eq("user_id", S.user.id).eq("festival_id", id)
    : await S.sb.from("saved_festivals").insert({ user_id: S.user.id, festival_id: id, festival_name: f?.name });
  if (error) {
    console.error(error);
    was ? S.saved.add(id) : S.saved.delete(id);
    renderTable(); renderAccount(); refreshDetail(id);
    return toast("Não foi possível salvar. Tente de novo.");
  }
  if (!was) {
    const optin = S.profile?.email_opt_in;
    toast(optin ? "Salvo. Você vai receber lembrete por e-mail antes do prazo." : "Salvo no seu perfil.");
  }
}

function openProfile() {
  const p = S.profile || { email: S.user.email, email_opt_in: true, reminder_days: [30, 7, 1] };
  $("#pf-email").textContent = `Lembretes vão para ${p.email}`;
  const n = S.saved.size;
  $("#pf-saved").textContent = n ? `★ Ver meus ${n} festiva${n === 1 ? "l" : "is"} salvo${n === 1 ? "" : "s"}` : "Nenhum festival salvo ainda. Use a estrela ☆ na lista.";
  $("#pf-saved").disabled = !n;
  $("#pf-saved").onclick = () => {
    $("#profile").close();
    S.s = "mine";
    update();
    $("#h-all").scrollIntoView({ behavior: "smooth" });
  };
  $("#pf-ics").hidden = !n;
  $("#pf-ics").onclick = () => downloadICS(S.all.filter((f) => S.saved.has(f.id)), "radar-de-festivais-salvos.ics");
  $("#pf-optin").checked = p.email_opt_in;
  $("#pf-days").innerHTML = REMINDER_OPTIONS.map(
    (d) => `<label class="chip"><input type="checkbox" value="${d}" ${p.reminder_days.includes(d) ? "checked" : ""}><span>${d} dia${d === 1 ? "" : "s"}</span></label>`,
  ).join("");
  $("#pf-days-set").disabled = !p.email_opt_in;
  $("#pf-status").textContent = "";
  $("#profile").showModal();
}

async function saveProfile() {
  const reminder_days = $$("#pf-days input:checked").map((i) => +i.value).sort((a, b) => b - a);
  const email_opt_in = $("#pf-optin").checked;
  $("#pf-days-set").disabled = !email_opt_in;
  const { error } = await S.sb.from("profiles").update({ email_opt_in, reminder_days }).eq("id", S.user.id);
  if (error) { console.error(error); $("#pf-status").textContent = "Não foi possível salvar."; return; }
  S.profile = { ...(S.profile || {}), email_opt_in, reminder_days };
  $("#pf-status").textContent = !email_opt_in
    ? "Lembretes desligados."
    : reminder_days.length ? "Preferências salvas." : "Nenhum dia marcado: você não vai receber lembretes.";
}

async function initAuth() {
  let cfg = CONFIG.supabaseUrl ? CONFIG : null;
  if (!cfg) { try { cfg = await (await fetch("/api/config")).json(); } catch {} }
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) { renderAccount(); update(); return; }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  S.sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: "pkce", detectSessionInUrl: true } });
  const { data } = await S.sb.auth.getSession();
  S.user = data.session?.user || null;
  await loadUserData();
  renderAccount(); update();
  S.sb.auth.onAuthStateChange(async (_e, session) => {
    const uid = session?.user?.id || null;
    if (uid === (S.user?.id || null)) return;
    S.user = session?.user || null;
    await loadUserData();
    renderAccount(); update();
  });
}

// ——— ficha do festival ———
let detailId = null;
function refreshDetail(id) { if ($("#detail").open && detailId === id) openDetail(id); }

function openDetail(id) {
  const f = S.all.find((x) => x.id === id);
  if (!f) return;
  detailId = id;
  const st = f._st;
  const rows = [];
  const add = (k, v) => v && rows.push(`<dt>${k}</dt><dd>${v}</dd>`);
  add("Prazo", `${f.deadline ? `<span class="mono">${fmt(f.deadline)}</span> ` : "a confirmar "}<span class="pill p-${st.k}">${st.label}</span>${f.deadline && f.dateStatus !== "Confirmada" ? `<br><span class="muted small">Data projetada pela edição anterior; confirme no regulamento.</span>` : ""}`);
  add("Próxima edição", esc(f.event));
  add("Local", esc([f.local, f.local && f.country && !f.local.includes(f.country) ? f.country : (!f.local ? f.country : "")].filter(Boolean).join(" · ")));
  add("Duração máxima", f.maxDuration != null ? `${f.maxDuration} min` : "");
  add("Gêneros aceitos", esc(f.genres.join(", ")));
  add("Qualifica para", esc(f.qualifies.map((q) => QUAL_LABEL[q]).join(", ")));
  add("Estreia", esc(f.premiere));
  add("Quem pode inscrever", esc(f.restrictions));
  add("Temas", esc(f.themes.join(", ")));
  add("Inscrição", esc(f.fee));
  add("Prêmios e benefícios", esc(f.benefit));
  add("Observações", esc(f.notes));
  add("Última verificação", f.checkedAt ? fmt(f.checkedAt) : "");
  $("#dt-where").textContent = f.scope === "BR" ? "Brasil" : f.country || "";
  $("#dt-title").textContent = f.name;
  $("#dt-body").innerHTML = `<dl class="dl">${rows.join("")}</dl>`;

  const saved = S.saved.has(id);
  const acts = [];
  if (f.url) acts.push(`<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">Página de inscrição ↗</a>`);
  if (f.rulesUrl) acts.push(`<a class="btn ghost" href="${esc(f.rulesUrl)}" target="_blank" rel="noopener">Regulamento ↗</a>`);
  acts.push(`<button class="btn ghost" id="dt-save">${saved ? "★ Salvo" : "☆ Salvar"}</button>`);
  if (saved && S.trackSupported) {
    const cur = S.track.get(id) || "quero";
    acts.push(`<label class="sr" for="dt-track">Situação</label><select id="dt-track">${TRACK.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select>`);
  }
  if (f.deadline && days(f.deadline) >= 0) {
    acts.push(`<a class="btn ghost" href="${googleCalUrl(f)}" target="_blank" rel="noopener">Google Agenda</a>`);
    acts.push(`<button class="btn ghost" id="dt-ics">Baixar .ics</button>`);
  }
  $("#dt-actions").innerHTML = acts.join("");
  $("#dt-save").onclick = () => toggleSave(id);
  if ($("#dt-track")) $("#dt-track").onchange = (e) => setTrack(id, e.target.value);
  if ($("#dt-ics")) $("#dt-ics").onclick = () => downloadICS([f], `prazo-${f.id}.ics`);
  if (!$("#detail").open) $("#detail").showModal();
}

async function setTrack(id, status) {
  const prev = S.track.get(id);
  S.track.set(id, status);
  renderTable();
  const { error } = await S.sb.from("saved_festivals").update({ status }).eq("user_id", S.user.id).eq("festival_id", id);
  if (error) {
    console.error(error);
    S.track.set(id, prev);
    renderTable(); refreshDetail(id);
    return toast("Não foi possível atualizar.");
  }
  toast(["inscrito", "selecionado", "nao_selecionado"].includes(status)
    ? `Marcado como "${TRACK_LABEL[status]}". Os lembretes deste festival param.`
    : "Atualizado.");
}

// ——— agenda (Google Agenda e arquivo .ics) ———
const ymd = (iso) => iso.replaceAll("-", "");
const nextDay = (iso) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const calText = (f) => `${f.dateStatus === "Confirmada" ? "" : "Data estimada pela edição anterior; confirme no regulamento.\n"}${f.fee ? `Inscrição: ${f.fee}\n` : ""}${f.url || ""}\n\nRadar de Festivais: ${location.origin}`;

function googleCalUrl(f) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Prazo: ${f.name}`,
    dates: `${ymd(f.deadline)}/${ymd(nextDay(f.deadline))}`,
    details: calText(f),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function downloadICS(list, filename) {
  const items = list.filter((f) => f.deadline && days(f.deadline) >= 0);
  if (!items.length) return toast("Nenhum prazo futuro para exportar.");
  const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  // Linhas do .ics com mais de 75 caracteres são "dobradas" (padrão RFC 5545)
  const fold = (line) => line.length <= 74 ? line : line.match(/.{1,73}/gsu).join("\r\n ");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = items.map((f) => [
    "BEGIN:VEVENT",
    `UID:${f.id}-${f.deadline}@radar-de-festivais`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(f.deadline)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(f.deadline))}`,
    `SUMMARY:${icsEsc(`Prazo: ${f.name}`)}`,
    `DESCRIPTION:${icsEsc(calText(f))}`,
    f.url ? `URL:${f.url}` : "",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`Prazo em 7 dias: ${f.name}`)}`, "TRIGGER:-P7D", "END:VALARM",
    "END:VEVENT",
  ].filter(Boolean).map(fold).join("\r\n"));
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radar de Festivais//PT-BR", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ——— eventos ———
function bind() {
  $$("[data-r]").forEach((b) => (b.onclick = () => { S.r = b.dataset.r; update(); }));
  $$("[data-s]").forEach((b) => (b.onclick = () => { S.s = b.dataset.s; update(); }));
  let t;
  $("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); update(); }, 120); };
  $("#adv-toggle").onclick = () => toggleAdv($("#adv").hidden);
  $("#genres").onchange = () => { S.genres = new Set($$("#genres input:checked").map((i) => i.value)); update(); };
  $("#country").onchange = (e) => { S.country = e.target.value; update(); };
  $("#dur").oninput = (e) => { const v = parseInt(e.target.value, 10); S.dur = v > 0 ? v : null; syncAdvCount(); renderTable(); writeURL(); };
  $("#unknown").onchange = (e) => { S.unknown = e.target.checked; update(); };
  $("#quals").onchange = () => { S.quals = new Set($$("#quals input:checked").map((i) => i.value)); update(); };
  $("#themes").onchange = () => { S.themes = new Set($$("#themes input:checked").map((i) => i.value)); update(); };
  $("#free").onchange = (e) => { S.free = e.target.checked; update(); };
  $("#nopremiere").onchange = (e) => { S.noPremiere = e.target.checked; update(); };
  $("#adv-clear").onclick = () => {
    S.genres.clear(); S.quals.clear(); S.themes.clear();
    S.country = ""; S.dur = null; S.unknown = true; S.free = false; S.noPremiere = false;
    update();
  };
  $$("th[data-k]").forEach((th) => (th.onclick = () => {
    const k = th.dataset.k;
    S.sortDir = S.sortKey === k ? -S.sortDir : 1;
    S.sortKey = k;
    update();
  }));
  $("#tb").onclick = (e) => {
    const b = e.target.closest(".star");
    if (b) return toggleSave(b.dataset.id);
    if (e.target.closest("a")) return; // link de inscrição abre direto
    const row = e.target.closest("tr[data-open]");
    if (row) openDetail(row.dataset.open);
  };
  $("#dt-close").onclick = () => $("#detail").close();
  $("#detail").onclick = (e) => { if (e.target === $("#detail")) $("#detail").close(); };
  $("#pf-optin").onchange = saveProfile;
  $("#pf-days").onchange = saveProfile;
  $("#pf-logout").onclick = async () => { await S.sb.auth.signOut(); $("#profile").close(); };
}

// ——— início ———
async function init() {
  readURL();
  bind();
  initAuth().catch((e) => console.error("auth", e));
  try {
    // Lê a base publicada com o site; se falhar, tenta a função do Netlify
    let festivals;
    try {
      festivals = await loadSheet(CONFIG.sheetCsvUrl);
    } catch (e) {
      console.warn("planilha direta falhou, tentando /api/festivals", e);
      const res = await fetch("/api/festivals");
      if (!res.ok) throw e;
      ({ festivals } = await res.json());
    }
    S.all = festivals.map((f) => ({ ...f, genres: f.genres || [], _st: status(f) }));
    S.loaded = true;
  } catch (e) {
    console.error(e);
    $("#strip").innerHTML = "";
    $("#tb").innerHTML = `<tr><td colspan="6" class="empty">Não foi possível carregar os festivais agora. Tente recarregar a página em instantes.</td></tr>`;
    return;
  }
  renderHeader();
  renderStrip();
  buildAdvanced();
  update();
}

init();
