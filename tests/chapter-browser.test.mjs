import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { chapterListOptions, chapterListSlice } from '../src/chapter-browser.ts';
import { apiMiddleware } from '../server/api.mjs';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const chapter = n => ({ id: id(n + 1), number: String(n), title: '', language: 'pt-br', group: 'Grupo', alternatives: [], url: `https://mangadex.org/chapter/${id(n + 1)}` });
const options = overrides => ({ language: 'pt-br', page: 1, order: 'desc', filter: 'all', query: '', through: '', completed: [], ...overrides });
test('chapter search and read filters apply before pagination without changing reader order', () => {
  const chapters = Array.from({ length: 101 }, (_, n) => chapter(n));
  const recent = chapterListSlice(chapters, options());
  assert.equal(recent.items[0].number, '100'); assert.equal(recent.items.at(-1).number, '61');
  const unread = chapterListSlice(chapters, options({ through: '50', filter: 'unread', page: 2 }));
  assert.equal(unread.total, 50); assert.equal(unread.readTotal, 51); assert.equal(unread.items[0].number, '60');
  const exact = chapterListSlice(chapters, options({ query: '12' }));
  assert.deepEqual(exact.items.map(c => c.number), ['12']);
  assert.equal(chapters[0].number, '0'); assert.equal(chapters.at(-1).number, '100');
});
test('decimal search, alternate completed translations and specials retain correct read status', () => {
  const decimal = { ...chapter(13), number: '12.5', title: 'Ação extra' };
  const special = { ...chapter(14), number: null, title: 'Especial', alternatives: [{ ...chapter(99), number: null }] };
  const chapters = [chapter(0), decimal, special];
  assert.equal(chapterListSlice(chapters, options({ query: 'Cap. 12,5' })).items[0].number, '12.5');
  assert.equal(chapterListSlice(chapters, options({ query: 'acao' })).total, 1);
  const result = chapterListSlice(chapters, options({ completed: [id(100)] }));
  assert.equal(result.readTotal, 1); assert.equal(result.items.find(c => c.number === '0').isRead, false);
  assert.equal(result.items.at(-1).isRead, true);
});
async function request(body, mangaId = id(8888), raw = false) {
  const req = Readable.from([raw ? body : JSON.stringify(body)]);
  req.method = 'POST'; req.url = `/api/manga/${mangaId}/chapter-list`; req.headers = { 'content-type': 'application/json' };
  let status, result;
  await apiMiddleware(req, { writeHead(n) { status = n; }, end(data) { result = JSON.parse(data); } }, () => assert.fail('fallthrough'));
  return { status, body: result };
}
test('chapter-list API validates input and never shares reading status through the upstream cache', async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async input => {
      calls++; const url = new URL(input);
      assert.equal(url.searchParams.get('order[chapter]'), 'asc');
      return Response.json({ result: 'ok', total: 101, data: Array.from({ length: 101 }, (_, n) => ({ id: id(n + 1), attributes: { chapter: String(n), title: '', translatedLanguage: 'pt-br', pages: 1 }, relationships: [] })) });
    };
    const read = await request(options({ through: '50', filter: 'read' }));
    assert.equal(read.status, 200); assert.equal(read.body.total, 51);
    const fresh = await request(options({ filter: 'read' }));
    assert.equal(fresh.body.total, 0); assert.equal(calls, 1);
    assert.equal((await request(options({ query: '100' }))).body.items[0].number, '100');
    for (const change of [{ page: 0 }, { language: 'ja' }, { completed: ['bad-id'] }, { filter: 'bad' }, { through: '-1' }])
      assert.equal((await request(options(change))).status, 400);
    assert.equal((await request('x'.repeat(33000), id(8888), true)).status, 413);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
