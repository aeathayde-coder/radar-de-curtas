import { verifyUnsubscribe } from "../lib/reminders.mjs";
import { admin } from "../lib/supabase-admin.mjs";

const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><body style="font-family:Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#16191f">
<h1 style="font-size:24px">${title}</h1><p style="color:#5b6270">${body}</p><p><a href="/" style="color:#d9480f">Voltar ao Radar de Curtas</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

const UUID = /^[0-9a-f-]{36}$/i;

export default async (req) => {
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const t = url.searchParams.get("t");
  if (!UUID.test(u || "") || !verifyUnsubscribe(u, t, process.env.UNSUBSCRIBE_SECRET)) {
    return page("Link inválido", "Este link de cancelamento não é válido. Você também pode desligar os lembretes no seu perfil do site.", 400);
  }
  // GET mostra confirmação; POST (one-click do provedor de e-mail ou botão) efetiva
  if (req.method === "GET") {
    return page(
      "Parar lembretes?",
      `Você deixará de receber e-mails de prazo. Os festivais salvos continuam no seu perfil.</p>
<form method="post"><button style="font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #16191f;background:#16191f;color:#fff;cursor:pointer">Confirmar</button></form><p>`,
    );
  }
  try {
    await admin().patch(`/profiles?id=eq.${u}`, { email_opt_in: false });
    return page("Lembretes desligados", "Pronto. Para voltar a receber, ative os lembretes no seu perfil do site.");
  } catch (err) {
    console.error(err);
    return page("Algo deu errado", "Tente de novo em alguns minutos.", 500);
  }
};

export const config = { path: "/api/unsubscribe" };
