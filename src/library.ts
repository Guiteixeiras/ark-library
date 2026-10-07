import type { Collection, CollectionItem, Manga } from "./types";

export const STORAGE_KEY = "ark-library:collection:v1";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const strings = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((s) => text(s, 150));

export function validItem(value: unknown): value is CollectionItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CollectionItem>;
  const m = item.manga as Partial<Manga> | undefined;
  if (!m || typeof m !== "object" || !text(m.id, 36) || !UUID.test(m.id))
    return false;
  return (
    text(m.title, 500) &&
    m.title.trim().length > 0 &&
    text(m.originalTitle, 500) &&
    text(m.description, 30000) &&
    (m.cover === null ||
      (text(m.cover, 200) &&
        m.cover.startsWith(`/api/cover/${m.id}/`) &&
        /^[\w.-]+\.(jpg|png|webp|gif)$/i.test(
          m.cover.slice(`/api/cover/${m.id}/`.length),
        ))) &&
    ["Mangá", "Manhwa", "Manhua"].includes(m.kind || "") &&
    ["ongoing", "completed", "hiatus", "cancelled"].includes(m.status || "") &&
    (m.year === null ||
      (Number.isInteger(m.year) &&
        Number(m.year) >= 0 &&
        Number(m.year) <= 9999)) &&
    strings(m.tags, 64) &&
    strings(m.languages, 64) &&
    m.url === `https://mangadex.org/title/${m.id}` &&
    ["planned", "reading", "completed"].includes(item.status || "") &&
    text(item.chapter, 12) &&
    /^(?:\d+(?:\.\d+)?)?$/.test(item.chapter) &&
    typeof item.favorite === "boolean" &&
    Number.isFinite(item.updatedAt) &&
    Number(item.updatedAt) >= 0
  );
}

export function cleanItem(item: CollectionItem): CollectionItem {
  const {
    id,
    title,
    originalTitle,
    description,
    cover,
    kind,
    status,
    year,
    tags,
    languages,
  } = item.manga;
  return {
    manga: {
      id,
      title,
      originalTitle,
      description,
      cover,
      kind,
      status,
      year,
      tags: [...tags],
      languages: [...languages],
      url: `https://mangadex.org/title/${id}`,
    },
    status: item.status,
    chapter: item.chapter,
    favorite: item.favorite,
    updatedAt: item.updatedAt,
  };
}

export function readCollection(): Collection {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([id, value]) => {
          return validItem(value) && value.manga.id === id;
        })
        .map(([id, item]) => [id, cleanItem(item as CollectionItem)]),
    ) as Collection;
  } catch {
    return {};
  }
}

export function createBackup(collection: Collection): string {
  return JSON.stringify(
    {
      app: "ark-library",
      version: 1,
      exportedAt: new Date().toISOString(),
      items: Object.values(collection).map(cleanItem),
    },
    null,
    2,
  );
}

export function parseBackup(contents: string): Collection {
  if (new TextEncoder().encode(contents).byteLength > MAX_BACKUP_BYTES)
    throw new Error("O backup deve ter no máximo 10 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch {
    throw new Error("Esse arquivo não contém um backup JSON válido.");
  }
  if (!raw || typeof raw !== "object")
    throw new Error("Escolha um backup exportado pela ARK Library.");
  const data = raw as {
    app?: unknown;
    version?: unknown;
    exportedAt?: unknown;
    items?: unknown;
  };
  if (
    data.app !== "ark-library" ||
    data.version !== 1 ||
    !text(data.exportedAt, 60) ||
    !Number.isFinite(Date.parse(data.exportedAt)) ||
    !Array.isArray(data.items) ||
    data.items.length > 5000
  )
    throw new Error(
      "O formato ou a versão deste backup não é compatível com a ARK Library.",
    );
  const result: Collection = {};
  for (const item of data.items) {
    if (!validItem(item) || Object.hasOwn(result, item.manga.id))
      throw new Error(
        "O backup contém uma obra inválida ou duplicada. Sua coleção foi preservada.",
      );
    result[item.manga.id] = cleanItem(item);
  }
  return result;
}

export function mergeCollections(
  current: Collection,
  incoming: Collection,
): Collection {
  const merged = { ...current };
  for (const [id, item] of Object.entries(incoming)) {
    if (!merged[id] || item.updatedAt > merged[id].updatedAt) merged[id] = item;
  }
  return merged;
}

export function newItem(manga: Manga): CollectionItem {
  return {
    manga,
    status: "planned",
    chapter: "",
    favorite: false,
    updatedAt: Date.now(),
  };
}
