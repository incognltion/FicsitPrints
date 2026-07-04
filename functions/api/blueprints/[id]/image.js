export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare(
    `select image_key from blueprints where id = ?`
  ).bind(params.id).first();

  if (!row || !row.image_key) {
    return new Response("Image not found.", { status: 404 });
  }

  const object = await env.BLUEPRINT_FILES.get(row.image_key);
  if (!object) {
    return new Response("Image not found.", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
