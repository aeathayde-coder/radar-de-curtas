// Radar de Festivais — front-end (sem build). Dados: site/dados/festivais.csv. Conta: Supabase + Google.
import CONFIG from "./config.js";
import { loadSheet } from "./sheet.js";
import { norm, queryTerms, isFree, noPremiere, acceptsBR, wordsOf, describeParams } from "./filtros.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// lido antes de a URL ser reescrita pelos filtros
const OPEN_ID = new URLSearchParams(location.search).get("f");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const GENRE_ORDER = ["Ficção", "Documentário", "Animação", "Experimental", "Videoclipe"];
// Fantástico entra na Ficção: não vira botão de filtro, mas continua encontrável pela busca
const HIDDEN_GENRES = ["Fantástico"];
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
const STAR_ICO = `<svg class="ni" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
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
  limit: 100,
  all: [],
  r: "all", s: "all", q: "", genres: new Set(), country: "", dur: null, unknown: true,
  quals: new Set(), themes: new Set(), free: false, noPremiere: false, acceptsBR: false, anyOrigin: false,
  sortKey: "deadline", sortDir: 1,
  sb: null, user: null, profile: null, saved: new Set(), track: new Map(), trackSupported: false,
  v3: false, searches: [],
  v4: false, films: [], film: null, rows: [], view: "list",
};

function status(f) {
  if (!f.deadline) return { k: "est", label: "a confirmar", rank: 3 };
  const d = days(f.deadline);
  if (d < 0) return { k: "off", label: "encerrado", rank: 4 };
  if (f.dateStatus === "Confirmada") {
    if (d <= 30) return { k: "hot", label: d === 0 ? "hoje" : d === 1 ? "falta 1 dia" : `faltam ${d} dias`, rank: 0 };
    return { k: "ok", label: `confirmado · ${d} d`, rank: 1 };
  }
  return { k: "est", label: `previsto · ~${d} d`, rank: 2 };
}

// ——— URL ⇄ filtros (busca compartilhável) ———
function readURL() {
  const p = new URLSearchParams(location.search);
  if (["BR", "INT"].includes(p.get("r"))) S.r = p.get("r");
  if (["open", "hot", "est", "mine"].includes(p.get("s"))) S.s = p.get("s");
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
  S.acceptsBR = p.get("br") === "1";
  S.anyOrigin = p.get("mundo") === "1";
}
// Filtros da busca atual, sem a situação (usado para salvar a busca)
function searchParams() {
  const p = new URLSearchParams();
  if (S.r !== "all") p.set("r", S.r);
  if (S.q) p.set("q", S.q);
  if (S.genres.size) p.set("g", [...S.genres].join(","));
  if (S.country) p.set("pais", S.country);
  if (S.dur) p.set("dur", S.dur);
  if (!S.unknown) p.set("inc", "0");
  if (S.quals.size) p.set("ql", [...S.quals].join(","));
  if (S.themes.size) p.set("tema", [...S.themes].join(","));
  if (S.free) p.set("gratis", "1");
  if (S.noPremiere) p.set("semestreia", "1");
  if (S.acceptsBR) p.set("br", "1");
  if (S.anyOrigin) p.set("mundo", "1");
  return p.toString();
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
  if (S.acceptsBR) p.set("br", "1");
  if (S.anyOrigin) p.set("mundo", "1");
  // Volta do login com Google: o Supabase ainda precisa ler ?code= da URL; não apague antes disso
  if (S.authPending) return;
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// ——— filtros ———
const ORIGIN_LABEL = {
  any: "Filmes de qualquer país",
  national: "Apenas produções nacionais (do país do festival)",
  "regional-br": "Recorte regional (inclui o Brasil)",
  regional: "Recorte regional (não inclui o Brasil)",
};

function matches(f) {
  if (S.r !== "all" && f.scope !== S.r) return false;
  const st = f._st;
  if (S.s === "open" && !(st.k === "ok" || st.k === "hot")) return false;
  if (S.s === "hot" && st.k !== "hot") return false;
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
  // Sem origem informada: segue a opção "Incluir festivais sem gênero, duração ou origem informados"
  if (S.acceptsBR && (f.origin ? !acceptsBR(f) : !S.unknown)) return false;
  if (S.anyOrigin && (f.origin ? f.origin !== "any" : !S.unknown)) return false;
  if (S.q) {
    // Cada termo precisa casar com o começo de alguma palavra ("rio" acha Rio de Janeiro, não "documentário")
    const words = wordsOf(f);
    if (!queryTerms(S.q).every((alts) => alts.some((t) => words.some((w) => w.startsWith(t))))) return false;
  }
  return true;
}

function sorter(a, b) {
  let v;
  if (S.sortKey === "status") v = a._st.rank - b._st.rank || (a.deadline || "9").localeCompare(b.deadline || "9");
  else if (S.sortKey === "deadline") {
    const g = (f) => (!f.deadline ? 1 : days(f.deadline) >= 0 ? 0 : 2);
    v = g(a) - g(b) || (a.deadline || "9999").localeCompare(b.deadline || "9999");
  }
  else if (S.sortKey === "event") v = String(a.event || "~").localeCompare(String(b.event || "~"), "pt");
  else v = a.name.localeCompare(b.name, "pt");
  return v * S.sortDir;
}

// ——— render ———
function renderStrip() {
  const el = $("#strip");
  const list = S.all
    .filter((f) => f.deadline && days(f.deadline) >= 0 && days(f.deadline) <= 90)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  $(".arrows").hidden = list.length < 2;
  if (!list.length) { el.innerHTML = `<p class="muted">Nenhum prazo nos próximos 90 dias.</p>`; return; }
  el.innerHTML = list
    .map((f) => {
      const d = days(f.deadline);
      const confirmed = f.dateStatus === "Confirmada";
      const hot = d <= 7 && confirmed;
      const tag = hot
        ? `<span class="tag t-hot">prazo acabando</span>`
        : confirmed ? `<span class="tag t-ok">confirmado</span>` : `<span class="tag t-est">previsto</span>`;
      const big = d === 0 ? "Hoje" : `${confirmed ? "" : "~"}${d}`;
      const unit = d === 0 ? "último dia" : d === 1 ? "dia" : "dias";
      const fill = Math.max(4, Math.min(100, Math.round(((90 - d) / 90) * 100)));
      return `<button type="button" class="card${hot ? " hot" : ""}" data-open="${esc(f.id)}" aria-label="${esc(f.name)}: prazo ${fmt(f.deadline)}">
        <span class="c-top">${tag}</span>
        <span class="c-name">${esc(f.name)}</span>
        <span class="c-loc">${esc(f.local || f.country || "")}</span>
        <span class="c-count"><strong>${big}</strong> ${unit}</span>
        <span class="c-bar" aria-hidden="true"><i style="width:${fill}%"></i></span>
        <span class="c-date">Inscrições até ${fmt(f.deadline)}${confirmed ? "" : " · previsto"}</span>
      </button>`;
    })
    .join("");
}

const CUR_SYM = { BRL: "R$ ", EUR: "€", USD: "US$ ", GBP: "£", CHF: "CHF " };
function feeShort(f) {
  if (f.feeValue === 0) return "Inscrição gratuita";
  if (f.feeValue != null) return `Taxa atual: ${CUR_SYM[f.feeCurrency] || (f.feeCurrency ? f.feeCurrency + " " : "")}${String(f.feeValue).replace(".", ",")}`;
  if (!f.fee) return "";
  return `Inscrição: ${esc(f.fee.length > 70 ? f.fee.slice(0, 68).replace(/\s+\S*$/, "") + "…" : f.fee)}`;
}

function reqCell(f) {
  const flags = [];
  f.qualifies.forEach((q) => flags.push(`<span class="flag q" title="Qualifica para ${esc(QUAL_LABEL[q])}">${esc(q)}</span>`));
  if (f.maxDuration != null) flags.push(`<span class="flag dur">até ${f.maxDuration} min</span>`);
  // Lista enxuta: gêneros numa linha só, taxa atual em vez do texto completo (que fica na ficha)
  if (f.genres.length) flags.push(`<span class="flag gen">${esc(f.genres.join(" · "))}</span>`);
  if (f.premiere) flags.push(`<span class="flag prem">estreia: ${esc(f.premiere.charAt(0).toLowerCase() + f.premiere.slice(1))}</span>`);
  if (f.restrictions) flags.push(`<span class="flag warn">${esc(f.restrictions)}</span>`);
  const lines = [];
  const fee = feeShort(f);
  if (fee) lines.push(fee);
  return `${flags.length ? `<div class="req">${flags.join("")}</div>` : ""}${lines.join("<br>") || (flags.length ? "" : "Requisitos não informados; ver regulamento.")}`;
}

function renderTable() {
  if (!S.loaded) return;
  const rows = S.all.filter(matches).sort(sorter);
  const logged = !!S.user;
  // Lista longa: mostra de PAGE em PAGE (o calendário e os salvos mostram tudo)
  const shown = S.s === "mine" ? rows : rows.slice(0, S.limit);
  const more = $("#more");
  more.hidden = shown.length >= rows.length;
  more.textContent = `Mostrar mais ${Math.min(PAGE, rows.length - shown.length)} festivais`;
  $("#tb").innerHTML = rows.length
    ? shown
        .map((f) => {
          const st = f._st;
          const saved = S.s !== "mine" && S.v4 ? S.rows.some((r) => r.festival_id === f.id) : S.saved.has(f.id);
          const name = `<button type="button" class="fname" data-open="${esc(f.id)}">${esc(f.name)}</button>`;
          const site = f.url ? ` · <a class="ext" href="${esc(f.url)}" target="_blank" rel="noopener" aria-label="Site oficial de ${esc(f.name)} (abre em nova aba)">site oficial ↗</a>` : "";
          const sub =
            st.k === "off" ? `<span class="sub">aguardando próximo ciclo</span>`
            : f.deadline && f.dateStatus !== "Confirmada" ? `<span class="sub">aguardando confirmação</span>` : "";
          const tr = saved && S.trackSupported ? `<span class="mystatus">${esc(TRACK_LABEL[S.track.get(f.id)] || "Quero inscrever")}</span>` : "";
          return `<tr class="clickable${saved ? " is-saved" : ""}" data-open="${esc(f.id)}">
            <td class="save"><button class="star" data-id="${esc(f.id)}" aria-pressed="${saved}" aria-label="${saved ? "Remover dos salvos" : "Salvar"}: ${esc(f.name)}" title="${logged ? (saved ? "Remover dos salvos" : "Salvar e receber lembrete") : "Entre com Google para salvar"}">${saved ? "★" : "☆"}</button></td>
            <td class="name">${name}<span class="loc">${esc(f.local || f.country || "")}${site}${f.checkedAt ? `<span class="chk">conferido em ${fmt(f.checkedAt).replace(/ \d{4}$/, "")}</span>` : ""}</span>${tr}${S.s === "mine" ? fitHTML(f) + inscBadge(f) : ""}<span class="more" aria-hidden="true">Ver detalhes →</span></td>
            <td class="mono dl-cell" data-label="Inscrições até">${f.deadline ? (f.dateStatus === "Confirmada" ? "" : "~") + fmt(f.deadline) : "a confirmar"}${sub}</td>
            <td class="st"><span class="pill p-${st.k}">${st.label}</span></td>
            <td class="ev" data-label="Próxima edição">${esc(f.event || "a definir")}</td>
            <td class="notes">${reqCell(f)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">${S.s === "mine" && !S.saved.size ? "Você ainda não salvou nenhum festival. Use a estrela ☆ ao lado do nome." : `Nenhum festival com esses filtros.${S.q ? " Tente outra palavra ou use a Busca avançada para filtrar por gênero, país e duração." : ""}`}</td></tr>`;
  // Sem filtro, não mostra contagem (o site não divulga o tamanho da base); com filtro, mostra só os resultados
  $("#count").textContent = S.s !== "mine" && rows.length < S.all.length ? `${rows.length} resultado${rows.length === 1 ? "" : "s"}` : "";
  const mine = S.s === "mine";
  $("#h-all").innerHTML = mine ? `Meus <em>salvos</em>${S.saved.size ? ` (${S.saved.size})` : ""}` : "Todos os <em>festivais</em>";
  $("#k-all").textContent = mine ? "02 · seus festivais" : "02 · base completa";
  $("#mine-bar").hidden = !mine;
  renderSearchTools(mine);
  renderFilms(mine);
  $("#mine-report").hidden = !(mine && S.saved.size);
  renderCalendar(rows);
  renderCalc();
}

// ——— calculadora de investimento (Meus salvos) ———
const CURRENCIES = ["BRL", "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "MXN", "ARS", "COP", "CLP", "JPY", "KRW", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "INR", "CNY", "ZAR"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (v, c) => { try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v); } catch { return `${c} ${v}`; } };
let FX = null, fxLoading = null;
async function loadFX() {
  if (FX) return FX;
  try { const c = JSON.parse(sessionStorage.getItem("rdf-fx") || "null"); if (c && c.day === new Date().toDateString()) return (FX = c); } catch {}
  for (const url of ["https://api.frankfurter.dev/v1/latest?base=BRL", "https://api.frankfurter.app/latest?base=BRL"]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.rates) { FX = { rates: j.rates, date: j.date, day: new Date().toDateString() }; try { sessionStorage.setItem("rdf-fx", JSON.stringify(FX)); } catch {} return FX; }
    } catch {}
  }
  return null;
}
function feeFor(f) {
  try { const o = JSON.parse(localStorage.getItem("rdf-fee-" + f.id) || "null"); if (o && Number.isFinite(o.v)) return { v: o.v, c: o.c, own: true }; } catch {}
  return f.feeValue != null ? { v: f.feeValue, c: f.feeCurrency || "BRL", own: false } : { v: null, c: f.feeCurrency || "EUR", own: false };
}
const toBRL = (v, c) => (v == null ? null : c === "BRL" ? v : FX && FX.rates[c] ? v / FX.rates[c] : null);
function renderCalc() {
  const box = $("#calc");
  const on = S.s === "mine" && S.saved.size > 0;
  box.hidden = !on;
  if (!on) return;
  if (!FX && !fxLoading) fxLoading = loadFX().then(() => { fxLoading = null; renderCalc(); });
  const list = S.all.filter((f) => S.saved.has(f.id)).sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
  let todo = 0, done = 0, missing = 0, noRate = 0;
  $("#calc-list").innerHTML = list.map((f) => {
    const st = S.trackSupported ? S.track.get(f.id) || "quero" : "quero";
    const fee = feeFor(f);
    const v = toBRL(fee.v, fee.c);
    if (fee.v == null) missing++;
    else if (v == null) noRate++;
    else if (st === "quero") todo += v; else done += v;
    const opts = [...new Set([fee.c, ...CURRENCIES])].map((c) => `<option ${c === fee.c ? "selected" : ""}>${c}</option>`).join("");
    return `<div class="calc-row" data-id="${esc(f.id)}">
      <span class="cr-name">${esc(f.name)}<small>${f.fee ? esc(f.fee) : "taxa não informada"}</small></span>
      ${S.trackSupported ? `<select class="cr-st" aria-label="Situação de ${esc(f.name)}">${TRACK.map(([v, l]) => `<option value="${v}" ${v === st ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
      <span class="cr-fee"><input type="number" min="0" step="0.01" inputmode="decimal" value="${fee.v ?? ""}" placeholder="taxa" aria-label="Taxa de ${esc(f.name)}"><select aria-label="Moeda">${opts}</select></span>
      <span class="cr-brl">${v != null ? brl.format(v) : fee.v == null ? "informe a taxa" : "sem cotação"}</span>
    </div>`;
  }).join("");
  $("#calc-todo").textContent = brl.format(todo);
  $("#calc-done").textContent = brl.format(done);
  const notes = [];
  if (FX) notes.push(`Cotação de ${fmt(FX.date)} (bancos centrais, via Frankfurter).`);
  else notes.push("Carregando a cotação do dia…");
  if (missing) notes.push(`${missing} festival${missing > 1 ? "s" : ""} sem taxa informada: preencha se souber o valor.`);
  if (noRate && FX) notes.push(`${noRate} em moeda sem cotação disponível.`);
  notes.push("Valores aproximados; confira sempre no regulamento.");
  $("#calc-note").textContent = notes.join(" ");
}
// planilha .xlsx dos salvos (gerada no navegador; o módulo só carrega no clique)
async function downloadXlsx() {
  const btn = $("#mine-xlsx");
  btn.disabled = true;
  try {
    const [{ buildXlsx }] = await Promise.all([import("/planilha.js"), loadFX()]);
    const list = S.all.filter((f) => S.saved.has(f.id)).sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
    const rows = list.map((f) => {
      const fee = feeFor(f);
      return {
        name: f.name, country: f.country, local: f.local, deadline: f.deadline,
        dateLabel: f.dateStatus === "Confirmada" ? "Confirmada" : f.dateStatus === "Estimada" ? "Prevista" : "A confirmar",
        status: TRACK_LABEL[S.trackSupported ? S.track.get(f.id) || "quero" : "quero"],
        fee: fee.v, currency: fee.v == null ? "" : fee.c, maxDuration: f.maxDuration, premiere: f.premiere, url: f.url,
      };
    });
    const used = new Set(["BRL", "EUR", "USD", "GBP", "CHF", ...rows.map((r) => r.currency).filter(Boolean)]);
    const rates = [...used].map((c) => [c, c === "BRL" ? 1 : FX && FX.rates[c] ? 1 / FX.rates[c] : null]);
    const rateNote = FX ? `Cotação de ${fmt(FX.date)} (bancos centrais, via Frankfurter).` : "Cotação indisponível na hora da exportação: preencha os valores em azul.";
    const blob = buildXlsx({ rows, rates, rateNote });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "radar-de-festivais-meus-festivais.xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    console.error(e);
    toast("Não foi possível gerar a planilha. Tente de novo.");
  } finally { btn.disabled = false; }
}
function saveFee(row) {
  const id = row.dataset.id;
  const v = parseFloat(row.querySelector("input").value);
  const c = row.querySelector("select").value;
  try {
    if (Number.isFinite(v) && v >= 0) localStorage.setItem("rdf-fee-" + id, JSON.stringify({ v, c }));
    else localStorage.removeItem("rdf-fee-" + id);
  } catch {}
  renderCalc();
}

function syncControls() {
  $$("[data-r]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.r === S.r));
  $$("[data-s]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.s === S.s));
  $("#q-free").setAttribute("aria-pressed", S.free);
  $$("[data-sort]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sort === S.sortKey));
  $("#q").value = S.q;
  $$("#genres input").forEach((i) => (i.checked = S.genres.has(i.value)));
  $("#country").value = S.country;
  $("#dur").value = S.dur ?? "";
  $("#unknown").checked = S.unknown;
  $$("#quals input").forEach((i) => (i.checked = S.quals.has(i.value)));
  $$("#themes input").forEach((i) => (i.checked = S.themes.has(i.value)));
  $("#free").checked = S.free;
  $("#nopremiere").checked = S.noPremiere;
  $("#acceptsbr").checked = S.acceptsBR;
  $("#anyorigin").checked = S.anyOrigin;
  $$("th[data-k]").forEach((th) =>
    th.setAttribute("aria-sort", th.dataset.k === S.sortKey ? (S.sortDir === 1 ? "ascending" : "descending") : "none"),
  );
}

function update() { S.limit = PAGE; syncControls(); syncAdvCount(); renderTable(); writeURL(); }

function buildAdvanced() {
  // Ordem fixa para os principais; qualquer gênero novo escrito na planilha entra depois, em ordem alfabética
  const used = new Set(S.all.flatMap((f) => f.genres));
  const extra = [...used].filter((g) => !GENRE_ORDER.includes(g) && !HIDDEN_GENRES.includes(g)).sort((a, b) => a.localeCompare(b, "pt"));
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
  if (S.genres.size || S.country || S.dur || !S.unknown || S.quals.size || S.themes.size || S.free || S.noPremiere || S.acceptsBR || S.anyOrigin) toggleAdv(true);
}

function syncAdvCount() {
  const n = S.genres.size + S.quals.size + S.themes.size + (S.country ? 1 : 0) + (S.dur ? 1 : 0) + (S.unknown ? 0 : 1) + (S.free ? 1 : 0) + (S.noPremiere ? 1 : 0) + (S.acceptsBR ? 1 : 0) + (S.anyOrigin ? 1 : 0);
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
  $("#eyebrow").textContent = checked ? `Última atualização · ${fmt(checked).replace(/^0/, "")}` : "Atualizado semanalmente";
  $("#lede").innerHTML = `Site <strong class="br">brasileiro</strong>, sem fins lucrativos, que reúne prazos de inscrição e informações de festivais de <span class="nw">curta-metragem</span> nacionais e internacionais, de ${new Set(S.all.map((f) => f.country).filter(Boolean)).size} países (e contando)*.`;
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
    el.innerHTML = `<button class="navlink" id="nav-saved" aria-label="Meus salvos">${STAR_ICO}<span class="nl">Meus salvos</span></button><button class="btn" id="login" aria-label="Entrar com Google"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z"/></svg><span class="lg">Entrar com Google</span><span class="sm">Entrar</span></button>`;
    $("#login").onclick = login;
    $("#nav-saved").onclick = () => toast("Entre com Google para salvar festivais e ver seus salvos aqui.");
    $("#s-mine").hidden = true;
    if (S.s === "mine") S.s = "all";
    return;
  }
  const meta = S.user.user_metadata || {};
  const pic = meta.avatar_url || meta.picture;
  el.innerHTML = `<button class="navlink" id="nav-saved" aria-label="Meus salvos">${STAR_ICO}<span class="nl">Meus salvos${S.saved.size ? ` (${S.saved.size})` : ""}</span>${S.saved.size ? `<span class="nbadge">${S.saved.size}</span>` : ""}</button><button class="btn ghost" id="open-profile">${pic ? `<img class="avatar" src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<span class="initial" aria-hidden="true">${esc((meta.full_name || meta.name || S.user.email || "?").trim().charAt(0).toUpperCase())}</span>`}<span class="label">${esc(meta.full_name || meta.name || S.user.email)}</span></button>`;
  $("#open-profile").onclick = openProfile;
  $("#nav-saved").onclick = () => { S.s = "mine"; update(); $("#lista").scrollIntoView({ behavior: "smooth" }); };
  $("#nav-saved").setAttribute("aria-pressed", S.s === "mine");
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
  if (!S.user) { S.saved = new Set(); S.track = new Map(); S.profile = null; S.searches = []; S.v3 = false; S.v4 = false; S.films = []; S.rows = []; S.film = null; return; }
  let [savedFull, prof] = await Promise.all([
    S.sb.from("saved_festivals").select("festival_id,status"),
    S.sb.from("profiles").select("email,email_opt_in,reminder_days,change_alerts,calendar_token").eq("id", S.user.id).maybeSingle(),
  ]);
  // Migração 3 (avisos, agenda assinável, buscas salvas): sem ela, o site segue como antes
  S.v3 = !prof.error;
  if (prof.error) prof = await S.sb.from("profiles").select("email,email_opt_in,reminder_days").eq("id", S.user.id).maybeSingle();
  if (S.v3) {
    const ss = await S.sb.from("saved_searches").select("id,label,params,notify").order("created_at");
    S.searches = ss.error ? [] : ss.data;
    if (ss.error) S.v3 = false;
  }
  // Migração 4 (planejamento por filme): os salvos passam a pertencer a um filme
  S.v4 = false; S.noGeneral = false;
  if (S.v3) {
    let fl = await S.sb.from("films").select(FILM_COLS).order("created_at");
    // Migração 4 antiga (sem "Para acompanhar"): funciona com os projetos, sem a lista geral
    if (fl.error) { fl = await S.sb.from("films").select(FILM_COLS.replace(",general", "")).order("created_at"); if (!fl.error) S.noGeneral = true; }
    if (!fl.error) {
      const rows = await S.sb.from("saved_festivals").select("festival_id,film_id,status,notes,checklist,award");
      if (!rows.error) {
        S.v4 = true; S.films = sortFilms(fl.data || []); S.rows = rows.data || [];
        S.trackSupported = true; S.profile = prof.data || null;
        applyFilm();
        return;
      }
    }
  }
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
  if (S.v4 && !(await ensureFilm())) { was ? S.saved.add(id) : S.saved.delete(id); renderTable(); renderAccount(); return toast("Não foi possível salvar. Tente de novo."); }
  let del = S.sb.from("saved_festivals").delete().eq("user_id", S.user.id).eq("festival_id", id);
  if (S.v4) del = del.eq("film_id", S.film);
  const { error } = was
    ? await del
    : await S.sb.from("saved_festivals").insert({ user_id: S.user.id, festival_id: id, festival_name: f?.name, ...(S.v4 ? { film_id: S.film } : {}) });
  if (!error && S.v4) {
    if (was) S.rows = S.rows.filter((r) => !(r.festival_id === id && r.film_id === S.film));
    else S.rows.push({ festival_id: id, film_id: S.film, status: "quero", notes: null, checklist: null, award: null });
  }
  if (error) {
    console.error(error);
    was ? S.saved.add(id) : S.saved.delete(id);
    renderTable(); renderAccount(); refreshDetail(id);
    return toast("Não foi possível salvar. Tente de novo.");
  }
  if (!was) {
    const optin = S.profile?.email_opt_in;
    const where = S.v4 && filmOf() ? ` em “${filmOf().title}”` : "";
    toast(optin ? `Salvo${where}. O lembrete chega por e-mail às 8h; se não aparecer, olhe em Promoções e Spam.` : `Salvo${where}.`);
  }
}

function openProfile() {
  const p = S.profile || { email: S.user.email, email_opt_in: true, reminder_days: [30, 7, 1] };
  $("#pf-email").textContent = `Lembretes vão para ${p.email}`;
  const n = S.saved.size;
  $("#pf-saved").textContent = n ? (n === 1 ? "★ Ver meu festival salvo" : `★ Ver meus ${n} festivais salvos`) : "Nenhum festival salvo ainda. Use a estrela ☆ na lista.";
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
  $("#pf-changes-row").hidden = !S.v3;
  $("#pf-changes").checked = p.change_alerts !== false;
  $("#pf-changes").disabled = !p.email_opt_in;
  $("#pf-days").innerHTML = REMINDER_OPTIONS.map(
    (d) => `<label class="chip"><input type="checkbox" value="${d}" ${p.reminder_days.includes(d) ? "checked" : ""}><span>${d} dia${d === 1 ? "" : "s"}</span></label>`,
  ).join("");
  $("#pf-days-set").disabled = !p.email_opt_in;
  $("#pf-hint").hidden = !p.email_opt_in;
  $("#pf-status").textContent = "";
  $("#profile").showModal();
}

async function saveProfile() {
  const reminder_days = $$("#pf-days input:checked").map((i) => +i.value).sort((a, b) => b - a);
  const email_opt_in = $("#pf-optin").checked;
  $("#pf-days-set").disabled = !email_opt_in;
  $("#pf-hint").hidden = !email_opt_in;
  const upd = { email_opt_in, reminder_days };
  if (S.v3) upd.change_alerts = $("#pf-changes").checked;
  $("#pf-changes").disabled = !email_opt_in;
  const { error } = await S.sb.from("profiles").update(upd).eq("id", S.user.id);
  if (error) { console.error(error); $("#pf-status").textContent = "Não foi possível salvar."; return; }
  S.profile = { ...(S.profile || {}), ...upd };
  $("#pf-status").textContent = !email_opt_in
    ? "Lembretes desligados."
    : reminder_days.length ? "Preferências salvas." : "Nenhum dia marcado: você não vai receber lembretes.";
}

async function initAuth() {
  try { await startAuth(); } finally {
    // URL liberada (com ou sem sessão): agora os filtros podem voltar a ser gravados nela
    if (S.authPending) { S.authPending = false; writeURL(); }
  }
}

async function startAuth() {
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

// ——— salvar em um ou mais projetos ———
// Para salvar, sempre pergunta o projeto (ou cria o primeiro). Para tirar com um projeto só, a estrela tira direto.
function saveClick(id) {
  if (!S.sb) return toast("Login indisponível no momento.");
  if (!S.user) return login();
  if (S.v4) {
    const inFilms = S.rows.filter((r) => r.festival_id === id);
    if (S.films.length <= 1 && inFilms.length === 1) return saveInFilm(id, inFilms[0].film_id, false);
    return openSaveIn(id);
  }
  return toggleSave(id);
}
function openSaveIn(id) {
  const f = S.all.find((x) => x.id === id);
  $("#si-title").textContent = f ? f.name : "";
  // "Para acompanhar" aparece sempre, mesmo antes de existir: é criada no primeiro uso
  const gen = generalOf() || { id: "__geral", title: GENERAL_TITLE, general: true };
  const list = [...(S.noGeneral ? [] : [gen]), ...S.films.filter((x) => !x.general)];
  $("#si-list").innerHTML = list.map((x) => {
    const on = S.rows.some((r) => r.festival_id === id && r.film_id === x.id);
    const hint = x.general ? `<small>sem projeto, apenas para acompanhar os prazos</small>` : "";
    return `<label class="si-row"><input type="checkbox" data-film="${esc(x.id)}" ${on ? "checked" : ""}><span>${esc(x.title)}${hint}</span></label>`;
  }).join("");
  $("#si-newbox").hidden = true;
  $("#si-new").hidden = false;
  $("#si-name").value = "";
  $("#savein").dataset.id = id;
  $("#savein").showModal();
}
async function createProjectAndSave() {
  const id = $("#savein").dataset.id;
  const title = ($("#si-name").value.trim() || "Meu projeto").slice(0, 200);
  const { data, error } = await S.sb.from("films").insert({ user_id: S.user.id, title }).select(FILM_COLS).single();
  if (error) { console.error(error); return toast("Não foi possível criar o projeto."); }
  S.films = sortFilms([...S.films, data]);
  if (await saveInFilm(id, data.id, true)) openSaveIn(id);
}
async function ensureGeneral() {
  const g = generalOf(); if (g) return g.id;
  const { data, error } = await S.sb.from("films").insert({ user_id: S.user.id, title: GENERAL_TITLE, general: true }).select(FILM_COLS).single();
  if (error) { console.error(error); toast("Não foi possível salvar. Tente de novo."); return null; }
  S.films = sortFilms([...S.films, data]);
  return data.id;
}
async function saveInFilm(id, filmId, on) {
  const f = S.all.find((x) => x.id === id);
  const { error } = on
    ? await S.sb.from("saved_festivals").insert({ user_id: S.user.id, festival_id: id, festival_name: f?.name, film_id: filmId })
    : await S.sb.from("saved_festivals").delete().eq("user_id", S.user.id).eq("festival_id", id).eq("film_id", filmId);
  if (error) { console.error(error); toast("Não foi possível salvar. Tente de novo."); return false; }
  if (on) S.rows.push({ festival_id: id, film_id: filmId, status: "quero", notes: null, checklist: null, award: null });
  else S.rows = S.rows.filter((r) => !(r.festival_id === id && r.film_id === filmId));
  applyFilm(); renderTable(); renderAccount(); refreshDetail(id);
  const t = S.films.find((x) => x.id === filmId)?.title;
  toast(on ? `Salvo em “${t}”.` : `Removido de “${t}”.`);
  return true;
}

// ——— planejamento por filme ———
const FILM_KEY = "rdf-filme";
const FILM_COLS = "id,title,duration_min,genre,finished_on,premiere_status,country,general";
const GENERAL_TITLE = "Para acompanhar";
const PAGE = 100;
const generalOf = () => S.films.find((x) => x.general) || null;
const sortFilms = (l) => [...l.filter((x) => x.general), ...l.filter((x) => !x.general)];
const PREMIERE_LABEL = { inedito: "inédito", exibido_brasil: "já exibido no Brasil", exibido_exterior: "já exibido fora do Brasil" };
const filmOf = () => S.films.find((x) => x.id === S.film) || null;
const rowOf = (fid) => S.rows.find((r) => r.festival_id === fid && (!S.v4 || r.film_id === S.film));
function rowQuery(q, fid) { q = q.eq("user_id", S.user.id).eq("festival_id", fid); return S.v4 ? q.eq("film_id", S.film) : q; }

function applyFilm() {
  if (!S.v4) return;
  let id = null;
  try { id = localStorage.getItem(FILM_KEY); } catch {}
  S.film = S.films.some((x) => x.id === id) ? id : S.films[0]?.id || null;
  const mine = S.rows.filter((r) => r.film_id === S.film);
  S.saved = new Set(mine.map((r) => r.festival_id));
  S.track = new Map(mine.map((r) => [r.festival_id, r.status || "quero"]));
}
function selectFilm(id) {
  try { localStorage.setItem(FILM_KEY, id); } catch {}
  applyFilm(); renderAccount(); update();
}
async function ensureFilm() {
  if (S.film) return true;
  const id = await ensureGeneral();
  if (!id) return false;
  S.film = id;
  const data = { id };
  try { localStorage.setItem(FILM_KEY, data.id); } catch {}
  return true;
}

function renderFilms(mine) {
  const box = $("#films");
  box.hidden = !(mine && S.v4);
  if (box.hidden) return;
  const f = filmOf();
  $("#mine-help").innerHTML = f?.general
    ? "Festivais que você salvou para acompanhar, sem projeto. Toque em um festival para marcar a situação, usar o checklist e escrever notas. Quando tiver um filme para inscrever, crie um projeto e salve nele os festivais que fizerem sentido."
    : f
    ? `Os festivais de <b>${esc(f.title)}</b>. Toque em um festival para marcar a situação da inscrição, usar o checklist de materiais e escrever notas. Para incluir festivais neste projeto, use a estrela ☆ na lista completa e escolha o projeto.`
    : "Salve festivais com a estrela ☆ na lista completa. Na primeira vez, você dá um nome ao seu projeto.";
  const info = f ? [f.duration_min ? `${f.duration_min} min` : "", f.genre || "", PREMIERE_LABEL[f.premiere_status] || "", f.country || ""].filter(Boolean).join(" · ") : "";
  box.innerHTML = `<span class="kicker">Suas listas</span>
    <div class="film-chips">${S.films.map((x) => `<button class="fchip" data-film="${esc(x.id)}" aria-pressed="${x.id === S.film}">${esc(x.title)}</button>`).join("")}<button class="fchip add" id="film-new">+ novo projeto</button></div>
    ${f && !f.general ? `<p class="film-info">${esc(info)}${!f.duration_min || !f.genre ? `${info ? " · " : ""}<span class="muted">preencha a ficha para ver quais festivais estão dentro dos requisitos</span>` : ""} <button class="link-btn" id="film-edit">editar ou apagar</button></p>` : ""}`;
}

function openFilm(film) {
  if (film?.general) return;
  const f = film || { title: "", duration_min: "", genre: "", finished_on: "", premiere_status: "inedito", country: "Brasil" };
  $("#fm-title").textContent = film ? "Ficha do projeto" : "Novo projeto";
  $("#fm-name").value = f.title || "";
  $("#fm-dur").value = f.duration_min || "";
  $("#fm-genre").value = f.genre || "";
  $("#fm-done").value = (f.finished_on || "").slice(0, 7);
  $("#fm-prem").value = f.premiere_status || "inedito";
  $("#fm-country").value = f.country || "Brasil";
  $("#fm-del").hidden = !film;
  $("#fm-status").textContent = "";
  $("#film-dlg").dataset.id = film ? film.id : "";
  $("#film-dlg").showModal();
}
async function saveFilm(e) {
  e.preventDefault();
  const id = $("#film-dlg").dataset.id;
  const body = {
    title: $("#fm-name").value.trim().slice(0, 200) || "Meu projeto",
    duration_min: parseInt($("#fm-dur").value, 10) || null,
    genre: $("#fm-genre").value || null,
    finished_on: $("#fm-done").value ? `${$("#fm-done").value}-01` : null,
    premiere_status: $("#fm-prem").value,
    country: $("#fm-country").value.trim().slice(0, 60) || "Brasil",
  };
  const cols = FILM_COLS;
  const res = id
    ? await S.sb.from("films").update(body).eq("id", id).select(cols).single()
    : await S.sb.from("films").insert({ user_id: S.user.id, ...body }).select(cols).single();
  if (res.error) { console.error(res.error); $("#fm-status").textContent = "Não foi possível salvar."; return; }
  if (id) Object.assign(S.films.find((x) => x.id === id), res.data); else S.films.push(res.data);
  $("#film-dlg").close();
  selectFilm(res.data.id);
}
async function deleteFilm() {
  const id = $("#film-dlg").dataset.id;
  const f = S.films.find((x) => x.id === id);
  if (!f || !confirm(`Apagar o projeto “${f.title}” e os festivais salvos nele? Isso não pode ser desfeito.`)) return;
  const { error } = await S.sb.from("films").delete().eq("id", id);
  if (error) { $("#fm-status").textContent = "Não foi possível apagar."; return; }
  S.films = S.films.filter((x) => x.id !== id);
  S.rows = S.rows.filter((r) => r.film_id !== id);
  try { localStorage.removeItem(FILM_KEY); } catch {}
  $("#film-dlg").close();
  selectFilm(S.films[0]?.id || "");
}

// Requisitos do festival × ficha do filme: descreve, sem veredito
function fitOf(f, film) {
  if (!film || (!film.duration_min && !film.genre)) return null;
  const out = [], chk = [];
  if (film.duration_min && f.maxDuration != null && film.duration_min > f.maxDuration) out.push(`até ${f.maxDuration} min`);
  if (film.genre && f.genres.length && !f.genres.includes(film.genre) && !(film.genre === "Ficção" && f.genres.includes("Fantástico"))) out.push(`não inclui ${film.genre.toLowerCase()}`);
  const br = norm(film.country || "") === "brasil";
  if (br && f.origin && !acceptsBR(f)) out.push(f.restrictions ? f.restrictions.charAt(0).toLowerCase() + f.restrictions.slice(1) : "não aceita filmes brasileiros");
  if (f.premiere && !noPremiere(f) && film.premiere_status !== "inedito") chk.push(`exige estreia (${f.premiere.charAt(0).toLowerCase() + f.premiere.slice(1)})`);
  if (f.restrictions && !(br && f.origin && !acceptsBR(f))) chk.push(f.restrictions.charAt(0).toLowerCase() + f.restrictions.slice(1));
  if (out.length) return { k: "out", t: `Fora dos requisitos: ${out.join("; ")}` };
  if (chk.length) return { k: "chk", t: `Confira: ${chk.join("; ")}` };
  return { k: "ok", t: "Dentro dos requisitos" };
}
function inscBadge(f) {
  if (!S.v4) return "";
  const r = rowOf(f.id); if (!r) return "";
  const list = checklistOf(r); const done = list.filter((x) => x.d).length;
  return `<span class="insc-badge">checklist ${done}/${list.length}${r.notes ? " · com notas" : ""}${r.award ? " · prêmio" : ""}</span>`;
}
function fitHTML(f) {
  if (!S.v4) return "";
  const r = fitOf(f, filmOf());
  return r ? `<span class="fit fit-${r.k}">${esc(r.t)}</span>` : "";
}

// Depois de uma seleção, o filme deixa de ser inédito: festivais da lista que pedem ineditismo
function premiereConflicts(id) {
  return S.all.filter((x) => x.id !== id && S.saved.has(x.id) && (S.track.get(x.id) || "quero") === "quero" && x.premiere && !noPremiere(x));
}

const CHECK_DEFAULT = ["Link de visionamento com senha", "Legendas em inglês", "Sinopse e ficha técnica", "Still e cartaz", "Taxa paga", "Confirmação da inscrição", "Cópia de exibição (DCP ou arquivo)", "Material de imprensa"];
const checklistOf = (r) => (Array.isArray(r?.checklist) ? r.checklist : CHECK_DEFAULT.map((t) => ({ t, d: false })));
function inscricaoHTML(f) {
  const r = rowOf(f.id) || {};
  const list = checklistOf(r);
  const done = list.filter((x) => x.d).length;
  const conflicts = r.status === "selecionado" ? premiereConflicts(f.id) : [];
  return `<section class="insc">
    ${filmOf() && S.films.length > 1 ? `<span class="kicker">Inscrição de “${esc(filmOf().title)}”</span>` : ""}
    ${conflicts.length ? `<div class="alert-est"><b>Atenção à estreia</b>Com esta seleção, o filme deixa de ser inédito. Na lista deste projeto, ${conflicts.map((x) => esc(x.name)).join(", ")} ${conflicts.length === 1 ? "pede" : "pedem"} ineditismo: confira o regulamento antes de inscrever.</div>` : ""}
    ${r.status === "selecionado" ? `<label class="award">Prêmio ou menção (opcional)<input id="in-award" maxlength="200" value="${esc(r.award || "")}" placeholder="ex.: Prêmio do júri"></label>` : ""}
    <span class="kicker">Checklist de materiais · ${done} de ${list.length}</span>
    <ul class="ck" id="in-ck">${list.map((x, i) => `<li><label><input type="checkbox" data-i="${i}" ${x.d ? "checked" : ""}><span>${esc(x.t)}</span></label><button type="button" class="link-btn ck-del" data-i="${i}" aria-label="Tirar ${esc(x.t)}">×</button></li>`).join("")}</ul>
    <form class="ck-add" id="in-ck-add"><input id="in-ck-new" maxlength="120" placeholder="Adicionar item" aria-label="Novo item do checklist"><button class="btn ghost">Adicionar</button></form>
    <label class="kicker" for="in-notes">Notas (só você vê)</label>
    <textarea id="in-notes" maxlength="4000" rows="4" placeholder="Senha do link enviado, contatos da curadoria, datas importantes…">${esc(r.notes || "")}</textarea>
    ${S.films.length > 1 ? `<div class="move"><label for="in-move">Mover para outra lista</label><select id="in-move"><option value="">escolha a lista</option>${S.films.filter((x) => x.id !== S.film).map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join("")}</select><small>A situação, o checklist e as notas vão junto.</small></div>` : ""}
    <p class="muted small" id="in-status" aria-live="polite"></p>
  </section>`;
}
async function saveRow(fid, patch) {
  const r = rowOf(fid);
  const { error } = await rowQuery(S.sb.from("saved_festivals").update(patch), fid);
  if (error) { console.error(error); $("#in-status").textContent = "Não foi possível salvar."; return false; }
  if (r) Object.assign(r, patch);
  $("#in-status").textContent = "Salvo.";
  return true;
}
function bindInscricao(f) {
  const r = rowOf(f.id) || {};
  let list = checklistOf(r).map((x) => ({ ...x }));
  const save = () => saveRow(f.id, { checklist: list }).then((ok) => ok && refreshDetail(f.id));
  $("#in-ck").onchange = (e) => { const i = +e.target.dataset.i; if (Number.isInteger(i)) { list[i].d = e.target.checked; save(); } };
  $("#in-ck").onclick = (e) => { if (e.target.classList.contains("ck-del")) { list.splice(+e.target.dataset.i, 1); save(); } };
  $("#in-ck-add").onsubmit = (e) => { e.preventDefault(); const t = $("#in-ck-new").value.trim(); if (!t) return; list.push({ t: t.slice(0, 120), d: false }); save(); };
  $("#in-notes").onchange = (e) => saveRow(f.id, { notes: e.target.value.slice(0, 4000) || null });
  if ($("#in-move")) $("#in-move").onchange = (e) => e.target.value && moveRow(f.id, e.target.value);
  if ($("#in-award")) $("#in-award").onchange = (e) => saveRow(f.id, { award: e.target.value.trim().slice(0, 200) || null });
}

// Move o festival salvo de uma lista para outra, levando situação, checklist e notas
async function moveRow(fid, to) {
  const from = S.film;
  const target = S.films.find((x) => x.id === to);
  if (S.rows.some((r) => r.festival_id === fid && r.film_id === to)) {
    $("#in-move").value = "";
    return toast(`Este festival já está em “${target?.title}”.`);
  }
  const { error } = await rowQuery(S.sb.from("saved_festivals").update({ film_id: to }), fid);
  if (error) { console.error(error); $("#in-move").value = ""; return toast("Não foi possível mover. Tente de novo."); }
  const r = S.rows.find((x) => x.festival_id === fid && x.film_id === from);
  if (r) r.film_id = to;
  applyFilm(); renderAccount(); renderTable();
  $("#detail").close();
  toast(`Movido para “${target?.title}”.`);
}

// ——— relatório de circulação (página para imprimir ou salvar em PDF) ———
async function openReport() {
  await loadFX();
  const film = filmOf();
  const list = S.all.filter((f) => S.saved.has(f.id) && (S.track.get(f.id) || "quero") !== "quero")
    .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
  const rowsData = list.map((f) => {
    const st = S.track.get(f.id); const r = rowOf(f.id) || {};
    const fee = feeFor(f); const v = toBRL(fee.v, fee.c);
    return { f, st, award: r.award, notes: r.notes, v, fee };
  });
  const sel = rowsData.filter((x) => x.st === "selecionado").length;
  const prizes = rowsData.filter((x) => x.award).length;
  const total = rowsData.reduce((n, x) => n + (x.v || 0), 0);
  const info = film ? [film.genre, film.duration_min ? `${film.duration_min} min` : "", film.country, film.finished_on ? `finalizado em ${fmt(film.finished_on).replace(/^\d+ /, "")}` : ""].filter(Boolean).join(" · ") : "";
  const today = new Date().toISOString().slice(0, 10);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de circulação · ${esc(film?.title || "Meus festivais")}</title>
<style>body{font-family:Geist,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0e0e0e;margin:40px auto;max-width:900px;padding:0 24px}
.k{font-family:"Geist Mono",Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#62625f}
h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:40px;margin:6px 0 4px}
.m{font-family:"Geist Mono",Menlo,monospace;font-size:12px;color:#62625f;margin-bottom:20px}
.sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 22px}.sum div{background:#effcc9;padding:10px 12px}.sum b{display:block;font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:28px}
table{width:100%;border-collapse:collapse;font-size:14px}th{font-family:"Geist Mono",Menlo,monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#62625f;text-align:left;padding:8px 6px;border-bottom:1px solid #0e0e0e;font-weight:400}td{padding:10px 6px;border-bottom:1px dotted #a9a9a4;vertical-align:top}
.t{font-family:"Geist Mono",Menlo,monospace;font-size:11px;padding:2px 7px;border:1px solid #0e0e0e;white-space:nowrap}.t.s{background:#c6ff3d;border-color:#c6ff3d}
.foot{font-size:12px;color:#62625f;margin-top:18px}button{font:inherit;background:#0e0e0e;color:#fff;border:0;border-radius:99px;padding:10px 18px;cursor:pointer;margin-top:18px}
.nt{display:none;font-size:12.5px;color:#62625f;margin-top:4px}body.com-notas .nt{display:block}.opt{display:block;font-size:13px;color:#62625f;margin:0 0 12px}
@media print{button,.opt{display:none}body{margin:0}}</style></head><body>
<div class="k">Radar de Festivais · relatório de circulação</div><h1>${esc(film?.title || "Meus festivais")}</h1>
<div class="m">${esc(info)}${info ? " · " : ""}gerado em ${fmt(today)}</div>
<div class="sum"><div><span class="k">Inscrições</span><b>${rowsData.length}</b></div><div><span class="k">Seleções</span><b>${sel}</b></div><div><span class="k">Prêmios</span><b>${prizes}</b></div><div><span class="k">Investido</span><b>${brl.format(total)}</b></div></div>
${rowsData.some((x) => x.notes) ? `<label class="opt"><input type="checkbox" onchange="document.body.classList.toggle('com-notas',this.checked)"> Incluir minhas notas (ficam de fora por padrão, porque podem ter senhas e contatos)</label>` : ""}
${rowsData.length ? `<table><thead><tr><th>Festival</th><th>País</th><th>Prazo</th><th>Resultado</th><th>Custo</th></tr></thead><tbody>${rowsData.map((x) => `<tr><td>${esc(x.f.name)}${x.notes ? `<div class="nt">${esc(x.notes).replace(/\n/g, "<br>")}</div>` : ""}</td><td>${esc(x.f.country || "")}</td><td>${x.f.deadline ? fmt(x.f.deadline) : ""}</td><td><span class="t${x.st === "selecionado" ? " s" : ""}">${esc(TRACK_LABEL[x.st])}</span>${x.award ? ` ${esc(x.award)}` : ""}</td><td>${x.fee.v === 0 ? "gratuito" : x.v != null ? brl.format(x.v) : ""}</td></tr>`).join("")}</tbody></table>` : `<p>Nenhuma inscrição marcada ainda. Em Meus salvos, marque os festivais como Inscrito, Selecionado ou Não selecionado.</p>`}
<p class="foot">Custos convertidos para reais pela cotação do dia${FX ? ` (${fmt(FX.date)})` : ""}. Fonte dos dados dos festivais: radardefestivais.com.br.</p>
<button onclick="print()">Imprimir ou salvar em PDF</button></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return toast("Permita janelas pop-up para abrir o relatório.");
  w.document.open(); w.document.write(html); w.document.close();
}

// ——— calendário anual (próximos 12 meses dos festivais da lista atual) ———
function renderCalendar(rows) {
  const cal = S.view === "cal";
  $(".tablebox").hidden = cal;
  $("#calview").hidden = !cal;
  $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === S.view)));
  if (!cal) return;
  $("#more").hidden = true;
  const now = new Date(); const months = [];
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), items: [] }); }
  for (const f of rows) {
    if (!f.deadline || days(f.deadline) < 0) continue;
    const [y, m] = f.deadline.split("-").map(Number);
    const box = months.find((x) => x.y === y && x.m === m - 1);
    if (box) box.items.push(f);
  }
  $("#calview").innerHTML = `<div class="cal">${months.map((mo, i) => `<div class="cal-m${i === 0 ? " now" : ""}"><h4>${MESES[mo.m]}${mo.m === 0 || i === 0 ? ` <small>${mo.y}</small>` : ""}</h4>${mo.items.sort((a, b) => a.deadline.localeCompare(b.deadline)).map((f) => `<button type="button" class="cal-i ${f._st.k === "hot" ? "hot" : f.dateStatus === "Confirmada" ? "" : "est"}" data-open="${esc(f.id)}"><i>${f.deadline.slice(8)}</i>${esc(f.name.split(":")[0])}</button>`).join("") || `<span class="muted small">sem prazos</span>`}</div>`).join("")}</div>
  <p class="muted small">Verde: prazo confirmado nos próximos 30 dias. Cinza: data prevista. Toque em um festival para ver a ficha.</p>`;
}

// ——— buscas salvas ———
function renderSearchTools(mine) {
  const btn = $("#save-search");
  const qs = searchParams();
  const existing = S.searches.find((x) => x.params === qs);
  $("#ss-bar").hidden = !(S.sb && qs && !mine && (!S.user || S.v3));
  btn.textContent = !S.user ? "☆ Entrar para salvar esta busca" : existing ? "★ Busca salva" : "☆ Salvar esta busca";
  btn.setAttribute("aria-pressed", String(!!existing));
  btn.title = existing ? "Toque para remover esta busca dos salvos" : "";
  const box = $("#searches");
  box.hidden = !(mine && S.v3);
  if (box.hidden) return;
  $("#searches-list").innerHTML = S.searches.length
    ? S.searches.map((x) => `<li data-id="${esc(x.id)}"><a href="/?${esc(x.params)}">${esc(x.label)}</a><label class="check sm"><input type="checkbox" class="ss-notify" ${x.notify ? "checked" : ""}><span>avisar por e-mail</span></label><button class="link-btn ss-del" aria-label="Remover a busca ${esc(x.label)}">remover</button></li>`).join("")
    : `<li class="muted">Nenhuma busca salva. Filtre a lista e toque em "Salvar esta busca" para ser avisado quando entrar um festival que combine.</li>`;
}

async function saveSearch() {
  if (!S.user) return login();
  const params = searchParams();
  if (!params) return;
  // Já salva: o mesmo botão remove (como a estrela dos festivais)
  const existing = S.searches.find((x) => x.params === params);
  if (existing) {
    const { error } = await S.sb.from("saved_searches").delete().eq("id", existing.id);
    if (error) { console.error(error); return toast("Não foi possível remover. Tente de novo."); }
    S.searches = S.searches.filter((x) => x.id !== existing.id);
    renderSearchTools(false);
    return toast("Busca removida dos salvos.");
  }
  const label = describeParams(params).slice(0, 300);
  const { data, error } = await S.sb.from("saved_searches").insert({ user_id: S.user.id, label, params }).select("id,label,params,notify").single();
  if (error) { console.error(error); return toast("Não foi possível salvar a busca. Tente de novo."); }
  S.searches.push(data);
  renderSearchTools(false);
  toast(S.profile?.email_opt_in === false ? "Busca salva. Para receber avisos, ligue os e-mails no seu perfil." : "Busca salva. Avisamos por e-mail quando entrar um festival que combine com ela.");
}

async function searchAction(e) {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.classList.contains("ss-del")) {
    const { error } = await S.sb.from("saved_searches").delete().eq("id", id);
    if (error) return toast("Não foi possível apagar.");
    S.searches = S.searches.filter((x) => x.id !== id);
    renderSearchTools(true);
    toast("Busca removida dos salvos.");
  } else if (e.target.classList.contains("ss-notify")) {
    const notify = e.target.checked;
    const { error } = await S.sb.from("saved_searches").update({ notify }).eq("id", id);
    if (error) { e.target.checked = !notify; return toast("Não foi possível salvar."); }
    const x = S.searches.find((y) => y.id === id); if (x) x.notify = notify;
  }
}

// ——— agenda assinável ———
async function openAgenda() {
  if (!S.user) return login();
  let token = S.profile?.calendar_token;
  if (!token) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    token = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    const { error } = await S.sb.from("profiles").update({ calendar_token: token }).eq("id", S.user.id);
    if (error) { console.error(error); return toast("Não foi possível criar sua agenda agora. Tente de novo."); }
    S.profile = { ...(S.profile || {}), calendar_token: token };
  }
  const https = `${location.origin}/agenda/${token}.ics${S.v4 && S.films.length > 1 && S.film ? `?filme=${S.film}` : ""}`;
  $("#ag-title").textContent = S.v4 && S.films.length > 1 ? `Agenda de “${filmOf()?.title}”` : "Assine sua agenda do Radar";
  $("#ag-url").value = https;
  $("#ag-apple").href = https.replace(/^https?:/, "webcal:");
  $("#ag-status").textContent = "";
  $("#agenda").showModal();
}

// ——— compartilhar: no celular abre o menu de compartilhamento; no computador copia o link ———
const SHARE_ICO = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></svg>`;
async function shareFestival(f) {
  const url = `${location.origin}/festival/${encodeURIComponent(f.id)}.html`;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.share) {
    try { await navigator.share({ title: f.name, text: `${f.name} no Radar de Festivais`, url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copiado."); }
  catch { prompt("Copie o link:", url); }
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
  add("Prazo de inscrição", `${f.deadline ? `<span class="mono">${fmt(f.deadline)}</span> ` : "a confirmar "}<span class="pill p-${st.k}">${st.label}</span>${f.deadline && f.dateStatus !== "Confirmada" ? `<br><span class="muted small">Data prevista com base na edição anterior; aguardando confirmação do festival.</span>` : ""}`);
  add("Próxima edição", esc(f.event));
  add("Local", esc([f.local, f.local && f.country && !f.local.includes(f.country) ? f.country : (!f.local ? f.country : "")].filter(Boolean).join(" · ")));
  add("Duração máxima", f.maxDuration != null ? `${f.maxDuration} min` : "");
  add("Gêneros aceitos", esc(f.genres.join(", ")));
  add("Qualifica para", esc(f.qualifies.map((q) => QUAL_LABEL[q]).join(", ")));
  add("Estreia", esc(f.premiere));
  add("Origem dos filmes", esc(ORIGIN_LABEL[f.origin] || ""));
  add("Quem pode inscrever", esc(f.restrictions));
  add("Temas", esc(f.themes.join(", ")));
  add("Inscrição", esc(f.fee));
  add("Prêmios e benefícios", esc(f.benefit));
  add("Observações", esc(f.notes));
  add("Última verificação", f.checkedAt ? fmt(f.checkedAt) : "");
  $("#dt-where").textContent = f.scope === "BR" ? "Brasil" : f.country || "";
  $("#dt-title").textContent = f.name;
  $("#dt-body").innerHTML = `<dl class="dl">${rows.join("")}</dl>${S.v4 && S.saved.has(id) ? inscricaoHTML(f) : ""}`;
  if (S.v4 && S.saved.has(id)) bindInscricao(f);

  const saved = S.saved.has(id);
  const inFilms = S.v4 ? S.films.filter((x) => S.rows.some((r) => r.festival_id === id && r.film_id === x.id)) : [];
  const acts = [];
  if (f.url) acts.push(`<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">Página de inscrição ↗</a>`);
  if (f.rulesUrl) acts.push(`<a class="btn ghost" href="${esc(f.rulesUrl)}" target="_blank" rel="noopener">Regulamento ↗</a>`);
  acts.push(`<button class="btn ghost" id="dt-share">${SHARE_ICO} Compartilhar</button>`);
  acts.push(`<button class="btn ghost" id="dt-save">${S.v4 && S.films.length > 1 ? (inFilms.length ? `★ Em ${inFilms.length === 1 ? `“${esc(inFilms[0].title)}”` : `${inFilms.length} projetos`}` : "☆ Salvar em um projeto") : saved ? "★ Salvo" : "☆ Salvar"}</button>`);
  if (saved && S.trackSupported) {
    const cur = S.track.get(id) || "quero";
    acts.push(`<label class="sr" for="dt-track">Situação</label><select id="dt-track">${TRACK.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select>`);
  }
  if (f.deadline && days(f.deadline) >= 0) {
    acts.push(`<a class="btn ghost" href="${googleCalUrl(f)}" target="_blank" rel="noopener">Google Agenda</a>`);
    acts.push(`<button class="btn ghost" id="dt-ics">Baixar .ics</button>`);
  }
  $("#dt-actions").innerHTML = acts.join("");
  $("#dt-save").onclick = () => saveClick(id);
  $("#dt-share").onclick = () => shareFestival(f);
  if ($("#dt-track")) $("#dt-track").onchange = (e) => setTrack(id, e.target.value);
  if ($("#dt-ics")) $("#dt-ics").onclick = () => downloadICS([f], `prazo-${f.id}.ics`);
  if (!$("#detail").open) $("#detail").showModal();
}

async function setTrack(id, status) {
  const prev = S.track.get(id);
  S.track.set(id, status);
  renderTable();
  const { error } = await rowQuery(S.sb.from("saved_festivals").update({ status }), id);
  if (!error) { const r = rowOf(id); if (r) r.status = status; }
  if (!error && status === "selecionado" && S.v4) { refreshDetail(id); const c = premiereConflicts(id); if (c.length) return toast(`Atenção à estreia: ${c.map((x) => x.name).join(", ")} ${c.length === 1 ? "pede" : "pedem"} ineditismo. Confira os regulamentos.`); }
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
const calText = (f) => `${f.dateStatus === "Confirmada" ? "" : "Data prevista com base na edição anterior; aguardando confirmação do festival.\n"}${f.fee ? `Inscrição: ${f.fee}\n` : ""}${f.url || ""}\n\nRadar de Festivais: ${location.origin}`;

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
  $$("[data-s]").forEach((b) => (b.onclick = () => { S.s = S.s === b.dataset.s ? "all" : b.dataset.s; update(); }));
  $("#q-free").onclick = () => { S.free = !S.free; update(); };
  $$("[data-sort]").forEach((b) => (b.onclick = () => { S.sortKey = b.dataset.sort; S.sortDir = 1; update(); }));
  const toList = () => $("#lista").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  $("#go").onclick = toList;
  $("#q").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); S.q = e.target.value.trim(); update(); toList(); } };
  const step = (dir) => { const st = $("#strip"); st.scrollBy({ left: dir * Math.max(240, st.clientWidth * 0.8), behavior: "smooth" }); };
  $("#strip-prev").onclick = () => step(-1);
  $("#strip-next").onclick = () => step(1);
  $("#strip").onclick = (e) => { const c = e.target.closest("[data-open]"); if (c) openDetail(c.dataset.open); };
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
  $("#acceptsbr").onchange = (e) => { S.acceptsBR = e.target.checked; update(); };
  $("#anyorigin").onchange = (e) => { S.anyOrigin = e.target.checked; update(); };
  $("#adv-clear").onclick = () => {
    S.genres.clear(); S.quals.clear(); S.themes.clear();
    S.country = ""; S.dur = null; S.unknown = true; S.free = false; S.noPremiere = false; S.acceptsBR = false; S.anyOrigin = false;
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
    if (b) return saveClick(b.dataset.id);
    if (e.target.closest("a")) return; // link de inscrição abre direto
    const row = e.target.closest("tr[data-open]");
    if (row) openDetail(row.dataset.open);
  };
  $("#mine-prefs").onclick = () => openProfile();
  $("#mine-cal").onclick = openAgenda;
  $("#mine-report").onclick = openReport;
  $("#films").onclick = (e) => {
    const b = e.target.closest("[data-film]"); if (b) return selectFilm(b.dataset.film);
    if (e.target.id === "film-new") return openFilm(null);
    if (e.target.id === "film-edit") return openFilm(filmOf());
  };
  $("#film-form").onsubmit = saveFilm;
  $("#si-list").onchange = async (e) => {
    const c = e.target.closest("[data-film]"); if (!c) return;
    c.disabled = true;
    let fid = c.dataset.film;
    if (fid === "__geral") { fid = await ensureGeneral(); if (fid) c.dataset.film = fid; }
    if (!fid || !(await saveInFilm($("#savein").dataset.id, fid, c.checked))) c.checked = !c.checked;
    c.disabled = false;
  };
  $("#si-new").onclick = () => { $("#si-new").hidden = true; $("#si-newbox").hidden = false; $("#si-name").focus(); };
  $("#si-create").onclick = createProjectAndSave;
  $("#si-name").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); createProjectAndSave(); } };
  $("#more").onclick = () => { S.limit += PAGE; renderTable(); };
  $("#fm-del").onclick = deleteFilm;
  $$("[data-view]").forEach((b) => (b.onclick = () => { S.view = b.dataset.view; renderTable(); }));
  $("#calview").onclick = (e) => { const c = e.target.closest("[data-open]"); if (c) openDetail(c.dataset.open); };
  $("#save-search").onclick = saveSearch;
  $("#searches-list").onclick = searchAction;
  $("#searches-list").onchange = searchAction;
  $("#ag-copy").onclick = async () => {
    try { await navigator.clipboard.writeText($("#ag-url").value); $("#ag-status").textContent = "Link copiado."; }
    catch { $("#ag-url").select(); $("#ag-status").textContent = "Selecione o link e copie."; }
  };
  $("#pf-changes").onchange = saveProfile;
  $("#calc-list").onchange = (e) => {
    const row = e.target.closest(".calc-row");
    if (!row) return;
    if (e.target.classList.contains("cr-st")) return setTrack(row.dataset.id, e.target.value).then(renderCalc);
    saveFee(row);
  };
  $("#mine-ics").onclick = () => downloadICS(S.all.filter((f) => S.saved.has(f.id)), "radar-de-festivais-salvos.ics");
  $("#mine-xlsx").onclick = () => downloadXlsx();
  $("#mine-all").onclick = () => { S.s = "all"; update(); };
  $("#dt-close").onclick = () => $("#detail").close();
  $("#detail").onclick = (e) => { if (e.target === $("#detail")) $("#detail").close(); };
  $("#pf-optin").onchange = saveProfile;
  $("#pf-days").onchange = saveProfile;
  $("#pf-logout").onclick = async () => { await S.sb.auth.signOut(); $("#profile").close(); };
}

// ——— início ———
async function init() {
  const qp = new URLSearchParams(location.search);
  S.authPending = qp.has("code") || qp.has("error_description");
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
  // vindo de uma página de festival (/?f=id): abre a ficha
  const fid = OPEN_ID;
  if (fid && S.all.some((x) => x.id === fid)) openDetail(fid);
}

// banner do Curió: só aparece quando houver link
(function curio() {
  const img = document.getElementById("curio-img");
  if (!img || !CONFIG.curioUrl || !CONFIG.curioBanner) return;
  img.href = CONFIG.curioUrl; img.hidden = false;

  // círculo flutuante: aparece depois do topo, some perto do banner, fecha no ×
  const fab = document.getElementById("cu-fab");
  const open = document.getElementById("cu-open");
  const KEY = "rdf-curio-fechado";
  let closed = false;
  try { closed = localStorage.getItem(KEY) === "1"; } catch {}
  if (!fab || closed || !CONFIG.curioFab) return;
  open.href = CONFIG.curioUrl;
  let bannerVisible = false;
  const update = () => { fab.hidden = closed || bannerVisible || window.scrollY < 500; if (fab.hidden) fab.classList.remove("open"); };
  new IntersectionObserver(([e]) => { bannerVisible = e.isIntersecting; update(); }).observe(img);
  addEventListener("scroll", update, { passive: true });
  // toque (sem mouse): o 1º toque abre, o 2º leva à Curió
  open.addEventListener("click", (e) => {
    if (matchMedia("(hover: none)").matches && !fab.classList.contains("open")) { e.preventDefault(); fab.classList.add("open"); }
  });
  document.addEventListener("click", (e) => { if (!fab.contains(e.target)) fab.classList.remove("open"); });
  document.getElementById("cu-x").addEventListener("click", () => {
    closed = true; update();
    try { localStorage.setItem(KEY, "1"); } catch {}
  });
  update();
})();

// faixa do topo: alterna as duas mensagens
(function rotateSoon() {
  const items = [...document.querySelectorAll(".soon-rot > span")];
  if (items.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let i = 0;
  setInterval(() => { items[i].classList.remove("on"); i = (i + 1) % items.length; items[i].classList.add("on"); }, 5000);
})();

init();
