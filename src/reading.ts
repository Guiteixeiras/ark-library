import type { Chapter } from "./types";
export type ReadingLanguage = "pt-br" | "en";
export type ReaderMode = "vertical" | "paged";
export type ImageQuality = "original" | "compressed";
export type ReaderPreferences = { mode: ReaderMode; quality: ImageQuality; size: "fit" | "screen" | "native"; width: number; controlsHidden?: boolean };
export type Position = { chapter: Chapter; feedLanguage: ReadingLanguage; feedPage: number; page: number; offset: number; completed?: boolean };
export const POSITION_KEY = "ark-library:reader:v1:";
export const READER_SETTINGS_KEY = "ark-library:reader-settings:v1";
export const WORK_SETTINGS_KEY = "ark-library:reader-work-settings:v1";
export type WorkReaderSettings = Record<string, { settings: ReaderPreferences; updatedAt: number }>;
export const LANGUAGE_KEY = "ark-library:language:v1";
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export function languageLabel(language: string) { return language === "en" ? "Inglês" : "Português"; }
export function preferredLanguage(storage: Pick<Storage, "getItem"> = localStorage): ReadingLanguage {
  try { return storage.getItem(LANGUAGE_KEY) === "en" ? "en" : "pt-br"; } catch { return "pt-br"; }
}
export function canonicalChapter(value: unknown): Chapter | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Chapter;
  if (!UUID.test(c.id) || !["pt-br", "pt", "en"].includes(c.language) ||
      (c.number !== null && (typeof c.number !== "string" || c.number.length > 12)) ||
      typeof c.title !== "string" || c.title.length > 500 || typeof c.group !== "string" || c.group.length > 500) return null;
  return { id: c.id, number: c.number, title: c.title, group: c.group, language: c.language,
    volume: typeof c.volume === "string" ? c.volume : null, url: `https://mangadex.org/chapter/${c.id}` };
}
export function readPosition(mangaId: string, storage: Pick<Storage, "getItem"> = localStorage): Position | null {
  try {
    const value = JSON.parse(storage.getItem(POSITION_KEY + mangaId) || "null");
    const chapter = canonicalChapter(value?.chapter);
    if (!chapter || !Number.isInteger(value.page) || value.page < 0 || value.page >= 1000 ||
        !Number.isInteger(value.feedPage) || value.feedPage < 1 || value.feedPage > 250 ||
        !Number.isFinite(value.offset) || value.offset < 0 || value.offset > 1) return null;
    return { chapter, feedLanguage: value.feedLanguage === "en" || value.feedLanguage !== "pt-br" && chapter.language === "en" ? "en" : "pt-br",
      feedPage: value.feedPage, page: value.page, offset: value.offset, completed: value.completed === true };
  } catch { return null; }
}
export function validReaderPreferences(value: unknown): value is ReaderPreferences {
  const p = value as ReaderPreferences;
  return !!p && ['vertical', 'paged'].includes(p.mode) && ['original', 'compressed'].includes(p.quality) && ['fit', 'screen', 'native'].includes(p.size) &&
    typeof p.width === 'number' && Number.isFinite(p.width) && p.width >= 420 && p.width <= 1100 && (p.controlsHidden === undefined || typeof p.controlsHidden === 'boolean');
}
export function validateWorkSettings(value: unknown): WorkReaderSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 5000) throw new Error('Ajustes por obra inválidos.');
  const entries = Object.entries(value).map(([id, raw]) => {
    const entry = raw as WorkReaderSettings[string];
    if (!UUID.test(id) || !entry || !validReaderPreferences(entry.settings) || typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt) || entry.updatedAt < 0 || entry.updatedAt > 8640000000000000)
      throw new Error('Ajustes por obra inválidos.');
    const p = entry.settings;
    return [id, { settings: { mode: p.mode, quality: p.quality, size: p.size, width: p.width, ...(p.controlsHidden !== undefined ? { controlsHidden: p.controlsHidden } : {}) }, updatedAt: entry.updatedAt }];
  });
  return Object.fromEntries(entries);
}
export function readWorkSettings(storage: Pick<Storage, 'getItem'> = localStorage): WorkReaderSettings {
  try {
    const raw = JSON.parse(storage.getItem(WORK_SETTINGS_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 5000) return {};
    return Object.assign({}, ...Object.entries(raw).map(([id, entry]) => {
      try { return validateWorkSettings({ [id]: entry }); } catch { return {}; }
    }));
  } catch { return {}; }
}
export function saveWorkSettings(id: string, settings: ReaderPreferences, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  if (!UUID.test(id) || !validReaderPreferences(settings)) throw new Error('Ajustes por obra inválidos.');
  const current = readWorkSettings(storage);
  current[id] = { settings, updatedAt: Date.now() };
  const entries = Object.entries(current).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 5000);
  storage.setItem(WORK_SETTINGS_KEY, JSON.stringify(Object.fromEntries(entries)));
}
export function readReaderPreferences(storage: Pick<Storage, "getItem"> = localStorage, mangaId?: string): ReaderPreferences {
  if (mangaId) {
    const saved = readWorkSettings(storage)[mangaId];
    if (saved) return saved.settings;
  }
  let value: Partial<ReaderPreferences> = {};
  let oldWidth = 780;
  try { value = JSON.parse(storage.getItem(READER_SETTINGS_KEY) || "{}") || {}; oldWidth = Number(storage.getItem("ark-library:reader-width:v1")) || 780; } catch { /* use defaults */ }
  const width = Number(value.width ?? oldWidth);
  return { mode: value.mode === "paged" ? "paged" : "vertical", quality: value.quality === "compressed" ? "compressed" : "original",
    size: value.size === "native" ? "native" : value.size === "screen" ? "screen" : "fit", width: width >= 420 && width <= 1100 ? width : 780,
    ...(value.controlsHidden === true ? { controlsHidden: true } : {}) };
}
export function chapterIndex(chapters: Chapter[], current: Chapter | null) {
  if (!current) return -1;
  return chapters.findIndex(c => c.id === current.id || c.alternatives?.some(a => a.id === current.id) ||
    (c.number !== null && current.number !== null && /^\d+(?:\.\d+)?$/.test(c.number) && Number(c.number) === Number(current.number)));
}
