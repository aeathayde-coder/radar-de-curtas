// Servidor (lembretes): reaproveita o leitor da base do site.
import { loadSheet } from "../../site/sheet.js";
export { parseCSV, parseDate, rowsToFestivals, sortFestivals, deriveCountry } from "../../site/sheet.js";

let memo = { at: 0, data: null };
const MEMO_MS = 5 * 60 * 1000;

// Por padrão lê a base publicada no próprio site (site/dados/festivais.csv)
const defaultCsvUrl = () =>
  process.env.SHEET_CSV_URL || (process.env.URL ? `${process.env.URL.replace(/\/$/, "")}/dados/festivais.csv` : null);

export async function fetchFestivals({ csvUrl = defaultCsvUrl(), fresh = false } = {}) {
  if (!fresh && memo.data && Date.now() - memo.at < MEMO_MS) return memo.data;
  if (!csvUrl) throw new Error("Endereço da base de festivais indisponível (variável URL do Netlify ausente).");
  const data = await loadSheet(csvUrl);
  memo = { at: Date.now(), data };
  return data;
}
// ——— datas no fuso de São Paulo ———
export function todayBRT(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
export function daysBetween(fromIso, toIso) {
  const [a, b] = [fromIso, toIso].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}
