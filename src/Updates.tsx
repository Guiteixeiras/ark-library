import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { languageLabel, readPosition } from "./reading";
import { hasUnreadChapter, readDismissed, UPDATES_KEY } from "./updates";
import type { ReadingLanguage } from "./reading";
import type { Chapter, Collection, Manga } from "./types";

export default function Updates({ collection, language, onRead }: {
  collection: Collection; language: ReadingLanguage; onRead: (manga: Manga, chapter: Chapter) => void;
}) {
  const watched = Object.values(collection).filter(item => item.status === "reading" || item.favorite)
    .map(item => ({ item, language: readPosition(item.manga.id)?.feedLanguage || language }))
    .sort((a, b) => a.item.manga.id.localeCompare(b.item.manga.id));
  const watchKey = watched.map(({ item, language }) => `${item.manga.id}:${language}`).join(",");
  const [latest, setLatest] = useState<Record<string, Chapter | null>>({});
  const [dismissed, setDismissed] = useState(readDismissed);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const watchedRef = useRef(watched); watchedRef.current = watched;

  useEffect(() => {
    if (!watchKey) { setChecking(false); return; }
    const controller = new AbortController();
    setChecking(true); setError("");
    const queue = [...watchedRef.current];
    let failed = false;
    async function worker() {
      while (queue.length && !controller.signal.aborted) {
        const entry = queue.shift()!;
        const key = `${entry.item.manga.id}:${entry.language}`;
        try {
          const response = await fetch(`/api/manga/${entry.item.manga.id}/latest?language=${entry.language}`, { signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          if (!controller.signal.aborted) setLatest(current => ({ ...current, [key]: data.chapter }));
        } catch (e) { if (!controller.signal.aborted) failed = true; }
        // Keep background checks gentle on the public API.
        if (queue.length && !controller.signal.aborted) await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
          const timer = setTimeout(finish, 500);
          controller.signal.addEventListener("abort", finish, { once: true });
        });
      }
    }
    Promise.all([worker(), worker()]).then(() => {
      if (!controller.signal.aborted) {
        setChecking(false);
        if (failed) setError("Não foi possível verificar todas as obras. Tente novamente.");
      }
    });
    return () => controller.abort();
  }, [watchKey, tick]);

  const unread = watched.flatMap(({ item, language }) => {
    const key = `${item.manga.id}:${language}`, chapter = latest[key];
    return chapter && hasUnreadChapter(chapter.number, item.chapter, dismissed[key]) ? [{ item, language, chapter, key }] : [];
  });
  function dismiss(keys = unread) {
    const next = { ...dismissed };
    for (const entry of keys) next[entry.key] = Number(entry.chapter.number);
    try { localStorage.setItem(UPDATES_KEY, JSON.stringify(next)); setDismissed(next); }
    catch { setError("Não foi possível guardar os avisos dispensados neste navegador."); }
  }
  if (!watched.length) return null;
  return <section className={`updates-banner ${unread.length ? "has-updates" : "quiet"}`} aria-label="Avisos de capítulos">
    <div className="updates-heading">
      <Bell size={20} />
      <div><h2>{unread.length ? "Tem capítulo esperando por você" : checking ? "Conferindo suas histórias…" : error ? "Atualizações da sua biblioteca" : "Sua leitura está em dia"}</h2>
        {unread.length > 0 && <p>{unread.length} {unread.length === 1 ? "obra com leitura disponível" : "obras com leitura disponível"} · português e inglês</p>}
      </div>
      <button className="icon-button" aria-label="Verificar novos capítulos" title="Verificar novos capítulos" disabled={checking} onClick={() => setTick(tick + 1)}>
        {checking ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
      </button>
      {unread.length > 0 && <button className="icon-button" aria-label="Dispensar avisos de capítulos" title="Dispensar estes avisos" onClick={() => dismiss()}><X size={18} /></button>}
    </div>
    {error && <p className="error-copy" role="alert">{error}</p>}
    {unread.length > 0 && <div className="updates-list">
      {(expanded ? unread : unread.slice(0, 3)).map(entry => <article key={entry.key}>
        <div><strong>{entry.item.manga.title}</strong><span>Capítulo {entry.chapter.number} · {languageLabel(entry.language)}</span></div>
        <button className="text-link" aria-label={`Ler capítulo ${entry.chapter.number} de ${entry.item.manga.title}`} onClick={() => onRead(entry.item.manga, entry.chapter)}>Ler agora <ArrowRight size={15} /></button>
        <button className="icon-button" aria-label={`Dispensar aviso de ${entry.item.manga.title}`} onClick={() => dismiss([entry])}><Check size={16} /></button>
      </article>)}
      {unread.length > 3 && <button className="text-link" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostrar menos" : `Ver as ${unread.length} obras`}</button>}
    </div>}
  </section>;
}
