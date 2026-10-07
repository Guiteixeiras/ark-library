import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessGuard } from '../server/access.mjs';

const testPassword = 'ephemeral-password-for-tests-only';
const basic = value => `Basic ${Buffer.from(value).toString('base64')}`;
function request(guard, path, authorization, method = 'GET') {
  const result = { headers: {} };
  const allowed = guard({ url: path, method, headers: { authorization } }, {
    setHeader(key, value) { result.headers[key] = value; },
    writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); },
    end(body) { result.body = body; },
  });
  return { ...result, allowed };
}
test('local development remains usable and production cannot accidentally start without access protection', () => {
  assert.equal(request(createAccessGuard({}), '/', undefined).allowed, true);
  assert.throws(() => createAccessGuard({ NODE_ENV: 'production' }), /Configure ARK_ACCESS_PASSWORD/);
  assert.throws(() => createAccessGuard({ ARK_REQUIRE_ACCESS: 'true' }), /Configure/);
  assert.throws(() => createAccessGuard({ ARK_REQUIRE_ACCESS: 'tru' }), /true ou false/);
  assert.throws(() => createAccessGuard({ ARK_ACCESS_PASSWORD: 'short' }), /16/);
  assert.throws(() => createAccessGuard({ ARK_ACCESS_PASSWORD: testPassword, ARK_ACCESS_USER: 'ark:guest' }), /ASCII/);
});
test('private hosting protects HTML, assets, catalogue, chapter images and Ollama POSTs', () => {
  const guard = createAccessGuard({ NODE_ENV: 'production', ARK_ACCESS_PASSWORD: testPassword });
  for (const path of ['/', '/assets/index.js', '/api/catalog', '/api/chapter/id/image/0', '/api/ark/recommendations', '/api/health/']) {
    const r = request(guard, path, undefined, path.includes('recommendations') ? 'POST' : 'GET');
    assert.equal(r.allowed, false); assert.equal(r.status, 401); assert.match(r.headers['WWW-Authenticate'], /Basic/);
    assert(!r.body.includes(testPassword));
  }
  assert.equal(request(guard, '/api/health?probe=1', undefined).allowed, true);
  assert.equal(request(guard, '/api/health', undefined, 'POST').allowed, false);
});
test('correct credentials work, malformed/wrong credentials and query-string passwords are rejected', () => {
  const guard = createAccessGuard({ ARK_REQUIRE_ACCESS: 'true', ARK_ACCESS_USER: 'reader', ARK_ACCESS_PASSWORD: testPassword });
  for (const header of [undefined, 'Bearer token', 'Basic !!!', basic('reader:wrong'), basic('wrong:' + testPassword), basic('reader')])
    assert.equal(request(guard, '/', header).status, 401);
  const r = request(guard, '/api/catalog', basic('reader:' + testPassword));
  assert.equal(r.allowed, true); assert.equal(r.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(request(guard, '/?password=' + testPassword, undefined).status, 401);
  assert.equal(request(guard, '/api/catalog', basic('reader:' + testPassword + ':extra')).status, 401);
});
