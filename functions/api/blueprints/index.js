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
    ownerId: row.owner_id,
    authorAvatar: row.author_avatar,
    downloads: row.downloads,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    materials: row.materials ? JSON.parse(row.materials) : [],
    imageUrl: row.image_key ? `/api/blueprints/${row.id}/image` : "",
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
  };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `select id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_key, file_name, uploaded_at
     from blueprints
     order by uploaded_at desc`
  ).all();

  return json({ blueprints: results.map(rowToBlueprint) });
}

export async function onRequestPost({ request, env }) {
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tags = JSON.parse(String(formData.get("tags") || "[]")).filter((tag) => typeof tag === "string");
  const materials = JSON.parse(String(formData.get("materials") || "[]")).filter((material) => {
    return material && typeof material.id === "string" && Number(material.quantity) > 0;
  });
  const ownerId = String(formData.get("ownerId") || "").trim();
  const author = String(formData.get("author") || "Community").trim();
  const authorAvatar = String(formData.get("authorAvatar") || "").trim();
  const file = formData.get("file");
  const image = formData.get("image");

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
  const imageKey = image instanceof File && image.size > 0 ? `blueprints/${id}/preview-${image.name}` : "";

  await env.BLUEPRINT_FILES.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  if (imageKey) {
    await env.BLUEPRINT_FILES.put(imageKey, image.stream(), {
      httpMetadata: {
        contentType: image.type || "application/octet-stream",
      },
    });
  }

  const blueprint = {
    id,
    name,
    description: description || `Shared upload from ${file.name}.`,
    author,
    ownerId,
    authorAvatar,
    downloads: 0,
    category: tags[0] || "New",
    tags,
    materials,
    imageUrl: imageKey ? `/api/blueprints/${id}/image` : "",
    fileName: file.name,
    uploadedAt,
  };

  await env.DB.prepare(
    `insert into blueprints
      (id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_key, file_name, r2_key, uploaded_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      blueprint.id,
      blueprint.name,
      blueprint.description,
      blueprint.author,
      blueprint.ownerId,
      blueprint.authorAvatar,
      blueprint.downloads,
      blueprint.category,
      JSON.stringify(blueprint.tags),
      JSON.stringify(blueprint.materials),
      imageKey,
      blueprint.fileName,
      r2Key,
      blueprint.uploadedAt
    )
    .run();

  return json({ blueprint }, { status: 201 });
}
