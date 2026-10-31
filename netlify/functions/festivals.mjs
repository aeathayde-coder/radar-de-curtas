import { fetchFestivals } from "../lib/festivals.mjs";

export default async () => {
  try {
    const festivals = await fetchFestivals();
    return Response.json(
      { generatedAt: new Date().toISOString(), festivals },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          // CDN do Netlify: serve do cache por 10 min e revalida em segundo plano.
          "Netlify-CDN-Cache-Control": "public, durable, s-maxage=600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Não foi possível carregar os festivais agora." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
};

export const config = { path: "/api/festivals" };
