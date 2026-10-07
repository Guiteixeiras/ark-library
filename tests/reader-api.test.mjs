import test from 'node:test';
import assert from 'node:assert/strict';
import { apiMiddleware } from '../server/api.mjs';
const id = '08bfe070-e9e6-4b61-a781-1ab708e9755a';
async function request(path) {
  let status, body;
  await apiMiddleware({ url: path, method: 'GET' }, {
    writeHead(code) { status = code; },
    end(data) { body = JSON.parse(data); },
  }, () => assert.fail('API fell through'));
  return { status, body };
}
function assignment(baseUrl = 'https://node.mangadex.network') {
  return { result: 'ok', baseUrl, chapter: { hash: 'a'.repeat(32), data: ['1-test.png', '2-test.jpg'] } };
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
      assert.equal(u.searchParams.get('offset'), '9960');
      assert.equal(u.searchParams.get('limit'), '40');
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
