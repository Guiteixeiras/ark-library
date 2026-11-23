import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chapterAvailability, groupChapters, chapterSlice } from '../server/chapters.mjs';
import { allPagesSeen, chapterIndex, pagesBefore, readPosition, readReaderPreferences, preferredLanguage } from '../src/reading.ts';
import { hasUnreadChapter, readDismissed } from '../src/dismissed.ts';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function raw(n, number, overrides = {}) { return { id: id(n), attributes: { chapter: number, volume: '1', title: '', translatedLanguage: 'pt-br', pages: 10, updatedAt: '2026-01-01', ...overrides }, relationships: [{ type: 'scanlation_group', attributes: { name: `Group ${n}` } }] }; }
const storage = value => ({ getItem() { return JSON.stringify(value); } });
test('translations collapse across feed pages with numeric ordering and Portuguese preference', () => {
  const chapters = groupChapters([raw(1, '01', { translatedLanguage: 'pt', updatedAt: '2026-09-01' }), raw(2, '1'), raw(3, '1', { volume: null, updatedAt: '2026-08-01' }), raw(4, '1.5'), raw(5, '10'), raw(6, '2'), raw(7, null), raw(8, null), raw(9, '3', { externalUrl: 'https://publisher.test' }), raw(10, '4', { isUnavailable: true })]);
  assert.deepEqual(chapters.map(c => c.number), ['1', '1.5', '2', '10', null, null]);
  assert.equal(chapters[0].id, id(3)); assert.equal(chapters[0].group, 'Group 3');
  assert.equal(chapters[0].alternatives.length, 2);
  assert.equal(chapterIndex(chapters, { ...chapters[0], id: id(1) }), 0);
});
test('resume locates a chapter after consolidation and progress without a saved position opens the next', () => {
  const chapters = groupChapters(Array.from({ length: 90 }, (_, n) => raw(n + 1, String(n))));
  chapters[60].alternatives.push({ ...chapters[60], id: id(999) });
  const located = chapterSlice(chapters, { page: 1, chapterId: id(999), chapterNumber: null, after: null });
  assert.equal(located.page, 2); assert.equal(located.startId, chapters[60].id); assert.equal(located.items.length, 40);
  const next = chapterSlice(chapters, { page: 1, chapterId: null, chapterNumber: null, after: '60' });
  assert.equal(next.startId, chapters[61].id);
  const last = chapterSlice(chapters, { page: 1, chapterId: null, chapterNumber: null, after: '100' });
  assert.equal(last.startId, chapters.at(-1).id);
});
test('source names stay distinct on case-insensitive systems such as Windows', () => {
  const names = readdirSync(new URL('../src/', import.meta.url)).map(name => name.replace(/\.[^.]+$/, '').toLowerCase());
  assert.deepEqual(names.filter((name, i) => names.indexOf(name) !== i), []);
});
test('page-by-page reading completes after resuming, but not after jumping over pages', () => {
  const resumed = pagesBefore(26);
  for (const page of [26, 27]) resumed.add(page);
  assert(!allPagesSeen(resumed, 29));
  resumed.add(28); assert(allPagesSeen(resumed, 29));
  const jumped = pagesBefore(0); jumped.add(0); jumped.add(28);
  assert(!allPagesSeen(jumped, 29)); assert(!allPagesSeen(new Set(), 0));
});
test('English fills only the missing Portuguese chapters and the choice survives resuming', () => {
  const chapters = groupChapters([raw(1, '1', { translatedLanguage: 'en', updatedAt: '2026-11-01' }), raw(2, '1', { translatedLanguage: 'pt' }), raw(3, '2', { translatedLanguage: 'en' })]);
  assert.deepEqual(chapters.map(c => [c.number, c.language]), [['1', 'pt'], ['2', 'en']]);
  const saved = readPosition(id(2), storage({ chapter: { ...chapters[1], title: '' }, feedLanguage: 'pt-en', feedPage: 1, page: 0, offset: 0 }));
  assert.equal(saved.feedLanguage, 'pt-en');
});
test('availability separates readable, removed and linked chapters and rejects unsafe links', () => {
  const items = [raw(1, '1'), raw(2, '1', { isUnavailable: true }), raw(3, '2', { isUnavailable: true }), raw(4, '3', { pages: 0, externalUrl: 'https://br.comikey.com/read/3/' }),
    raw(5, '3', { pages: 0, externalUrl: 'https://br.comikey.com/read/3-again/' }), raw(6, '4', { pages: 0, externalUrl: 'javascript:alert(1)' }), raw(7, '5', { pages: 0, isUnavailable: true, externalUrl: 'https://gone.test/5' }),
    raw(8, '2', { translatedLanguage: 'en' }), raw(9, '1', { translatedLanguage: 'en' })];
  const pt = chapterAvailability(items, 'pt-br');
  assert.deepEqual({ ...pt, external: pt.external.map(c => [c.number, c.host]) }, { known: 5, readable: 1, unavailable: 3, english: 1, external: [['3', 'br.comikey.com']] });
  const both = chapterAvailability(items, 'pt-en');
  assert.equal(both.readable, 2); assert.equal(both.english, 0);
  assert.equal(chapterAvailability(items, 'en').known, 2);
});
test('legacy reader position is preserved and corrupted or unsupported records are ignored', () => {
  const value = { chapter: { id: id(1), title: 'Title', number: '12.5', language: 'en', group: 'Group', url: 'https://untrusted.test' }, page: 3, offset: .4, feedPage: 2, feedLanguage: 'en' };
  const saved = readPosition(id(2), storage(value));
  assert.equal(saved.chapter.url, `https://mangadex.org/chapter/${id(1)}`);
  assert.equal(saved.page, 3); assert.equal(saved.feedLanguage, 'en');
  for (const bad of [{ ...value, offset: 2 }, { ...value, page: -1 }, { ...value, chapter: { ...value.chapter, group: {} } }, { ...value, chapter: { ...value.chapter, language: 'es' } }])
    assert.equal(readPosition(id(2), storage(bad)), null);
});
test('original quality is the default and existing width settings survive the update', () => {
  assert.deepEqual(readReaderPreferences({ getItem: key => key.endsWith('width:v1') ? '900' : null }), { quality: 'original', mode: 'vertical', width: 900, size: 'fit' });
  const corrupt = readReaderPreferences(storage({ width: -1, mode: 'x', quality: 'x', size: 'x' }));
  assert.equal(corrupt.width, 780); assert.equal(corrupt.quality, 'original');
  assert.equal(preferredLanguage({ getItem: () => 'en' }), 'en');
  assert.equal(preferredLanguage({ getItem: () => 'es' }), 'pt-br');
});
test('announcements compare chapter numbers so alternate scans cannot repeat a dismissed notice', () => {
  assert(hasUnreadChapter('0', ''));
  assert(hasUnreadChapter('12.5', '12'));
  assert(!hasUnreadChapter('12', '12.5'));
  assert(!hasUnreadChapter('12.5', '12', 12.5));
  assert(hasUnreadChapter('13', '12', 12.5));
  assert(!hasUnreadChapter(null, '12'));
  assert.deepEqual(readDismissed(storage({ [`${id(1)}:pt-br`]: 12.5, wrong: 8, [`${id(2)}:en`]: '12' })), { [`${id(1)}:pt-br`]: 12.5 });
});

test('each work keeps independent reader preferences and legacy defaults remain available', async () => {
  const { saveWorkSettings, WORK_SETTINGS_KEY, READER_SETTINGS_KEY } = await import('../src/reading.ts');
  const values = new Map([[READER_SETTINGS_KEY, JSON.stringify({ mode: 'vertical', quality: 'original', size: 'fit', width: 900 })]]);
  const memory = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const a = { mode: 'vertical', quality: 'original', size: 'screen', width: 1000, controlsHidden: true };
  const b = { mode: 'paged', quality: 'compressed', size: 'native', width: 600, controlsHidden: false };
  saveWorkSettings(id(1), a, memory); saveWorkSettings(id(2), b, memory);
  assert.deepEqual(readReaderPreferences(memory, id(1)), a); assert.deepEqual(readReaderPreferences(memory, id(2)), b);
  assert.equal(readReaderPreferences(memory, id(3)).width, 900);
  const raw = JSON.parse(values.get(WORK_SETTINGS_KEY)); raw[id(2)].settings.width = -1;
  values.set(WORK_SETTINGS_KEY, JSON.stringify(raw));
  assert.deepEqual(readReaderPreferences(memory, id(1)), a); assert.equal(readReaderPreferences(memory, id(2)).width, 900);
});
