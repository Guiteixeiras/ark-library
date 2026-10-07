import { useEffect, useState } from 'react';
import { ArrowRight, BookMarked, Clock3, LoaderCircle, RefreshCw } from 'lucide-react';
import { languageLabel } from './reading';
import type { ReadingLanguage } from './reading';
import type { Personal } from './personal';
import type { Chapter, Collection, Manga, Release } from './types';

function ReleaseCover({ manga }: { manga: Manga }) {
  const [failed, setFailed] = useState(false);
  return manga.cover && !failed ? <img loading="lazy" src={manga.cover} alt={`Capa de ${manga.title}`} onError={() => setFailed(true)} /> : <BookMarked size={24} aria-hidden="true" />;
}

export default function Releases({ language, collection, personal, onRead }: {
  language: ReadingLanguage; collection: Collection; personal: Personal; onRead: (manga: Manga, chapter: Chapter) => void;
}) {
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setItems([]); setExpanded(false);
    fetch(`/api/releases?language=${language}`, { signal: controller.signal }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
    }).then(d => { if (!controller.signal.aborted) { setItems(d.items); setTruncated(d.truncated); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [language, tick]);
  const filtered = items.filter(r => !onlySaved || !!collection[r.manga.id]);
  function isNew(release: Release) {
    const number = release.chapter.number;
    if (number !== null && /^\d+(?:\.\d+)?$/.test(number) && collection[release.manga.id]?.chapter &&
        Number(collection[release.manga.id].chapter) >= Number(number)) return false;
    return !personal.history.some(h => h.manga.id === release.manga.id && (h.chapter.id === release.chapter.id ||
      h.chapter.number !== null && h.chapter.number === number && (h.chapter.language === 'en') === (release.chapter.language === 'en')));
  }
  return <section className="releases-section" id="recent-releases" aria-labelledby="releases-title">
    <div className="section-heading"><div><div className="eyebrow">CHEGOU NA ESTANTE</div><h2 id="releases-title">Capítulos recém-publicados<span className="heading-dot">.</span></h2>
      <p>Traduções enviadas nos últimos 7 dias, entre as obras populares em destaque · {languageLabel(language)}.</p></div>
      <button className="icon-button" disabled={loading} onClick={() => setTick(tick + 1)} aria-label="Atualizar capítulos recém-publicados">
        {loading ? <LoaderCircle size={19} className="spin" /> : <RefreshCw size={19} />}</button></div>
    <div className="filter-tabs release-tabs" aria-label="Filtrar capítulos recentes">
      <button className={!onlySaved ? 'selected' : ''} aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>Destaques</button>
      <button className={onlySaved ? 'selected' : ''} aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>Salvos na coleção</button>
    </div>
    {loading ? <p className="section-status" role="status">Conferindo os envios recentes…</p> : error ? <p className="error-copy" role="alert">{error} Use o botão de atualizar para tentar novamente.</p> : filtered.length ?
      <div className="release-grid">{(expanded ? filtered : filtered.slice(0, 6)).map(release => <article className="release-card" key={release.key}>
        <button className="release-cover" onClick={() => onRead(release.manga, release.chapter)} aria-label={`Ler ${release.manga.title}, capítulo ${release.chapter.number ?? release.chapter.title}`}>
          <ReleaseCover manga={release.manga} /></button>
        <div><div className="release-labels">{isNew(release) ? <span className="new-badge">Novo</span> : <span className="release-opened">Já aberto / lido</span>}{collection[release.manga.id] && <span className="release-saved">Na coleção</span>}</div>
          <h3>{release.manga.title}</h3><p>{release.chapter.number !== null ? `Capítulo ${release.chapter.number}` : release.chapter.title || 'Especial'} · {languageLabel(release.chapter.language)}</p>
          <time dateTime={release.publishedAt}><Clock3 size={12} /> {new Date(release.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time>
          <button className="text-link" onClick={() => onRead(release.manga, release.chapter)}>Ler no ARK <ArrowRight size={14} /></button>
        </div></article>)}</div> : <p className="section-status">{onlySaved ? 'Nenhum envio recente dos destaques salvos na sua coleção. Os avisos acima acompanham suas outras obras.' : 'Nenhum capítulo disponível entre os destaques consultados nesta semana. Sua biblioteca continua disponível.'}</p>}
    {!loading && filtered.length > 6 && <button className="text-link releases-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Mostrar menos' : `Ver os ${filtered.length} capítulos`}</button>}
    {!loading && !error && truncated && <p className="pagination-hint">Mostrando os envios mais recentes; a lista pode não incluir todos os capítulos desta semana.</p>}
  </section>;
}
