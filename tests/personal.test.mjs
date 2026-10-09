import test from 'node:test';
import assert from 'node:assert/strict';
import { createFullBackup, parseFullBackup, recordReading, mergePersonal, readPersonal, restoreFullBackup, PERSONAL_KEY } from '../src/personal.ts';
import { createBackup, STORAGE_KEY } from '../src/library.ts';
import { POSITION_KEY, READER_SETTINGS_KEY, LANGUAGE_KEY } from '../src/reading.ts';
const id = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
const listId = 'a1c7c817-4e59-43b7-9365-09675a149a6f';
const chapter = { id: '08bfe070-e9e6-4b61-a781-1ab708e9755a', number: '0', title: 'Prologue', language: 'pt-br', group: 'Group', url: 'https://mangadex.org/chapter/08bfe070-e9e6-4b61-a781-1ab708e9755a' };
const manga = { id, title: 'Solo Leveling', originalTitle: 'Solo', description: 'Story', cover: null, kind: 'Manhwa',
  status: 'completed', year: 2018, tags: ['Action'], languages: ['pt-br', 'en'], url: `https://mangadex.org/title/${id}` };
const item = { manga, status: 'reading', chapter: '0', favorite: true, updatedAt: 100 };
const collection = { [id]: item };
const personal = { lists: [{ id: listId, name: 'Treinar inglês', mangaIds: [id], updatedAt: 10 }], history: [] };
const position = { chapter, feedLanguage: 'pt-br', feedPage: 1, page: 5, offset: .5, completed: false };
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('history records actual opened chapters, deduplicates rereads and retains completion', () => {
  const opened = recordReading(personal, manga, chapter, false, 100);
  const done = recordReading(opened, manga, chapter, true, 200);
  const reread = recordReading(done, manga, chapter, false, 300);
  assert.equal(reread.history.length, 1); assert.equal(reread.history[0].completed, true); assert.equal(reread.history[0].readAt, 300);
  assert.equal(personal.history.length, 0);
});
test('complete backups preserve reader positions/preferences and still import old version-one collection files', () => {
  const storage = memory({ [POSITION_KEY + id]: JSON.stringify(position), [LANGUAGE_KEY]: 'en' });
  const saved = parseFullBackup(createFullBackup(collection, recordReading(personal, manga, chapter), storage, 'dark'));
  assert.deepEqual(saved.collection, collection); assert.equal(saved.workspace.positions[id].page, 5);
  assert.equal(saved.workspace.language, 'en'); assert.equal(saved.workspace.theme, 'dark'); assert.equal(saved.workspace.personal.history.length, 1);
  assert.deepEqual(parseFullBackup(createBackup(collection)), { collection });
});
test('invalid complete backup rejects the whole import without touching storage or trusting links', () => {
  const storage = memory(); const valid = JSON.parse(createFullBackup(collection, personal, storage));
  for (const mutate of [v => v.workspace.personal.lists[0].mangaIds.push('bad-id'), v => v.workspace.settings.width = 2,
    v => v.workspace.positions[id] = { ...position, page: -1 }, v => v.workspace.personal.history.push({ manga: { ...manga, url: 'https://attacker.test' }, chapter, readAt: 100, completed: false }),
    v => v.workspace.personal.history.push({ manga, chapter, readAt: 1e20, completed: false })]) {
    const data = structuredClone(valid); mutate(data); assert.throws(() => parseFullBackup(JSON.stringify(data)));
  }
  assert.equal(storage.values.size, 0); assert.deepEqual(readPersonal(memory({ [PERSONAL_KEY]: '{bad' })), { lists: [], history: [] });
});
test('list/history merge combines matching list names and preserves newer local reading positions', () => {
  const incoming = parseFullBackup(createFullBackup(collection, personal, memory({ [POSITION_KEY + id]: JSON.stringify(position) })));
  const current = { [id]: { ...item, updatedAt: 200 } };
  const storage = memory({ [POSITION_KEY + id]: JSON.stringify({ ...position, page: 9 }) });
  restoreFullBackup(current, { lists: [], history: [] }, incoming, storage);
  assert.equal(JSON.parse(storage.getItem(POSITION_KEY + id)).page, 9);
  const merged = mergePersonal(personal, { lists: [{ ...personal.lists[0], id: 'a1c7c817-4e59-43b7-9365-09675a149a6e', updatedAt: 20 }], history: [] });
  assert.equal(merged.lists.length, 1); assert.deepEqual(merged.lists[0].mangaIds, [id]);
});
test('failed restore rolls back staged preferences and leaves original collection intact', () => {
  const original = { [STORAGE_KEY]: JSON.stringify(collection), [PERSONAL_KEY]: JSON.stringify(personal), [LANGUAGE_KEY]: 'en' };
  const storage = memory(original);
  const incoming = parseFullBackup(createFullBackup(collection, personal, memory()));
  const setter = storage.setItem;
  let failed = false;
  storage.setItem = (key, value) => { if (key === READER_SETTINGS_KEY && !failed) { failed = true; throw Error('quota'); } setter(key, value); };
  assert.throws(() => restoreFullBackup(collection, personal, incoming, storage), /restaurar/);
  assert.deepEqual(Object.fromEntries(storage.values), original);
});

test('screen-sized reading and collapsed controls round-trip with legacy-compatible settings', () => {
  const storage = memory({ [READER_SETTINGS_KEY]: JSON.stringify({ mode: 'vertical', quality: 'original', size: 'screen', width: 900, controlsHidden: true }) });
  const backup = createFullBackup(collection, personal, storage);
  assert.equal(JSON.parse(backup).workspace.settings.size, 'fit');
  const saved = parseFullBackup(backup);
  assert.equal(saved.workspace.settings.size, 'screen');
  assert.equal(saved.workspace.settings.controlsHidden, true);
  const invalid = JSON.parse(backup); invalid.workspace.settings.controlsHidden = 'yes';
  assert.throws(() => parseFullBackup(JSON.stringify(invalid)), /leitor/);
});

test('per-work reader settings survive backups and newer local settings win during restore', async () => {
  const { WORK_SETTINGS_KEY } = await import('../src/reading.ts');
  const settings = { mode: 'paged', quality: 'original', size: 'screen', width: 980, controlsHidden: true };
  const incoming = parseFullBackup(createFullBackup(collection, personal, memory({ [WORK_SETTINGS_KEY]: JSON.stringify({ [id]: { settings, updatedAt: 100 } }) })));
  assert.deepEqual(incoming.workspace.workSettings[id].settings, settings);
  const local = { [id]: { settings: { ...settings, mode: 'vertical' }, updatedAt: 200 } };
  const storage = memory({ [WORK_SETTINGS_KEY]: JSON.stringify(local) });
  restoreFullBackup(collection, personal, incoming, storage);
  assert.deepEqual(JSON.parse(storage.getItem(WORK_SETTINGS_KEY)), local);
  const invalid = JSON.parse(createFullBackup(collection, personal, memory())); invalid.workspace.workSettings[id] = { settings: { ...settings, width: 0 }, updatedAt: 100 };
  assert.throws(() => parseFullBackup(JSON.stringify(invalid)), /Ajustes/);
});

test('backup restore rolls back per-work settings if saving the collection fails', async () => {
  const { WORK_SETTINGS_KEY } = await import('../src/reading.ts');
  const settings = { mode: 'vertical', quality: 'original', size: 'screen', width: 980 };
  const original = { [STORAGE_KEY]: JSON.stringify(collection), [WORK_SETTINGS_KEY]: JSON.stringify({ [id]: { settings: { ...settings, size: 'fit' }, updatedAt: 50 } }), [LANGUAGE_KEY]: 'en' };
  const storage = memory(original);
  const incoming = parseFullBackup(createFullBackup(collection, personal, memory({ [WORK_SETTINGS_KEY]: JSON.stringify({ [id]: { settings, updatedAt: 100 } }) })));
  const setter = storage.setItem; let failed = false;
  storage.setItem = (key, value) => { if (key === STORAGE_KEY && !failed) { failed = true; throw Error('quota'); } setter(key, value); };
  assert.throws(() => restoreFullBackup(collection, personal, incoming, storage), /restaurar/);
  assert.deepEqual(Object.fromEntries(storage.values), original);
});
