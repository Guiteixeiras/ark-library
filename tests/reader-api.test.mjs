import test from 'node:test';
import assert from 'node:assert/strict';
import { apiMiddleware } from '../server/api.mjs';
const id = '08bfe070-e9e6-4b61-a781-1ab708e9755a';
async function request(path) {
  let status, body;
  await apiMiddleware({ url: path, method: 'GET' }, {
    writeHead(code) { status = code; },
    end(data) { body = Buffer.isBuffer(data) ? data : JSON.parse(data); },
  }, () => assert.fail('API fell through'));
  return { status, body };
}
function assignment(baseUrl = 'https://node.mangadex.network') {
  return { result: 'ok', baseUrl, chapter: { hash: 'a'.repeat(32), data: ['1-test.png', '2-test.jpg'], dataSaver: ['1-small.jpg', '2-small.jpg'] } };
}
test('reader obtains fresh image assignments and validates destinations', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async url => {
      assert.equal(url, `https://api.mangadex.org/at-home/server/${id}`);
      calls++;
      return Response.json(assignment());
    };
    for (let i = 0; i < 2; i++) {
      const r = await request(`/api/chapter/${id}/pages`);
      assert.equal(r.status, 200);
      assert.equal(r.body.pages[0], `/api/chapter/${id}/image/0`);
    }
    assert.equal(calls, 2, 'expired node URLs must not be served from the catalogue cache');
    for (const url of ['http://node.mangadex.network', 'https://mangadex.network.attacker.test', 'https://127.0.0.1', 'https://user:password@node.mangadex.network', 'https://node.mangadex.network:8080']) {
      globalThis.fetch = async () => Response.json(assignment(url));
      assert.equal((await request(`/api/chapter/${id}/pages`)).status, 502);
    }
    const bad = assignment(); bad.chapter.data = ['../../private.png'];
    globalThis.fetch = async () => Response.json(bad);
    assert.equal((await request(`/api/chapter/${id}/pages`)).status, 502);
    globalThis.fetch = async () => new Response(null, { status: 404 });
    const removed = await request(`/api/chapter/${id}/pages`);
    assert.equal(removed.status, 404);
    assert.match(removed.body.error, /não está disponível/);
    calls = 0; globalThis.fetch = async () => { calls++; throw new Error('should not fetch'); };
    assert.equal((await request('/api/chapter/not-a-uuid/pages')).status, 400);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test('chapter pagination respects MangaDex limits and only requests hosted available chapters', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async input => {
      const u = new URL(input);
      assert.equal(u.searchParams.get('offset'), '0');
      assert.equal(u.searchParams.get('limit'), '500');
      assert.equal(u.searchParams.get('order[chapter]'), 'asc');
      assert.equal(u.searchParams.get('includeExternalUrl'), '0');
      assert.equal(u.searchParams.get('includeUnavailable'), '0');
      return Response.json({ result: 'ok', total: 10000, data: [] });
    };
    assert.equal((await request(`/api/manga/${id}/chapters?language=en&page=250`)).status, 200);
    for (const page of ['251', '0', '-1', '1.5', 'NaN'])
      assert.equal((await request(`/api/manga/${id}/chapters?page=${page}`)).status, 400);
  } finally { globalThis.fetch = original; }
});
test('original and compressed image routes use the assigned server and report actual deliveries', async () => {
  const original = globalThis.fetch;
  const deliveries = [], reports = [];
  try {
    globalThis.fetch = async (input, options) => {
      if (input.includes('/at-home/server/')) return Response.json(assignment());
      if (input.endsWith('/report')) { reports.push(JSON.parse(options.body)); return Response.json({ ok: true }); }
      deliveries.push(input);
      assert.equal(options.redirect, 'error'); assert.equal(options.headers?.Authorization, undefined);
      return new Response(Buffer.from('image bytes'), { headers: { 'Content-Type': 'image/png', 'X-Cache': 'HIT' } });
    };
    const pages = await request(`/api/chapter/${id}/pages?quality=compressed`);
    assert.equal(pages.body.quality, 'compressed'); assert(pages.body.pages[0].endsWith('?quality=compressed'));
    assert.equal((await request(`/api/chapter/${id}/image/0`)).status, 200);
    assert.equal((await request(`/api/chapter/${id}/image/0?quality=compressed`)).status, 200);
    assert(deliveries[0].includes('/data/')); assert(deliveries[1].includes('/data-saver/'));
    assert.equal(reports.length, 2); assert(reports.every(r => r.success && r.bytes === 11 && r.cached));
    assert.equal((await request(`/api/chapter/${id}/pages?quality=invalid`)).status, 400);
    assert.equal((await request(`/api/chapter/${id}/image/0?quality=invalid`)).status, 400);
  } finally { globalThis.fetch = original; }
});
test('consolidation paginates after fetching versions across upstream page boundaries', async () => {
  const original = globalThis.fetch;
  const mangaId = '00000000-0000-0000-0000-000000007777';
  const raw = n => ({ id: `00000000-0000-0000-0000-${String(n + 1).padStart(12, '0')}`, attributes: { chapter: String(n), translatedLanguage: 'pt-br', title: '', pages: 1, updatedAt: '2026-01-01' }, relationships: [] });
  let calls = 0;
  try {
    globalThis.fetch = async input => {
      const url = new URL(input); calls++;
      assert.deepEqual(url.searchParams.getAll('translatedLanguage[]'), ['pt-br', 'pt']);
      const offset = Number(url.searchParams.get('offset'));
      return Response.json({ result: 'ok', total: 502, data: offset === 0 ? Array.from({ length: 500 }, (_, n) => raw(n)) : [{ ...raw(499), id: '00000000-0000-0000-0000-000000009999', attributes: { ...raw(499).attributes, updatedAt: '2026-09-01' } }, raw(500)] });
    };
    const result = await request(`/api/manga/${mangaId}/chapters?language=pt-br&page=13`);
    assert.equal(result.status, 200); assert.equal(calls, 2); assert.equal(result.body.total, 501); assert.equal(result.body.items.length, 21);
    assert.equal(result.body.items.filter(c => c.number === '499').length, 1);
    const located = await request(`/api/manga/${mangaId}/chapters?language=pt-br&chapterId=00000000-0000-0000-0000-000000000500`);
    assert.equal(located.body.page, 13); assert.equal(located.body.startId, '00000000-0000-0000-0000-000000009999');
  } finally { globalThis.fetch = original; }
});
