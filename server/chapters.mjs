const NUMBER = /^\d+(?:\.\d+)?$/;
export function chapterKey(chapter) {
  const a = chapter.attributes;
  return NUMBER.test(a.chapter || '') ? String(Number(a.chapter)) : `special:${chapter.id}`;
}
export function mapChapter(chapter) {
  const a = chapter.attributes;
  return {
    id: chapter.id, number: a.chapter, volume: a.volume || null,
    title: a.title || '', language: a.translatedLanguage,
    group: chapter.relationships.filter(r => r.type === 'scanlation_group')
      .map(r => r.attributes?.name).filter(Boolean).join(', ') || 'Grupo não informado',
    url: `https://mangadex.org/chapter/${chapter.id}`,
  };
}
const languageRank = chapter => ({ 'pt-br': 2, pt: 1 })[chapter.attributes.translatedLanguage] || 0;
export function groupChapters(raw) {
  const groups = new Map();
  for (const chapter of raw) {
    const a = chapter.attributes;
    if (a.isUnavailable || a.externalUrl || a.pages === 0) continue;
    const key = chapterKey(chapter);
    const group = groups.get(key) || [];
    group.push(chapter); groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    group.sort((a, b) =>
      languageRank(b) - languageRank(a) ||
      (Date.parse(b.attributes.updatedAt) || 0) - (Date.parse(a.attributes.updatedAt) || 0) || a.id.localeCompare(b.id));
    return { ...mapChapter(group[0]), alternatives: group.slice(1).map(mapChapter) };
  }).sort((a, b) => {
    const na = NUMBER.test(a.number || '') ? Number(a.number) : Infinity;
    const nb = NUMBER.test(b.number || '') ? Number(b.number) : Infinity;
    return na - nb || a.id.localeCompare(b.id);
  });
}
// Explains why a work has few chapters: what MangaDex knows, what it still serves and where it links out.
export function chapterAvailability(raw, language) {
  const english = c => c.attributes.translatedLanguage === 'en';
  const selected = raw.filter(c => language === 'pt-en' || english(c) === (language === 'en'));
  const readable = c => !c.attributes.isUnavailable && !c.attributes.externalUrl && c.attributes.pages !== 0;
  const keys = (items, accept) => new Set(items.filter(accept).map(chapterKey));
  const known = keys(selected, () => true), hosted = keys(selected, readable);
  const external = [], linked = new Set(), seen = new Set();
  for (const c of selected) {
    const { externalUrl, isUnavailable, chapter: number, title } = c.attributes;
    if (!externalUrl || isUnavailable || !NUMBER.test(number || '')) continue;
    let url;
    try { url = new URL(externalUrl); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    const key = `${url.hostname}:${chapterKey(c)}`;
    linked.add(chapterKey(c));
    if (!seen.has(key)) { seen.add(key); external.push({ number, title: title || '', host: url.hostname, url: url.href }); }
  }
  external.sort((a, b) => a.host.localeCompare(b.host) || Number(a.number) - Number(b.number));
  return {
    known: known.size, readable: hosted.size,
    unavailable: [...known].filter(key => !hosted.has(key) && !linked.has(key)).length,
    english: language === 'pt-br' ? [...keys(raw, c => english(c) && readable(c))].filter(key => !key.startsWith('special:') && !hosted.has(key)).length : 0,
    external: external.slice(0, 500),
  };
}
export function chapterSlice(items, { page, chapterId, chapterNumber, after }) {
  let index = -1;
  if (chapterId) index = items.findIndex(c => c.id === chapterId || c.alternatives.some(a => a.id === chapterId));
  if (index < 0 && chapterNumber !== null) index = items.findIndex(c => Number(c.number) === Number(chapterNumber) && c.number !== null);
  if (index < 0 && after !== null) index = items.findIndex(c => c.number !== null && NUMBER.test(c.number) && Number(c.number) > Number(after));
  if (index < 0 && after !== null) index = items.length - 1;
  const resolvedPage = index >= 0 ? Math.floor(index / 40) + 1 : Math.min(page, Math.max(1, Math.ceil(items.length / 40)));
  return { items: items.slice((resolvedPage - 1) * 40, resolvedPage * 40), total: items.length, page: resolvedPage, startId: index >= 0 ? items[index].id : null };
}
