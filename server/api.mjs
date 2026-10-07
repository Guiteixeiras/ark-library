const API = "https://api.mangadex.org";
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const cache = new Map();
const requests = new Map();

function reply(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function upstream(path) {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (requests.has(path)) return requests.get(path);
  const pending = (async () => {
    const response = await fetch(`${API}${path}`, {
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/json",
        "User-Agent": "ARK-Library/0.1 (personal library)",
      },
    });
    if (!response.ok) {
      const error = new Error(
        response.status === 429
          ? "O MangaDex está recebendo muitas consultas. Tente novamente em alguns instantes."
          : "O MangaDex está indisponível no momento. Tente novamente.",
      );
      error.status = response.status === 429 ? 429 : 502;
      throw error;
    }
    const data = await response.json();
    if (data.result !== "ok")
      throw new Error("Não foi possível consultar o MangaDex.");
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(path, { data, expires: Date.now() + 120000 });
    return data;
  })();
  requests.set(path, pending);
  try {
    return await pending;
  } finally {
    requests.delete(path);
  }
}

const assignments = new Map();
const assignmentRequests = new Map();
async function assignment(id, fresh = false) {
  if (!fresh && assignments.get(id)?.expires > Date.now()) return assignments.get(id).data;
  if (assignmentRequests.has(id)) return assignmentRequests.get(id);
  const pending = (async () => {
    const response = await fetch(`${API}/at-home/server/${id}`, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "ARK-Library/0.1 (personal reader)" },
    });
    if (!response.ok) {
      const error = new Error(response.status === 404
        ? "Este capítulo não está disponível para leitura no MangaDex. Escolha outra tradução ou capítulo."
        : "Não foi possível carregar o capítulo. Tente novamente.");
      error.status = response.status === 404 ? 404 : 502;
      throw error;
    }
    const data = await response.json();
    const base = new URL(data.baseUrl);
    if (base.protocol !== "https:" || base.port || base.username || base.password || base.search || base.hash ||
        !(base.hostname.endsWith(".mangadex.network") || base.hostname === "uploads.mangadex.org") ||
        !/^[a-f\d]{32}$/i.test(data.chapter?.hash) ||
        !Array.isArray(data.chapter.data) || !data.chapter.data.length || data.chapter.data.length > 1000 ||
        data.chapter.data.some(file => !/^[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(file)))
      throw new Error("Resposta de leitura inválida.");
    if (assignments.size >= 200) assignments.delete(assignments.keys().next().value);
    assignments.set(id, { data, expires: Date.now() + 30000 });
    return data;
  })();
  assignmentRequests.set(id, pending);
  try { return await pending; } finally { assignmentRequests.delete(id); }
}

function localText(t = {}) {
  return t["pt-br"] || t.pt || t.en || Object.values(t).find(Boolean) || "";
}

function manga(item) {
  const a = item.attributes;
  const alternatives = a.altTitles || [];
  const preferred =
    alternatives.find((t) => t["pt-br"]) || alternatives.find((t) => t.en);
  const cover = item.relationships.find((r) => r.type === "cover_art");
  const file = cover?.attributes?.fileName;
  return {
    id: item.id,
    title: preferred ? localText(preferred) : localText(a.title),
    originalTitle: localText(a.title),
    description: localText(a.description),
    cover: file ? `/api/cover/${item.id}/${encodeURIComponent(file)}` : null,
    kind:
      a.originalLanguage === "ko"
        ? "Manhwa"
        : ["zh", "zh-hk"].includes(a.originalLanguage)
          ? "Manhua"
          : "Mangá",
    status: a.status,
    year: a.year,
    tags: (a.tags || [])
      .filter((t) => t.attributes.group === "genre")
      .map((t) => localText(t.attributes.name)),
    languages: a.availableTranslatedLanguages || [],
    url: `https://mangadex.org/title/${item.id}`,
  };
}

export async function apiMiddleware(req, res, next) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return next();
  if (req.method !== "GET")
    return reply(res, 405, { error: "Método não permitido." });
  try {
    if (url.pathname === "/api/health")
      return reply(res, 200, { ok: true, service: "ark-library" });
    if (url.pathname === "/api/catalog") {
      const query = (url.searchParams.get("query") || "").trim();
      const kind = url.searchParams.get("kind") || "all";
      const page = Number(url.searchParams.get("page") || "1");
      const genre = url.searchParams.get("genre") || "all";
      const status = url.searchParams.get("status") || "all";
      const language = url.searchParams.get("language") || "pt-br";
      const sort =
        url.searchParams.get("sort") || (query ? "relevance" : "popular");
      if (
        query.length > 120 ||
        !["all", "manga", "manhwa", "manhua"].includes(kind) ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 417 ||
        (genre !== "all" && !UUID.test(genre)) ||
        !["all", "ongoing", "completed", "hiatus", "cancelled"].includes(
          status,
        ) ||
        !["pt-br", "en", "es", "all"].includes(language) ||
        !["popular", "latest", "title", "relevance"].includes(sort)
      )
        return reply(res, 400, { error: "Busca inválida." });
      const params = new URLSearchParams({
        limit: String(Math.min(24, 10000 - (page - 1) * 24)),
        offset: String((page - 1) * 24),
        "includes[]": "cover_art",
        hasAvailableChapters: "true",
      });
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
      if (language !== "all")
        params.append("availableTranslatedLanguage[]", language);
      if (genre !== "all") params.append("includedTags[]", genre);
      if (status !== "all") params.append("status[]", status);
      if (query) params.set("title", query);
      const order =
        sort === "title"
          ? "title"
          : sort === "latest"
            ? "latestUploadedChapter"
            : sort === "relevance" && query
              ? "relevance"
              : "followedCount";
      params.set(`order[${order}]`, sort === "title" ? "asc" : "desc");
      params.set("order[createdAt]", "desc");
      for (const language of {
        manga: ["ja"],
        manhwa: ["ko"],
        manhua: ["zh", "zh-hk"],
      }[kind] || [])
        params.append("originalLanguage[]", language);
      const data = await upstream(`/manga?${params}`);
      return reply(res, 200, {
        items: data.data.map(manga),
        total: data.total,
        page,
        limit: data.limit,
      });
    }
    const cover = url.pathname.match(/^\/api\/cover\/([^/]+)\/([^/]+)$/);
    if (cover) {
      const [, id, file] = cover;
      if (!UUID.test(id) || !/^[\w.-]+\.(jpg|png|webp|gif)$/i.test(file))
        return reply(res, 400, { error: "Capa inválida." });
      const response = await fetch(
        `https://uploads.mangadex.org/covers/${id}/${file}.256.jpg`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!response.ok) return reply(res, 502, { error: "Capa indisponível." });
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/"))
        return reply(res, 502, { error: "Capa indisponível." });
      const bytes = Buffer.from(await response.arrayBuffer());
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      return res.end(bytes);
    }
    const chapterRoute = url.pathname.match(
      /^\/api\/manga\/([^/]+)\/chapters$/,
    );
    if (chapterRoute) {
      const id = chapterRoute[1];
      if (!UUID.test(id)) return reply(res, 400, { error: "Obra inválida." });
      const language = url.searchParams.get("language") || "pt-br";
      const page = Number(url.searchParams.get("page") || 1);
      if (!Number.isInteger(page) || page < 1 || page > 250)
        return reply(res, 400, { error: "Página de capítulos inválida." });
      if (!["pt-br", "en", "es", "all"].includes(language))
        return reply(res, 400, { error: "Idioma inválido." });
      const params = new URLSearchParams({
        limit: "40",
        offset: String((page - 1) * 40),
        "order[chapter]": "asc",
        "includes[]": "scanlation_group",
        includeExternalUrl: "0",
        includeUnavailable: "0",
      });
      if (language !== "all") params.set("translatedLanguage[]", language);
      const data = await upstream(`/manga/${id}/feed?${params}`);
      return reply(res, 200, {
        total: data.total,
        page,
        items: data.data.map((c) => ({
          id: c.id,
          number: c.attributes.chapter,
          title: c.attributes.title || "",
          language: c.attributes.translatedLanguage,
          group:
            c.relationships.find((r) => r.type === "scanlation_group")
              ?.attributes?.name || "Grupo não informado",
          url: `https://mangadex.org/chapter/${c.id}`,
        })),
      });
    }
    const pagesRoute = url.pathname.match(/^\/api\/chapter\/([^/]+)\/pages$/);
    if (pagesRoute) {
      const id = pagesRoute[1];
      if (!UUID.test(id)) return reply(res, 400, { error: "Capítulo inválido." });
      const data = await assignment(id, true);
      return reply(res, 200, {
        pages: data.chapter.data.map((_, index) => `/api/chapter/${id}/image/${index}`),
      });
    }
    const imageRoute = url.pathname.match(/^\/api\/chapter\/([^/]+)\/image\/(\d+)$/);
    if (imageRoute) {
      const [, id, rawIndex] = imageRoute;
      const index = Number(rawIndex);
      if (!UUID.test(id) || !Number.isSafeInteger(index) || index > 1000)
        return reply(res, 400, { error: "Página inválida." });
      const data = await assignment(id);
      if (!data.chapter.data[index]) return reply(res, 404, { error: "Página não encontrada." });
      const imageUrl = `${data.baseUrl.replace(/\/$/, "")}/data/${data.chapter.hash}/${data.chapter.data[index]}`;
      const started = performance.now();
      let bytes = 0, cached = false, success = false;
      try {
        const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20000), redirect: "error" });
        cached = (response.headers.get("x-cache") || "").startsWith("HIT");
        if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/"))
          throw new Error("Página indisponível.");
        const body = Buffer.from(await response.arrayBuffer());
        bytes = body.length;
        success = true;
        res.writeHead(200, {
          "Content-Type": response.headers.get("content-type"),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(body);
      } finally {
        if (new URL(data.baseUrl).hostname.endsWith(".mangadex.network")) {
          // Delivery telemetry required by MangaDex@Home; contains no user data.
          void fetch("https://api.mangadex.network/report", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: imageUrl, success, cached, bytes, duration: Math.round(performance.now() - started) }),
            signal: AbortSignal.timeout(8000),
          }).catch(() => console.error("[ARK API] Relatório MangaDex@Home indisponível."));
        }
        if (!success) {
          assignments.delete(id);
          await assignment(id, true).catch(() => {});
        }
      }
    }
    return reply(res, 404, { error: "Recurso não encontrado." });
  } catch (error) {
    console.error(`[ARK API] ${url.pathname}: ${error.message}`);
    return reply(res, error.status || 502, {
      error: error.status
        ? error.message
        : "Não foi possível acessar o MangaDex. Confira a conexão e tente novamente.",
    });
  }
}
