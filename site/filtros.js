// Filtros da busca, compartilhados entre o site (app.js) e o servidor (avisos de busca salva).
export const norm = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Palavras que as pessoas usam na busca → termos que existem na base (sem acento, minúsculas)
export const SYNONYMS = {
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
// Palavras genéricas ("festival", "film", "de"...) não precisam bater: quem busca "Locarno Film Festival" quer o Locarno
const STOP = new Set(["festival", "festivais", "film", "films", "filme", "filmes", "fest", "de", "do", "da", "dos", "das", "e", "the", "of", "and", "international", "internacional", "int", "intl"]);
export const queryTerms = (q) => {
  const all = norm(q).split(/[^a-z0-9$€£-]+/).filter(Boolean);
  const key = all.filter((t) => !STOP.has(t));
  return (key.length ? key : all).map((t) => [t, ...(SYNONYMS[t] || [])]);
};

// "Gratuito": taxa ou observação dizem que a inscrição é grátis (inclui gratuito só para brasileiros)
export const isFree = (f) => /\b(gratuit|gr[aá]tis|isent|free)/i.test(`${f.fee || ""} ${f.notes || ""}`);
export const noPremiere = (f) => /n[aã]o exige|sem exig|n[aã]o requer/i.test(f.premiere || "");
// Origem aceita: vale a nacionalidade do filme (país de produção), não o passaporte de quem dirige
export const acceptsBR = (f) => f.origin === "any" || f.origin === "regional-br" || (f.origin === "national" && f.scope === "BR");

export function wordsOf(f) {
  return (f._words ||= norm([f.name, f.local, f.country, f.region, f.fee, f.benefit, f.event, (f.genres || []).join(" "), (f.qualifies || []).join(" "), (f.themes || []).join(" "), f.notes, f.restrictions, f.premiere].join(" ")).split(/[^a-z0-9$€£]+/).filter(Boolean));
}

// Mesma lógica do filtro do site, a partir dos parâmetros da URL (?g=...&dur=...),
// usada para avisar quando um festival novo combina com uma busca salva.
// "s" (situação) e "Meus salvos" não entram: o aviso é sobre festivais novos.
export function matchesParams(f, params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const unknown = p.get("inc") !== "0";
  const list = (k) => (p.get(k) || "").split(",").filter(Boolean);
  const r = p.get("r");
  if ((r === "BR" || r === "INT") && f.scope !== r) return false;
  if (p.get("pais") && f.country !== p.get("pais")) return false;
  const g = list("g");
  if (g.length) {
    if (!f.genres.length) { if (!unknown) return false; }
    else if (!f.genres.some((x) => g.includes(x))) return false;
  }
  const dur = parseInt(p.get("dur"), 10);
  if (dur) {
    if (f.maxDuration == null) { if (!unknown) return false; }
    else if (f.maxDuration < dur) return false;
  }
  const ql = list("ql");
  if (ql.length && !f.qualifies.some((q) => ql.includes(q))) return false;
  const tema = list("tema");
  if (tema.length && !f.themes.some((t) => tema.includes(t))) return false;
  if (p.get("gratis") === "1" && !isFree(f)) return false;
  if (p.get("semestreia") === "1" && !noPremiere(f)) return false;
  if (p.get("br") === "1" && (f.origin ? !acceptsBR(f) : !unknown)) return false;
  if (p.get("mundo") === "1" && (f.origin ? f.origin !== "any" : !unknown)) return false;
  const q = p.get("q");
  if (q) {
    const words = wordsOf(f);
    if (!queryTerms(q).every((alts) => alts.some((t) => words.some((w) => w.startsWith(t))))) return false;
  }
  return true;
}

// Rótulo legível de uma busca ("Documentário · filme de 20 min · aceitam brasileiros")
export function describeParams(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const parts = [];
  if (p.get("q")) parts.push(`"${p.get("q")}"`);
  if (p.get("r") === "BR") parts.push("Brasil");
  if (p.get("r") === "INT") parts.push("Mundo");
  if (p.get("pais")) parts.push(p.get("pais"));
  (p.get("g") || "").split(",").filter(Boolean).forEach((g) => parts.push(g));
  if (p.get("dur")) parts.push(`filme de ${p.get("dur")} min`);
  (p.get("ql") || "").split(",").filter(Boolean).forEach((q) => parts.push(`qualifica para ${q}`));
  (p.get("tema") || "").split(",").filter(Boolean).forEach((t) => parts.push(t));
  if (p.get("gratis") === "1") parts.push("inscrição gratuita");
  if (p.get("semestreia") === "1") parts.push("não exigem estreia");
  if (p.get("br") === "1") parts.push("aceitam filmes brasileiros");
  if (p.get("mundo") === "1") parts.push("abertos a qualquer país");
  return parts.join(" · ");
}
