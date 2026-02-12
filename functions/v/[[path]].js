export async function onRequest({ env, request, params }) {
  const key = (params.path || []).join("/");
  if (!key) return new Response("Falta archivo", { status: 400 });

  const range = request.headers.get("Range");

  // Si hay Range, pedimos rango a R2; si no, pedimos completo
  const obj = await env.VIDEOS.get(key, range ? { range } : undefined);
  if (!obj) return new Response("No encontrado", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // Si NO hay range, devolvemos 200 con el cuerpo completo
  if (!range) {
    // Content-Length ayuda a algunos navegadores
    if (typeof obj.size === "number") headers.set("Content-Length", String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  }

  // Si HAY range, R2 nos devuelve un objeto con "range"
  // y debemos responder 206 + Content-Range para que el video haga seek.
  const r = obj.range;
  if (!r) {
    // Si por alguna razón no viene, mandamos completo
    if (typeof obj.size === "number") headers.set("Content-Length", String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  }

  headers.set("Content-Range", `bytes ${r.offset}-${r.end}/${obj.size}`);
  headers.set("Content-Length", String(r.length));

  return new Response(obj.body, { status: 206, headers });
}
