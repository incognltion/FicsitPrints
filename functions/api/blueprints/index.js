const allowedExtensions = new Set([".sbp", ".sbpcfg"]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function extensionFor(fileName) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function rowToBlueprint(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    author: row.author,
    downloads: row.downloads,
    category: row.category,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
  };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `select id, name, description, author, downloads, category, file_name, uploaded_at
     from blueprints
     order by uploaded_at desc`
  ).all();

  return json({ blueprints: results.map(rowToBlueprint) });
}

export async function onRequestPost({ request, env }) {
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const file = formData.get("file");

  if (!name) {
    return json({ error: "Blueprint name is required." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return json({ error: "Blueprint file is required." }, { status: 400 });
  }

  const extension = extensionFor(file.name);
  if (!allowedExtensions.has(extension)) {
    return json({ error: "Only .sbp and .sbpcfg files are accepted." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const r2Key = `blueprints/${id}/${file.name}`;

  await env.BLUEPRINT_FILES.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  const blueprint = {
    id,
    name,
    description: `Shared upload from ${file.name}.`,
    author: "Community",
    downloads: 0,
    category: "New",
    fileName: file.name,
    uploadedAt,
  };

  await env.DB.prepare(
    `insert into blueprints
      (id, name, description, author, downloads, category, file_name, r2_key, uploaded_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      blueprint.id,
      blueprint.name,
      blueprint.description,
      blueprint.author,
      blueprint.downloads,
      blueprint.category,
      blueprint.fileName,
      r2Key,
      blueprint.uploadedAt
    )
    .run();

  return json({ blueprint }, { status: 201 });
}
