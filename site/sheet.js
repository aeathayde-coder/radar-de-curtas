// Leitura da base de festivais (CSV). Usado no navegador e nas funções do servidor.

export const BLANK = new Set(["", "—", "-", "verificar", "a verificar", "n/d"]);
const clean = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return BLANK.has(s.toLowerCase()) ? null : s;
};
const key = (s) => String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// CSV (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Aceita 2026-11-15, 15/11/2026 e 15/11/26 (formato que o Sheets usa em pt-BR)
export function parseDate(v) {
  const s = clean(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const UF = /(?:\/\s*|,\s*)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;
export function deriveCountry(local) {
  if (!local) return null;
  if (UF.test(local)) return "Brasil";
  if (local.includes(",")) return local.split(",").pop().replace(/\(.*?\)/g, "").trim() || null;
  return null;
}

const slug = (s) => key(s).replace(/ /g, "-").slice(0, 48);
const safeUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
const NO = new Set(["nao", "n", "false", "0", "ocultar"]);
const STATUS = { confirmada: "Confirmada", estimada: "Estimada", "a confirmar": "A confirmar" };

// Cabeçalhos aceitos (sem acento/maiúsculas): o nome da coluna pode variar um pouco
const COLS = {
  id: ["id"],
  name: ["nome", "festival"],
  country: ["pais"],
  local: ["local", "cidade"],
  deadline: ["deadline", "prazo"],
  dateStatus: ["status da data"],
  event: ["data do evento", "proxima edicao"],
  maxDuration: ["duracao maxima min", "duracao maxima"],
  genres: ["generos aceitos", "generos"],
  fee: ["valor inscricao", "taxa"],
  benefit: ["premio beneficio", "premio"],
  url: ["link", "inscricao"],
  checkedAt: ["ultima verificacao"],
  publish: ["publicar"],
  qualifies: ["qualificacao", "qualificacoes", "qualifica para"],
  premiere: ["exigencia de estreia", "estreia"],
  restrictions: ["restricoes", "restricao", "quem pode inscrever"],
  themes: ["temas", "tema"],
  notes: ["observacoes", "observacao", "notas publicas"],
  rules: ["regulamento", "link do regulamento"],
};

// Nomes padronizados das qualificações (aceita variações escritas na planilha)
const QUAL = [["Oscar", /oscar|ampas|academy/i], ["BAFTA", /bafta/i], ["EFA", /\befa\b|european film/i], ["Goya", /goya/i]];
const list = (v) => (clean(v) || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);

export function rowsToFestivals(rows) {
  const [header, ...body] = rows;
  if (!header) return [];
  const h = header.map(key);
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, h.findIndex((c) => names.includes(c))]));
  if (idx.name < 0) throw new Error("A planilha precisa de uma coluna 'Nome'.");
  const get = (r, k) => (idx[k] >= 0 ? r[idx[k]] : undefined);

  const seen = new Set();
  const out = [];
  for (const r of body) {
    const name = clean(get(r, "name"));
    if (!name) continue;
    if (NO.has(key(get(r, "publish") || ""))) continue;
    let id = clean(get(r, "id")) || slug(name);
    if (seen.has(id)) id = `${id}-${seen.size}`;
    seen.add(id);
    const local = clean(get(r, "local"));
    const country = clean(get(r, "country")) || deriveCountry(local);
    const dur = parseFloat(String(get(r, "maxDuration") || "").replace(",", "."));
    out.push({
      id,
      name,
      url: safeUrl(clean(get(r, "url"))),
      local,
      country,
      scope: country && key(country) === "brasil" ? "BR" : "INT",
      deadline: parseDate(get(r, "deadline")),
      dateStatus: STATUS[key(get(r, "dateStatus") || "")] || "A confirmar",
      event: clean(get(r, "event")),
      maxDuration: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null,
      genres: (clean(get(r, "genres")) || "").split(/[,;]/).map((g) => g.trim()).filter(Boolean),
      fee: clean(get(r, "fee")),
      benefit: clean(get(r, "benefit")),
      checkedAt: parseDate(get(r, "checkedAt")),
      qualifies: (() => { const raw = list(get(r, "qualifies")).join(" "); return QUAL.filter(([, re]) => re.test(raw)).map(([n]) => n); })(),
      premiere: clean(get(r, "premiere")),
      restrictions: clean(get(r, "restrictions")),
      themes: list(get(r, "themes")),
      notes: clean(get(r, "notes")),
      rulesUrl: safeUrl(clean(get(r, "rules"))),
    });
  }
  return out;
}

export function sortFestivals(list) {
  return list.sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.name.localeCompare(b.name, "pt");
  });
}


// Baixa e interpreta a planilha publicada
export async function loadSheet(csvUrl, fetchImpl = fetch) {
  const res = await fetchImpl(csvUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Planilha respondeu ${res.status}`);
  const text = await res.text();
  if (/^\s*<!doctype html/i.test(text)) throw new Error("O link não é CSV: publique a aba como 'Valores separados por vírgula (.csv)'.");
  return sortFestivals(rowsToFestivals(parseCSV(text.replace(/^\uFEFF/, ""))));
}
