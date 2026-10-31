// Acesso de servidor ao Supabase (PostgREST) com a service role key. Nunca usar no navegador.
export function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function req(path, init = {}) {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`Supabase ${res.status} em ${path}: ${await res.text()}`);
    return res.status === 204 || init.method === "PATCH" ? null : res.json().catch(() => null);
  }

  return {
    // Lê tudo em páginas de 1000 linhas
    async selectAll(path) {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const page = await req(path, { headers: { Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
        out.push(...page);
        if (page.length < 1000) return out;
      }
    },
    insert: (table, rows, onConflict) =>
      req(`/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      }),
    patch: (pathWithFilter, body) =>
      req(pathWithFilter, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) }),
  };
}
