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

export async function onRequestPut({ request, env, params }) {
  const existing = await env.DB.prepare(
    `select * from blueprints where id = ?`
  ).bind(params.id).first();

  if (!existing) {
    return json({ error: "Blueprint not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const ownerId = String(formData.get("ownerId") || "").trim();
  const author = String(formData.get("author") || existing.author).trim();
  const authorAvatar = String(formData.get("authorAvatar") || existing.author_avatar || "").trim();

  if (!ownerId || ownerId !== existing.owner_id) {
    return json({ error: "This browser cannot update that blueprint." }, { status: 403 });
  }

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tags = JSON.parse(String(formData.get("tags") || "[]")).filter((tag) => typeof tag === "string");
  const materials = JSON.parse(String(formData.get("materials") || "[]")).filter((material) => {
    return material && typeof material.id === "string" && Number(material.quantity) > 0;
  });
  const file = formData.get("file");
  const image = formData.get("image");
  let r2Key = existing.r2_key;
  let fileName = existing.file_name;
  let imageKey = existing.image_key || "";

  if (file instanceof File && file.size > 0) {
    const extension = extensionFor(file.name);
    if (!allowedExtensions.has(extension)) {
      return json({ error: "Only .sbp and .sbpcfg files are accepted." }, { status: 400 });
    }

    r2Key = `blueprints/${params.id}/${file.name}`;
    fileName = file.name;
    await env.BLUEPRINT_FILES.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });
  }

  if (image instanceof File && image.size > 0) {
    imageKey = `blueprints/${params.id}/preview-${image.name}`;
    await env.BLUEPRINT_FILES.put(imageKey, image.stream(), {
      httpMetadata: {
        contentType: image.type || "application/octet-stream",
      },
    });
  }

  await env.DB.prepare(
    `update blueprints
     set name = ?, description = ?, author = ?, author_avatar = ?, category = ?, tags = ?, materials = ?, image_key = ?, file_name = ?, r2_key = ?
     where id = ?`
  )
    .bind(
      name || existing.name,
      description || existing.description,
      author,
      authorAvatar,
      tags[0] || existing.category,
      JSON.stringify(tags),
      JSON.stringify(materials),
      imageKey,
      fileName,
      r2Key,
      params.id
    )
    .run();

  const updated = await env.DB.prepare(
    `select id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_key, file_name, uploaded_at
     from blueprints where id = ?`
  ).bind(params.id).first();

  return json({ blueprint: rowToBlueprint(updated) });
}
