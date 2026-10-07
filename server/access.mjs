import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();

// One shared access credential for the personal deployment, without accounts.
export function createAccessGuard(env = process.env) {
  const required = env.ARK_REQUIRE_ACCESS === undefined
    ? env.NODE_ENV === 'production'
    : env.ARK_REQUIRE_ACCESS === 'true';
  if (env.ARK_REQUIRE_ACCESS !== undefined && !['true', 'false'].includes(env.ARK_REQUIRE_ACCESS))
    throw new Error('ARK_REQUIRE_ACCESS deve ser true ou false.');
  const password = env.ARK_ACCESS_PASSWORD || '';
  if (required && !password) throw new Error('Configure ARK_ACCESS_PASSWORD na hospedagem antes de iniciar o ARK.');
  if (!password) return () => true;
  if (password.length < 16 || password.length > 1024 || /[\r\n]/.test(password))
    throw new Error('ARK_ACCESS_PASSWORD deve ter entre 16 e 1024 caracteres, sem quebras de linha.');
  const user = env.ARK_ACCESS_USER || 'ark';
  if (!/^[\x21-\x7e]{1,100}$/.test(user) || user.includes(':'))
    throw new Error('ARK_ACCESS_USER deve usar até 100 caracteres ASCII, sem espaços ou dois-pontos.');
  const expected = digest(`${user}:${password}`);

  return (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    // Public, data-free endpoint for the hosting provider's readiness probe.
    if (url.pathname === '/api/health' && req.method === 'GET') return true;
    const header = req.headers.authorization || '';
    const match = typeof header === 'string' && header.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
    if (match && timingSafeEqual(digest(Buffer.from(match[1], 'base64')), expected)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'private, no-store');
      return true;
    }
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="ARK Library", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end('ARK Library privada. Use o usuário e a senha configurados na hospedagem.');
    return false;
  };
}
