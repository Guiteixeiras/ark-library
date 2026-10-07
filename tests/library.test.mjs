import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackup,
  mergeCollections,
  parseBackup,
  readCollection,
} from "../src/library.ts";

const id = "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0";
function entry(overrides = {}) {
  return {
    manga: {
      id,
      title: "Solo Leveling",
      originalTitle: "Na Honjaman Level-Up",
      description: "Uma história.",
      cover: `/api/cover/${id}/cover.jpg`,
      kind: "Manhwa",
      status: "ongoing",
      year: 2018,
      tags: ["Action", "Fantasy"],
      languages: ["pt-br", "en"],
      url: `https://mangadex.org/title/${id}`,
    },
    status: "reading",
    chapter: "12.5",
    favorite: true,
    updatedAt: 100,
    ...overrides,
  };
}
function archive() {
  return JSON.parse(createBackup({ [id]: entry() }));
}

test("backup round-trip preserves reading progress, favorites and manga metadata", () => {
  const collection = { [id]: entry() };
  assert.deepEqual(parseBackup(createBackup(collection)), collection);
});
test("invalid JSON, foreign files and future schema versions are rejected", () => {
  assert.throws(() => parseBackup("{broken"), /JSON válido/);
  assert.throws(() => parseBackup("{}"), /compatível/);
  const data = archive();
  data.version = 2;
  assert.throws(() => parseBackup(JSON.stringify(data)), /versão/);
});
test("import rejects links and cover paths outside the supported MangaDex routes", () => {
  for (const [field, value] of [
    ["url", "javascript:alert(1)"],
    ["url", "https://example.com/phishing"],
    ["cover", "https://example.com/image.jpg"],
    ["cover", `/api/cover/${id}/../image.jpg`],
  ]) {
    const data = archive();
    data.items[0].manga[field] = value;
    assert.throws(() => parseBackup(JSON.stringify(data)), /inválida/);
  }
});
test("duplicate identities are rejected instead of silently overwriting progress", () => {
  const data = archive();
  data.items.push(entry({ chapter: "99" }));
  assert.throws(() => parseBackup(JSON.stringify(data)), /duplicada/);
});
test("one invalid entry rejects the entire import and does not mutate the existing collection", () => {
  const current = { [id]: entry() };
  const before = structuredClone(current);
  const data = archive();
  data.items.push({ ...entry(), status: "unexpected" });
  assert.throws(() => parseBackup(JSON.stringify(data)));
  assert.deepEqual(current, before);
});
test("restore keeps local entries and newer local progress", () => {
  const current = { [id]: entry({ updatedAt: 300, chapter: "30" }) };
  const incoming = { [id]: entry({ updatedAt: 200, chapter: "20" }) };
  assert.deepEqual(mergeCollections(current, incoming), current);
  assert.deepEqual(mergeCollections(current, {}), current);
});
test("restore accepts newer progress and new manga without removing existing entries", () => {
  const other = "a1c7c817-4e59-43b7-9365-09675a149a6f";
  const current = { [id]: entry() };
  const incoming = {
    [id]: entry({ updatedAt: 200, chapter: "20" }),
    [other]: entry({
      manga: {
        ...entry().manga,
        id: other,
        url: `https://mangadex.org/title/${other}`,
        cover: null,
      },
    }),
  };
  const merged = mergeCollections(current, incoming);
  assert.equal(merged[id].chapter, "20");
  assert.equal(Object.keys(merged).length, 2);
  assert.equal(current[id].chapter, "12.5");
});
test("equal timestamps preserve the local entry", () => {
  const current = { [id]: entry() };
  assert.equal(
    mergeCollections(current, { [id]: entry({ chapter: "999" }) })[id].chapter,
    "12.5",
  );
});
test("stored valid collection survives validation; corrupted data cannot crash startup", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  let stored = JSON.stringify({ [id]: entry() });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => stored },
  });
  try {
    assert.deepEqual(readCollection(), { [id]: entry() });
    stored = "{broken";
    assert.deepEqual(readCollection(), {});
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
