function extensionFor(fileName) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function safeFileBaseName(name) {
  return name.trim().replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-") || "ficsitprint";
}

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const requestedExtension = url.searchParams.get("extension") || "";

  if (![".sbp", ".sbpcfg"].includes(requestedExtension)) {
    return new Response("Unsupported download format.", { status: 400 });
  }

  const row = await env.DB.prepare(
    `select id, name, file_name, r2_key from blueprints where id = ?`
  ).bind(params.id).first();

  if (!row) {
    return new Response("Blueprint not found.", { status: 404 });
  }

  const object = await env.BLUEPRINT_FILES.get(row.r2_key);
  if (!object) {
    return new Response("Blueprint file not found.", { status: 404 });
  }

  await env.DB.prepare(
    `update blueprints set downloads = downloads + 1 where id = ?`
  ).bind(params.id).run();

  const originalExtension = extensionFor(row.file_name);
  const downloadName = `${safeFileBaseName(row.name)}${requestedExtension || originalExtension}`;

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
