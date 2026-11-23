// Remembers which works have at least one chapter hosted in a language. MangaDex has no bulk query for
// this, so works are verified one at a time, slowly enough to leave its rate limit free for reading.
const HOUR = 3600000;
export function createReadability(countChapters, { spacing = 300, parallel = 3, backoff = 60000, ttl = 12 * HOUR, limit = 2000, now = Date.now } = {}) {
  const known = new Map(), active = new Set();
  let queue = new Map(), waiting = [], timer = null, resumeAt = 0;
  const keyOf = (id, language) => `${language}:${id}`;
  const pending = key => queue.has(key) || active.has(key);
  const settle = () => { waiting = waiting.filter(w => { if (w.keys.some(pending)) return true; w.done(); return false; }); };
  async function verify(key, { id, language }) {
    active.add(key);
    try {
      const readable = await countChapters(id, language) > 0;
      known.delete(key);
      if (known.size >= limit) known.delete(known.keys().next().value);
      known.set(key, { readable, expires: now() + ttl });
    } catch {
      // Rate limited or offline: keep what is known and leave the rest for a later visit.
      queue.clear(); resumeAt = now() + backoff;
    }
    active.delete(key);
    settle();
    pump();
  }
  // Starts are spaced, so a slow answer does not hold the others back.
  function pump() {
    if (timer || !queue.size || active.size >= parallel) return;
    const [key, entry] = queue.entries().next().value;
    queue.delete(key);
    timer = setTimeout(() => { timer = null; pump(); }, spacing);
    void verify(key, entry);
  }
  return {
    // true or false once verified; undefined while unknown.
    get: (id, language) => known.get(keyOf(id, language))?.readable,
    // Resolves when every id is verified or after `wait` ms, whichever comes first. Works someone is
    // waiting for go first. An expired answer stays in use while it is verified again.
    check(ids, language, wait = 0) {
      const keys = ids.map(id => keyOf(id, language));
      if (now() >= resumeAt) {
        const wanted = new Map();
        ids.forEach((id, i) => { if (!(known.get(keys[i])?.expires > now()) && !active.has(keys[i])) wanted.set(keys[i], { id, language }); });
        queue = wait > 0 ? new Map([...wanted, ...queue]) : new Map([...queue, ...wanted]);
        pump();
      }
      const missing = keys.filter(key => pending(key) && !known.has(key));
      if (!missing.length || wait <= 0) return Promise.resolve();
      return new Promise(resolve => {
        const deadline = setTimeout(resolve, wait);
        waiting.push({ keys: missing, done: () => { clearTimeout(deadline); resolve(); } });
      });
    },
  };
}
