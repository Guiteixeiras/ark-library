import type { Chapter } from './types';

export type ChapterListOptions = { language: 'pt-br' | 'en'; page: number; query: string; order: 'asc' | 'desc'; filter: 'all' | 'read' | 'unread'; through: string; completed: string[] };
const NUMBER = /^\d+(?:\.\d+)?$/;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function chapterListOptions(raw: unknown): ChapterListOptions {
  const o = raw as ChapterListOptions;
  if (!o || !['pt-br', 'en'].includes(o.language) || !Number.isInteger(o.page) || o.page < 1 || o.page > 250 ||
      typeof o.query !== 'string' || o.query.length > 120 || !['asc', 'desc'].includes(o.order) || !['all', 'read', 'unread'].includes(o.filter) ||
      typeof o.through !== 'string' || o.through.length > 12 || o.through !== '' && !NUMBER.test(o.through) ||
      !Array.isArray(o.completed) || o.completed.length > 500 || o.completed.some(id => typeof id !== 'string' || !UUID.test(id)))
    throw new Error('Filtros de capítulos inválidos.');
  return { language: o.language, page: o.page, query: o.query.trim(), order: o.order, filter: o.filter, through: o.through, completed: [...new Set(o.completed)] };
}
export function chapterIsRead(chapter: Chapter, through: string, completed: Set<string>) {
  return completed.has(chapter.id) || !!chapter.alternatives?.some(c => completed.has(c.id)) ||
    NUMBER.test(through) && NUMBER.test(chapter.number || '') && Number(chapter.number) <= Number(through);
}
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function chapterListSlice(chapters: Chapter[], options: ChapterListOptions) {
  const completed = new Set(options.completed);
  const all = chapters.map(c => ({ ...c, isRead: chapterIsRead(c, options.through, completed) }));
  const query = options.query.replace(/^(?:cap(?:itulo|ítulo)?\.?\s*)/i, '').replace(',', '.');
  const numeric = NUMBER.test(query);
  let items = all.filter(c => (!options.query || (numeric ? NUMBER.test(c.number || '') && Number(c.number) === Number(query) : fold(c.title).includes(fold(options.query)))) &&
    (options.filter === 'all' || c.isRead === (options.filter === 'read')));
  if (options.order === 'desc') items = [...items.filter(c => NUMBER.test(c.number || '')).reverse(), ...items.filter(c => !NUMBER.test(c.number || ''))];
  const page = Math.min(options.page, Math.max(1, Math.ceil(items.length / 40)));
  return { items: items.slice((page - 1) * 40, page * 40), total: items.length, page,
    availableTotal: all.length, readTotal: all.filter(c => c.isRead).length };
}
