import test from 'node:test';
import assert from 'node:assert/strict';
import { groupChapters, chapterSlice } from '../server/chapters.mjs';
import { chapterIndex, readPosition, readReaderPreferences, preferredLanguage } from '../src/reading.ts';
import { hasUnreadChapter, readDismissed } from '../src/updates.ts';
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
