import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { arkApi, validateProfile, topGenres, parseRecommendations, recommendationRequest } from '../server/ark.mjs';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const item = (n, tags, extra = {}) => ({ id: id(n), title: `Title ${n}`, tags, status: 'reading', favorite: false, ...extra });
test('AI profile uses collection preferences and rejects malformed and duplicate records', () => {
  const profile = validateProfile({ items: [item(1, ['Action']), item(2, ['Romance'], { favorite: true })], language: 'pt-br' });
  assert.equal(topGenres(profile)[0], 'Romance');
  for (const body of [{ items: [], language: 'en' }, { items: [item(1, ['Action']), item(1, ['Action'])], language: 'en' }, { items: [item(1, ['Action'])], language: 'ja' }])
    assert.throws(() => validateProfile(body));
});
test('AI output cannot invent works, repeat them or exceed the limits, and one bad entry keeps the valid ones', () => {
  const candidates = [1, 2, 3, 4].map(n => ({ ref: `f${n}`, manga: { id: id(n) }, kind: 'familiar' })).concat({ ref: 's1', manga: { id: id(9) }, kind: 'surprise' });
  const result = parseRecommendations(JSON.stringify({ familiar: [{ id: 'f1', reason: ' Afinidade com ação. ' }, { id: 'f1', reason: 'Repetida' }, { id: 'f99', reason: 'Inventada' }, { id: 'f2', reason: {} }, { id: 'f3', reason: 'x'.repeat(900) }], surprise: { id: 's1', reason: 'Um gênero novo.' } }), candidates);
  assert.deepEqual(result.map(r => [r.manga.id, r.kind]), [[id(1), 'familiar'], [id(3), 'familiar'], [id(9), 'surprise']]);
  assert.equal(result[0].reason, 'Afinidade com ação.'); assert.equal(result[1].reason.length, 350);
  assert.equal(parseRecommendations(JSON.stringify({ familiar: ['f1', 'f2', 'f3', 'f4'].map(ref => ({ id: ref, reason: 'Motivo' })) }), candidates).length, 3);
  for (const bad of [{ familiar: [{ id: id(1), reason: 'Unknown' }] }, { familiar: [] }, { familiar: 'f1' }, null, {}])
    assert.throws(() => parseRecommendations(JSON.stringify(bad), candidates));
});
test('AI request stays small for large collections and only allows the offered candidates', () => {
  const profile = Array.from({ length: 2000 }, (_, n) => item(n, ['Action', 'Comedy', 'Romance', 'Fantasy', 'Drama'], { title: 'T'.repeat(400), favorite: n === 1999 }));
  const candidates = ['familiar', 'surprise'].flatMap(kind => Array.from({ length: 10 }, (_, n) => ({ ref: `${kind[0]}${n + 1}`, kind, manga: { id: id(n), title: 'T'.repeat(400), tags: ['Action'], description: 'D'.repeat(4000) } })));
  const { format, prompt } = recommendationRequest(profile, ['Action'], candidates);
  assert(JSON.stringify(prompt).length < 9000);
  assert(prompt.colecao[0].includes('favorita'));
  assert.deepEqual(format.properties.surprise.properties.id.enum, Array.from({ length: 10 }, (_, n) => `s${n + 1}`));
  assert.deepEqual(format.required, ['familiar', 'surprise']);
  assert.deepEqual(recommendationRequest(profile, ['Action'], candidates.slice(0, 10)).format.required, ['familiar']);
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
      const { candidatos } = JSON.parse(chatBody.messages[1].content);
      const choice = prefix => ({ id: candidatos.find(c => c.id.startsWith(prefix)).id, reason: 'Uma sugestão com base na coleção.' });
      return Response.json({ message: { content: JSON.stringify({ familiar: [choice('f')], surprise: choice('s') }) } });
    };
    let call = 0;
    await arkApi(req, { writeHead(n) { status = n; }, end(body) { result = JSON.parse(body); } }, new URL('http://ark.test/api/ark/recommendations'), {
      upstream: async path => { assert(path.startsWith('/manga?')); call++; return { data: [item(call + 1, ['Action'])] }; }, mapManga: m => ({ ...m, description: "" }),
    });
    assert.equal(status, 200); assert.equal(result.items.length, 2);
    assert.equal(chatBody.model, 'llama3:latest'); assert.equal(chatBody.stream, false); assert.equal(chatBody.format.type, 'object');
    assert.equal(chatBody.options.num_ctx, 4096);
    assert.match(JSON.parse(chatBody.messages[1].content).colecao[0], /^Title 1 \(lendo, Ação\)$/);
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

test('AI only receives works that can be read', async () => {
  const original = globalThis.fetch;
  const req = Readable.from([JSON.stringify({ language: 'pt-br', items: [item(1, ['Action'])] })]); req.method = 'POST';
  const verdicts = { [id(2)]: undefined, [id(3)]: false, [id(4)]: true, [id(5)]: false, [id(6)]: undefined };
  let titles, checked = [];
  try {
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gemma3:4b' }] });
      titles = JSON.parse(JSON.parse(options.body).messages[1].content).candidatos.map(c => c.titulo).sort();
      return Response.json({ message: { content: JSON.stringify({ familiar: [{ id: 'f1', reason: 'Motivo' }] }) } });
    };
    await arkApi(req, { writeHead() {}, end() {} }, new URL('http://ark.test/api/ark/recommendations'), {
      upstream: async path => {
        const p = new URL('https://api.test' + path).searchParams;
        if (p.has('excludedTags[]')) return { data: [] };
        return { data: (p.get('hasUnavailableChapters') === '0' ? [2, 3] : [1, 4, 5, 6]).map(n => item(n, ['Action'])) };
      },
      mapManga: m => ({ ...m, description: '' }),
      readability: { get: i => verdicts[i], check: ids => { checked.push(...ids); return Promise.resolve(); } },
    });
    assert.deepEqual(titles, ['Title 2', 'Title 4']);
    assert.deepEqual(checked, [id(4), id(5), id(6)]);
  } finally { globalThis.fetch = original; }
});
