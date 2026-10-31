// Preview local sem credenciais: serve site/ e simula /api/* com site/dados/festivais.csv.
// Uso: node tests/preview-server.mjs [porta] [--auth]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { readFileSync } from "node:fs";
import { parseCSV, rowsToFestivals, sortFestivals } from "../netlify/lib/festivals.mjs";

const port = Number(process.argv[2]) || 8888;
const withAuth = process.argv.includes("--auth");
const root = new URL("../site/", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const festivals = sortFestivals(rowsToFestivals(parseCSV(readFileSync(new URL("../site/dados/festivais.csv", import.meta.url), "utf8"))));

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/festivals") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ festivals }));
    }
    if (url.pathname === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(withAuth ? { supabaseUrl: "https://fake.supabase.co", supabaseAnonKey: "anon" } : {}));
    }
    const file = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  })
  .listen(port, () => console.log(`preview em http://localhost:${port}${withAuth ? " (login simulado)" : ""}`));
