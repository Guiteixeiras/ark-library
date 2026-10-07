import { chapterKey, groupChapters } from './chapters.mjs';

export const FEATURED_LIMIT = 100;
export const RELEASE_DAYS = 7;
export function withPopularity(items, statistics) {
  return items.flatMap(item => {
    const stats = statistics[item.id];
    const rating = stats?.rating?.bayesian;
    const followers = stats?.follows;
    return Number.isFinite(rating) && rating >= 7 && Number.isFinite(followers) && followers >= 1000
      ? [{ ...item, rating, followers }] : [];
  });
}
export async function featuredManga(upstream, mapManga, language) {
  const params = new URLSearchParams({ limit: String(FEATURED_LIMIT), 'order[followedCount]': 'desc',
    'includes[]': 'cover_art', hasAvailableChapters: 'true' });
  for (const code of language === 'en' ? ['en'] : ['pt-br', 'pt']) params.append('availableTranslatedLanguage[]', code);
  for (const rating of ['safe', 'suggestive']) params.append('contentRating[]', rating);
  const data = await upstream(`/manga?${params}`);
  if (!data.data.length) return [];
  const ids = new URLSearchParams();
  for (const item of data.data) ids.append('manga[]', item.id);
  const stats = await upstream(`/statistics/manga?${ids}`);
  return withPopularity(data.data.map(mapManga), stats.statistics || {});
}
export function featuredSlice(items, { query, kind, genreName, status, sort, page }) {
  const filtered = items.filter(m => (!query || `${m.title} ${m.originalTitle}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
    (kind === 'all' || m.kind === { manga: 'Mangá', manhwa: 'Manhwa', manhua: 'Manhua' }[kind]) &&
    (!genreName || m.tags.includes(genreName)) && (status === 'all' || m.status === status));
  filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'pt-BR') :
    sort === 'rating' ? b.rating - a.rating || b.followers - a.followers : b.followers - a.followers);
  return { items: filtered.slice((page - 1) * 24, page * 24), total: filtered.length, page, limit: 24 };
}
export function recentReleases(raw, manga, now = Date.now()) {
  const byId = new Map(manga.map(m => [m.id, m]));
  const groups = new Map();
  for (const chapter of raw) {
    const id = chapter.relationships.find(r => r.type === 'manga')?.id;
    const a = chapter.attributes;
    const published = Date.parse(a.readableAt || a.publishAt);
    if (!byId.has(id) || !['pt-br', 'pt', 'en'].includes(a.translatedLanguage) ||
        !Number.isFinite(published) || published > now || published < now - RELEASE_DAYS * 86400000 ||
        a.pages === 0 || a.isUnavailable || a.externalUrl) continue;
    const key = `${id}:${chapterKey(chapter)}:${a.translatedLanguage === 'en' ? 'en' : 'pt-br'}`;
    const group = groups.get(key) || []; group.push(chapter); groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const chapter = groupChapters(group)[0];
    const selected = group.find(c => c.id === chapter.id);
    const id = selected.relationships.find(r => r.type === 'manga').id;
    // Date belongs to the selected translation, not the last edit or an embargo date.
    return { key, manga: byId.get(id), chapter, publishedAt: selected.attributes.readableAt || selected.attributes.publishAt };
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
export async function releaseFeed(upstream, manga, language) {
  const raw = [];
  const since = Date.now() - RELEASE_DAYS * 86400000;
  let truncated = false;
  for (let offset = 0; offset < 500; offset += 100) {
    const params = new URLSearchParams({ limit: '100', offset: String(offset), 'order[readableAt]': 'desc',
      'includes[]': 'scanlation_group', includeExternalUrl: '0', includeUnavailable: '0' });
    for (const code of language === 'en' ? ['en'] : ['pt-br', 'pt']) params.append('translatedLanguage[]', code);
    const data = await upstream(`/chapter?${params}`);
    raw.push(...data.data);
    const last = Date.parse(data.data.at(-1)?.attributes.readableAt);
    if (data.data.length < 100 || offset + data.data.length >= data.total || last < since) break;
    if (offset === 400) truncated = true;
  }
  return { items: recentReleases(raw, manga).slice(0, 40), days: RELEASE_DAYS, truncated };
}
