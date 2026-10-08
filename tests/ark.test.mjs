import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { arkApi, validateProfile, topGenres, parseRecommendations } from '../server/ark.mjs';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const item = (n, tags, extra = {}) => ({ id: id(n), title: `Title ${n}`, tags, status: 'reading', favorite: false, ...extra });
test('AI profile uses collection preferences and rejects malformed and duplicate records', () => {
  const profile = validateProfile({ items: [item(1, ['Action']), item(2, ['Romance'], { favorite: true })], language: 'pt-br' });
  assert.equal(topGenres(profile)[0], 'Romance');
  for (const body of [{ items: [], language: 'en' }, { items: [item(1, ['Action']), item(1, ['Action'])], language: 'en' }, { items: [item(1, ['Action'])], language: 'ja' }])
    assert.throws(() => validateProfile(body));
});
test('AI output cannot invent catalogue IDs, duplicate works or return invalid reasons', () => {
  const candidates = [{ manga: { id: id(1) }, kind: 'familiar' }, { manga: { id: id(2) }, kind: 'surprise' }];
  const result = parseRecommendations(JSON.stringify({ recommendations: [{ id: id(1), reason: 'Afinidade com ação.' }, { id: id(2), reason: 'Um gênero novo.' }] }), candidates);
  assert.equal(result[1].kind, 'surprise');
  for (const recommendations of [[{ id: id(999), reason: 'Unknown' }], [{ id: id(1), reason: 'A' }, { id: id(1), reason: 'B' }], [{ id: id(1), reason: {} }]])
    assert.throws(() => parseRecommendations(JSON.stringify({ recommendations }), candidates));
});
test('Ollama integration uses installed models, collection context and real validated catalogue candidates', async () => {
  const original = globalThis.fetch;
  let chatBody;
  const req = Readable.from([JSON.stringify({ language: 'pt-br', items: [item(1, ['Action'])] })]); req.method = 'POST';
  let status, result;
  try {
    globalThis.fetch = async (url, options) => {
      assert(url.startsWith('http://127.0.0.1:11434/api/'));
      if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'llama3:latest' }] });
      chatBody = JSON.parse(options.body);
      const candidates = JSON.parse(chatBody.messages[1].content).candidates;
      return Response.json({ message: { content: JSON.stringify({ recommendations: candidates.slice(0, 2).map(c => ({ id: c.id, reason: 'Uma sugestão com base na coleção.' })) }) } });
    };
    let call = 0;
    await arkApi(req, { writeHead(n) { status = n; }, end(body) { result = JSON.parse(body); } }, new URL('http://ark.test/api/ark/recommendations'), {
      upstream: async path => { assert(path.startsWith('/manga?')); call++; return { data: [item(call + 1, ['Action'])] }; }, mapManga: m => ({ ...m, description: "" }),
    });
    assert.equal(status, 200); assert.equal(result.items.length, 2);
    assert.equal(chatBody.model, 'llama3:latest'); assert.equal(chatBody.stream, false); assert.equal(chatBody.format, 'json');
    assert.equal(JSON.parse(chatBody.messages[1].content).collection[0].id, id(1));
    globalThis.fetch = async () => { throw new Error('offline'); };
    await arkApi({ method: 'GET' }, { writeHead(n) { status = n; }, end(body) { result = JSON.parse(body); } }, new URL('http://ark.test/api/ark/status'), {});
    assert.equal(status, 200); assert.equal(result.connected, false);
  } finally { globalThis.fetch = original; }
});

test('hosted Ollama connection failure identifies a PC-only localhost configuration', async () => {
  const original = globalThis.fetch;
  const oldRender = process.env.RENDER;
  try {
    process.env.RENDER = 'true'; globalThis.fetch = async () => { throw Error('offline'); };
    let result;
    await arkApi({ method: 'GET' }, { writeHead() {}, end(body) { result = JSON.parse(body); } }, new URL('http://ark.test/api/ark/status'), {});
    assert.equal(result.connected, false); assert.equal(result.reason, 'hosted-local-ollama');
    assert.deepEqual(result.models, []);
  } finally { globalThis.fetch = original; if (oldRender === undefined) delete process.env.RENDER; else process.env.RENDER = oldRender; }
});
