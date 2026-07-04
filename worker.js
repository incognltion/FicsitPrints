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

function safeFileBaseName(name) {
  return name.trim().replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-") || "ficsitprint";
}

function base64FromBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function bytesFromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function fileToBase64(file) {
  return base64FromBytes(new Uint8Array(await file.arrayBuffer()));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanTags(value) {
  return parseJsonArray(value).filter((tag) => typeof tag === "string");
}

function cleanMaterials(value) {
  return parseJsonArray(value).filter((material) => {
    return material && typeof material.id === "string" && Number(material.quantity) > 0;
  });
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
    tags: parseJsonArray(row.tags),
    materials: parseJsonArray(row.materials),
    imageUrl: row.image_data ? `/api/blueprints/${row.id}/image` : "",
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
  };
}

async function listBlueprints(env) {
  const { results } = await env.DB.prepare(
    `select id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_data, file_name, uploaded_at
     from blueprints
     order by uploaded_at desc`
  ).all();

  return json({ blueprints: results.map(rowToBlueprint) });
}

async function createBlueprint(request, env) {
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tags = cleanTags(formData.get("tags"));
  const materials = cleanMaterials(formData.get("materials"));
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
  const fileData = await fileToBase64(file);
  const fileType = file.type || "application/octet-stream";
  const hasImage = image instanceof File && image.size > 0;
  const imageData = hasImage ? await fileToBase64(image) : "";
  const imageType = hasImage ? image.type || "application/octet-stream" : "";

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
    imageUrl: imageData ? `/api/blueprints/${id}/image` : "",
    fileName: file.name,
    uploadedAt,
  };

  await env.DB.prepare(
    `insert into blueprints
      (id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_data, image_type, file_name, file_type, file_data, uploaded_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      imageData,
      imageType,
      blueprint.fileName,
      fileType,
      fileData,
      blueprint.uploadedAt
    )
    .run();

  return json({ blueprint }, { status: 201 });
}

async function updateBlueprint(request, env, id) {
  const existing = await env.DB.prepare(
    `select * from blueprints where id = ?`
  ).bind(id).first();

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
  const tags = cleanTags(formData.get("tags"));
  const materials = cleanMaterials(formData.get("materials"));
  const file = formData.get("file");
  const image = formData.get("image");
  let fileName = existing.file_name;
  let fileType = existing.file_type || "application/octet-stream";
  let fileData = existing.file_data;
  let imageType = existing.image_type || "";
  let imageData = existing.image_data || "";

  if (file instanceof File && file.size > 0) {
    const extension = extensionFor(file.name);
    if (!allowedExtensions.has(extension)) {
      return json({ error: "Only .sbp and .sbpcfg files are accepted." }, { status: 400 });
    }

    fileName = file.name;
    fileType = file.type || "application/octet-stream";
    fileData = await fileToBase64(file);
  }

  if (image instanceof File && image.size > 0) {
    imageType = image.type || "application/octet-stream";
    imageData = await fileToBase64(image);
  }

  await env.DB.prepare(
    `update blueprints
     set name = ?, description = ?, author = ?, author_avatar = ?, category = ?, tags = ?, materials = ?, image_data = ?, image_type = ?, file_name = ?, file_type = ?, file_data = ?
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
      imageData,
      imageType,
      fileName,
      fileType,
      fileData,
      id
    )
    .run();

  const updated = await env.DB.prepare(
    `select id, name, description, author, owner_id, author_avatar, downloads, category, tags, materials, image_data, file_name, uploaded_at
     from blueprints where id = ?`
  ).bind(id).first();

  return json({ blueprint: rowToBlueprint(updated) });
}

async function getBlueprintImage(env, id) {
  const row = await env.DB.prepare(
    `select image_data, image_type from blueprints where id = ?`
  ).bind(id).first();

  if (!row || !row.image_data) {
    return new Response("Image not found.", { status: 404 });
  }

  return new Response(bytesFromBase64(row.image_data), {
    headers: {
      "Content-Type": row.image_type || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function downloadBlueprint(request, env, id) {
  const url = new URL(request.url);
  const requestedExtension = url.searchParams.get("extension") || "";

  if (![".sbp", ".sbpcfg"].includes(requestedExtension)) {
    return new Response("Unsupported download format.", { status: 400 });
  }

  const row = await env.DB.prepare(
    `select id, name, file_name, file_type, file_data from blueprints where id = ?`
  ).bind(id).first();

  if (!row) {
    return new Response("Blueprint not found.", { status: 404 });
  }

  if (!row.file_data) {
    return new Response("Blueprint file not found.", { status: 404 });
  }

  await env.DB.prepare(
    `update blueprints set downloads = downloads + 1 where id = ?`
  ).bind(id).run();

  const originalExtension = extensionFor(row.file_name);
  const downloadName = `${safeFileBaseName(row.name)}${requestedExtension || originalExtension}`;

  return new Response(bytesFromBase64(row.file_data), {
    headers: {
      "Content-Type": row.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}

async function handleApi(request, env, pathname) {
  if (pathname === "/api/blueprints" && request.method === "GET") {
    return listBlueprints(env);
  }

  if (pathname === "/api/blueprints" && request.method === "POST") {
    return createBlueprint(request, env);
  }

  const match = pathname.match(/^\/api\/blueprints\/([^/]+)(?:\/(image|download))?$/);
  if (!match) {
    return json({ error: "API route not found." }, { status: 404 });
  }

  const id = decodeURIComponent(match[1]);
  const action = match[2] || "";

  if (!action && request.method === "PUT") {
    return updateBlueprint(request, env, id);
  }

  if (action === "image" && request.method === "GET") {
    return getBlueprintImage(env, id);
  }

  if (action === "download" && request.method === "GET") {
    return downloadBlueprint(request, env, id);
  }

  return json({ error: "Method not allowed." }, { status: 405 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url.pathname);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  },
};
