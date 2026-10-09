import { cleanItem, createBackup, MAX_BACKUP_BYTES, mergeCollections, newItem, parseBackup, STORAGE_KEY, validItem } from './library.ts';
import { canonicalChapter, LANGUAGE_KEY, POSITION_KEY, readPosition, readReaderPreferences, READER_SETTINGS_KEY, readWorkSettings, validateWorkSettings, WORK_SETTINGS_KEY } from './reading.ts';
import { readDismissed, UPDATES_KEY } from './updates.ts';
import type { Position, ReaderPreferences, ReadingLanguage, WorkReaderSettings } from './reading.ts';
import type { Chapter, Collection, Manga } from './types';

export const PERSONAL_KEY = 'ark-library:personal:v1';
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export type ReadingList = { id: string; name: string; mangaIds: string[]; updatedAt: number };
export type HistoryEntry = { manga: Manga; chapter: Chapter; readAt: number; completed: boolean };
export type Personal = { lists: ReadingList[]; history: HistoryEntry[] };
export type WorkspaceBackup = { version: 1; personal: Personal; positions: Record<string, Position>; settings: ReaderPreferences; workSettings?: WorkReaderSettings;
  language: ReadingLanguage; theme: 'light' | 'dark'; dismissed: Record<string, number> };
export type FullBackup = { collection: Collection; workspace?: WorkspaceBackup };
const empty = (): Personal => ({ lists: [], history: [] });
function finite(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= 0; }
export function validatePersonal(raw: unknown): Personal {
  const value = raw as Personal;
  if (!value || !Array.isArray(value.lists) || value.lists.length > 100 || !Array.isArray(value.history) || value.history.length > 500)
    throw new Error('Listas ou histórico inválidos no backup.');
  const ids = new Set<string>();
  const names = new Set<string>();
  const lists = value.lists.map(list => {
    if (!list || !UUID.test(list.id) || ids.has(list.id) || typeof list.name !== 'string' || !list.name.trim() || list.name.length > 60 ||
        names.has(list.name.trim().toLocaleLowerCase()) || !finite(list.updatedAt) || !Array.isArray(list.mangaIds) ||
        list.mangaIds.length > 5000 || list.mangaIds.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(list.mangaIds).size !== list.mangaIds.length)
      throw new Error('Uma lista do backup é inválida ou duplicada.');
    ids.add(list.id); names.add(list.name.trim().toLocaleLowerCase());
    return { id: list.id, name: list.name.trim(), mangaIds: [...list.mangaIds], updatedAt: list.updatedAt };
  });
  const keys = new Set<string>();
  const history = value.history.map(entry => {
    if (!entry || !validItem({ manga: entry.manga, status: 'reading', chapter: '', favorite: false, updatedAt: entry.readAt }) ||
        !finite(entry.readAt) || entry.readAt > 8640000000000000 || typeof entry.completed !== 'boolean') throw new Error('O histórico do backup é inválido.');
    const chapter = canonicalChapter(entry.chapter);
    const key = `${entry.manga.id}:${chapter?.id}`;
    if (!chapter || keys.has(key)) throw new Error('O histórico contém um capítulo inválido ou duplicado.');
    keys.add(key);
    return { manga: cleanItem(newItem(entry.manga)).manga, chapter, readAt: entry.readAt, completed: entry.completed };
  });
  return { lists, history: history.sort((a, b) => b.readAt - a.readAt) };
}
export function readPersonal(storage: Pick<Storage, 'getItem'> = localStorage): Personal {
  try { return validatePersonal(JSON.parse(storage.getItem(PERSONAL_KEY) || JSON.stringify(empty()))); } catch { return empty(); }
}
export function recordReading(current: Personal, manga: Manga, chapter: Chapter, completed = false, now = Date.now()): Personal {
  const clean = canonicalChapter(chapter);
  if (!clean) return current;
  const old = current.history.find(h => h.manga.id === manga.id && h.chapter.id === chapter.id);
  return { ...current, history: [{ manga: cleanItem(newItem(manga)).manga, chapter: clean, readAt: now, completed: completed || !!old?.completed },
    ...current.history.filter(h => h.manga.id !== manga.id || h.chapter.id !== chapter.id)].slice(0, 500) };
}
export function mergePersonal(current: Personal, incoming: Personal): Personal {
  const lists = new Map(current.lists.map(l => [l.id, l]));
  for (const list of incoming.lists) if (!lists.has(list.id) || lists.get(list.id)!.updatedAt < list.updatedAt) {
    const duplicate = [...lists.values()].find(l => l.id !== list.id && l.name.toLocaleLowerCase() === list.name.toLocaleLowerCase());
    if (duplicate) lists.set(duplicate.id, { ...duplicate, mangaIds: [...new Set([...duplicate.mangaIds, ...list.mangaIds])], updatedAt: Math.max(duplicate.updatedAt, list.updatedAt) });
    else lists.set(list.id, list);
  }
  const history = new Map(current.history.map(h => [`${h.manga.id}:${h.chapter.id}`, h]));
  for (const h of incoming.history) {
    const key = `${h.manga.id}:${h.chapter.id}`, old = history.get(key);
    if (!old || old.readAt < h.readAt) history.set(key, { ...h, completed: h.completed || !!old?.completed });
    else if (h.completed) history.set(key, { ...old, completed: true });
  }
  if (lists.size > 100) throw new Error('A combinação excederia o limite de 100 listas.');
  return { lists: [...lists.values()], history: [...history.values()].sort((a, b) => b.readAt - a.readAt).slice(0, 500) };
}
export function createFullBackup(collection: Collection, personal: Personal, storage: Pick<Storage, 'getItem'> = localStorage, theme?: 'light' | 'dark') {
  const positions = Object.fromEntries(Object.keys(collection).flatMap(id => { const position = readPosition(id, storage); return position ? [[id, position]] : []; }));
  const workSettings = Object.fromEntries(Object.entries(readWorkSettings(storage)).filter(([id]) => !!collection[id]));
  const workspace: WorkspaceBackup = { version: 1, personal, positions, settings: readReaderPreferences(storage), workSettings,
    language: storage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'pt-br', theme: theme || (storage.getItem('ark-library:theme:v1') === 'dark' ? 'dark' : 'light'), dismissed: readDismissed(storage) };
  const result = JSON.stringify({ ...JSON.parse(createBackup(collection)), workspace: { ...workspace,
    ...(workspace.settings.size === 'screen' ? { settings: { ...workspace.settings, size: 'fit' }, screenFit: true } : {}) } }, null, 2);
  if (new TextEncoder().encode(result).byteLength > MAX_BACKUP_BYTES) throw new Error('Este backup excede 10 MB. Reduza o histórico antes de exportar.');
  return result;
}
export function parseFullBackup(contents: string): FullBackup {
  const collection = parseBackup(contents);
  const { workspace } = JSON.parse(contents);
  if (workspace === undefined) return { collection };
  if (!workspace || workspace.version !== 1 || !workspace.positions || typeof workspace.positions !== 'object' || Array.isArray(workspace.positions) ||
      !['pt-br', 'en'].includes(workspace.language) || !['light', 'dark'].includes(workspace.theme)) throw new Error('Preferências do backup inválidas.');
  const positions: Record<string, Position> = {};
  for (const [id, raw] of Object.entries(workspace.positions)) {
    const p = readPosition(id, { getItem: () => JSON.stringify(raw) });
    if (!UUID.test(id) || !collection[id] || !p) throw new Error('Posição de leitura inválida no backup.');
    positions[id] = p;
  }
  const s = workspace.settings;
  if (!s || !['vertical', 'paged'].includes(s.mode) || !['original', 'compressed'].includes(s.quality) || !['fit', 'native'].includes(s.size) ||
      !finite(s.width) || s.width < 420 || s.width > 1100 || (s.controlsHidden !== undefined && typeof s.controlsHidden !== 'boolean') ||
      (workspace.screenFit !== undefined && typeof workspace.screenFit !== 'boolean')) throw new Error('Preferências do leitor inválidas.');
  const dismissed = readDismissed({ getItem: () => JSON.stringify(workspace.dismissed) });
  const workSettings = workspace.workSettings === undefined ? undefined : validateWorkSettings(workspace.workSettings);
  if (workSettings && Object.keys(workSettings).some(id => !collection[id])) throw new Error('Ajustes de uma obra ausente no backup.');
  if (!workspace.dismissed || typeof workspace.dismissed !== 'object' || Array.isArray(workspace.dismissed) ||
      Object.keys(dismissed).length !== Object.keys(workspace.dismissed).length) throw new Error('Avisos do backup inválidos.');
  return { collection, workspace: { version: 1, personal: validatePersonal(workspace.personal), positions, settings: { ...s, ...(workspace.screenFit ? { size: 'screen' } : {}) },
    language: workspace.language, theme: workspace.theme, dismissed, ...(workSettings ? { workSettings } : {}) } };
}
// Stage every write and restore originals on failure; collection is committed last.
export function restoreFullBackup(current: Collection, personal: Personal, incoming: FullBackup, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
  const collection = mergeCollections(current, incoming.collection);
  const w = incoming.workspace;
  const nextPersonal = w ? mergePersonal(personal, w.personal) : personal;
  const writes: [string, string][] = [];
  if (w) {
    writes.push([PERSONAL_KEY, JSON.stringify(nextPersonal)], [READER_SETTINGS_KEY, JSON.stringify(w.settings)],
      [LANGUAGE_KEY, w.language], ['ark-library:theme:v1', w.theme]);
    if (w.workSettings) {
      const workSettings = readWorkSettings(storage);
      for (const [id, entry] of Object.entries(w.workSettings)) if (!workSettings[id] || entry.updatedAt > workSettings[id].updatedAt) workSettings[id] = entry;
      writes.push([WORK_SETTINGS_KEY, JSON.stringify(Object.fromEntries(Object.entries(workSettings).filter(([id]) => !!collection[id]).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 5000)))]);
    }
    const dismissed = readDismissed(storage);
    for (const [key, n] of Object.entries(w.dismissed)) dismissed[key] = Math.max(dismissed[key] ?? -1, n);
    writes.push([UPDATES_KEY, JSON.stringify(dismissed)]);
    for (const [id, position] of Object.entries(w.positions)) {
      if (!readPosition(id, storage) || !current[id] || incoming.collection[id].updatedAt > current[id].updatedAt)
        writes.push([POSITION_KEY + id, JSON.stringify(position)]);
    }
  }
  writes.push([STORAGE_KEY, JSON.stringify(collection)]);
  const old = writes.map(([key]) => [key, storage.getItem(key)] as const);
  try { for (const [key, value] of writes) storage.setItem(key, value); }
  catch {
    for (const [key, value] of old.reverse()) { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Surface failure and preserve collection state in memory. */ } }
    throw new Error('O navegador não conseguiu restaurar o backup. Libere espaço e tente novamente.');
  }
  return { collection, personal: nextPersonal, workspace: w };
}
