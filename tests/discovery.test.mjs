import test from 'node:test';
import assert from 'node:assert/strict';
import { withPopularity, featuredSlice, readableFeatured, recentReleases, releaseFeed } from '../server/discovery.mjs';
import { createReadability } from '../server/readable.mjs';
const id = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
const now = Date.parse('2026-10-07T12:00:00Z');
const manga = { id, title: 'Solo Leveling', originalTitle: 'Solo', kind: 'Manhwa', tags: ['Action'], status: 'completed' };
function chapter(number, overrides = {}, idSuffix = '1') {
  return { id: `08bfe070-e9e6-4b61-a781-1ab708e9755${idSuffix}`, attributes: { chapter: number, pages: 18,
    translatedLanguage: 'pt-br', readableAt: '2026-10-06T12:00:00Z', updatedAt: '2026-10-06T12:00:00Z', ...overrides },
    relationships: [{ type: 'manga', id }, { type: 'scanlation_group', attributes: { name: 'Group' } }] };
}
test('featured selection excludes unrated, obscure and poorly rated titles, without inventing ratings', () => {
  const items = Array.from({ length: 4 }, (_, n) => ({ ...manga, id: String(n) }));
  assert.deepEqual(withPopularity(items, {
    0: { follows: 10000, rating: { bayesian: 8.2 } }, 1: { follows: 20, rating: { bayesian: 9.5 } },
    2: { follows: 20000, rating: { bayesian: 6 } }, 3: { follows: 10000 },
  }), [{ ...items[0], rating: 8.2, followers: 10000 }]);
});
test('featured filtering and rating ordering happen before pagination, preserving the known pool', () => {
  const items = Array.from({ length: 30 }, (_, n) => ({ ...manga, id: String(n), rating: 7 + n / 100, followers: 1000 + n }));
  const options = { kind: 'manhwa', status: 'completed', genreName: 'Action', sort: 'rating', page: 2 };
  const result = featuredSlice(items, options);
  assert.equal(result.total, 30); assert.equal(result.items.length, 6); assert.equal(result.items[0].id, '5');
  assert.equal(featuredSlice(items, { ...options, kind: 'manga' }).total, 0);
});
test('release shelf uses readable date, removes unavailable/old/future/external chapters and combines scans', () => {
  const result = recentReleases([
    chapter('10', { translatedLanguage: 'pt' }, '2'), chapter('010', { publishAt: '2037-12-31T00:00:00Z' }),
    chapter('9', { readableAt: '2026-09-01T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' }, '3'),
    chapter('11', { pages: 0 }, '4'), chapter('12', { externalUrl: 'https://example.com' }, '5'),
    chapter('13', { readableAt: '2026-10-08T00:00:00Z' }, '6'), chapter('14', { isUnavailable: true }, '7'),
    { ...chapter('15', {}, '8'), relationships: [{ type: 'manga', id: 'not-featured' }] },
  ], [manga], now);
  assert.equal(result.length, 1); assert.equal(result[0].chapter.language, 'pt-br');
  assert.equal(result[0].chapter.alternatives.length, 1); assert.equal(result[0].publishedAt, '2026-10-06T12:00:00Z');
});
test('recent uploads stop before old pages and never query unsupported unlimited offsets', async () => {
  const paths = [];
  const recent = new Date().toISOString(), old = new Date(Date.now() - 9 * 86400000).toISOString();
  const result = await releaseFeed(async path => {
    paths.push(path); const p = new URL('https://api.mangadex.org' + path).searchParams;
    assert.equal(p.get('order[readableAt]'), 'desc'); assert.deepEqual(p.getAll('translatedLanguage[]'), ['pt-br', 'pt']);
    const page = Number(p.get('offset'));
    return { total: 10000, data: Array.from({ length: 100 }, (_, n) => chapter(String(page + n), { readableAt: page === 0 ? recent : old })) };
  }, [manga], 'pt-br');
  assert.equal(paths.length, 2); assert.equal(result.truncated, false); assert.equal(result.items.length, 40);
});

const upstreamFor = (ids, suspects) => async path => {
  if (path.startsWith('/statistics')) return { statistics: Object.fromEntries(ids.map(i => [i, { follows: 5000, rating: { bayesian: 8 } }])) };
  const flagged = new URL('https://api.test' + path).searchParams.get('hasUnavailableChapters') === '1';
  return { data: (flagged ? suspects : ids).map(i => ({ id: i })) };
};
test('featured works without hosted chapters are hidden, suspects are verified first and unknown works stay', async () => {
  const order = [];
  const readability = createReadability(async i => { order.push(i); return i === 'b' ? 0 : 5; }, { spacing: 0 });
  const items = await readableFeatured(upstreamFor(['a', 'b', 'c'], ['b', 'c']), m => m, 'pt-br', readability);
  assert.deepEqual(items.map(m => m.id), ['a', 'c']);
  assert.deepEqual(order.slice(0, 2), ['b', 'c']);
  assert.equal(readability.get('b', 'en'), undefined, 'languages are independent');
  const slow = createReadability(() => new Promise(resolve => setTimeout(resolve, 60, 0)), { spacing: 0 });
  assert.deepEqual((await readableFeatured(upstreamFor(['a', 'b'], ['b']), m => m, 'en', slow, 5)).map(m => m.id), ['a', 'b']);
  await slow.check(['b', 'a'], 'en', 1000);
  assert.equal((await readableFeatured(upstreamFor(['a', 'b'], ['b']), m => m, 'en', slow, 5)).length, 0);
});
test('readability checks are shared, pause after a failure and keep expired answers while refreshing', async () => {
  let calls = 0, fail = false, clock = 1000;
  const readability = createReadability(async () => { calls++; if (fail) throw new Error('429'); return 1; }, { spacing: 0, parallel: 1, ttl: 100, backoff: 500, now: () => clock });
  await Promise.all([readability.check(['a', 'b'], 'en', 500), readability.check(['b', 'a'], 'en', 500)]);
  assert.equal(calls, 2);
  clock += 200; fail = true;
  await readability.check(['a', 'b', 'c'], 'en', 500);
  assert.equal(calls, 3, 'one failure stops the whole queue');
  assert.equal(readability.get('a', 'en'), true); assert.equal(readability.get('c', 'en'), undefined);
  fail = false;
  await readability.check(['c'], 'en', 500); assert.equal(calls, 3);
  clock += 600;
  await readability.check(['c'], 'en', 500); assert.equal(calls, 4); assert.equal(readability.get('c', 'en'), true);
});
