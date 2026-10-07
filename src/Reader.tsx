import { useEffect, useRef, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, X } from "lucide-react";
import type { Chapter, Manga } from "./types";

const POSITION_KEY = "ark-library:reader:v1:";
type Position = { chapter: Chapter; feedLanguage: string; feedPage: number; page: number; offset: number };
export function readPosition(mangaId: string): Position | null {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY + mangaId) || "null");
    if (!value || !/^[a-f\d-]{36}$/i.test(value.chapter?.id) ||
        !/^[a-z]{2,3}(?:-[a-z0-9]+)?$/i.test(value.chapter.language) ||
        !Number.isInteger(value.page) || value.page < 0 || value.page > 1000 ||
        !Number.isInteger(value.feedPage) || value.feedPage < 1 || value.feedPage > 250 ||
        !Number.isFinite(value.offset) || value.offset < 0 || value.offset > 1) return null;
    return { ...value, feedLanguage: ["pt-br", "en", "es", "all"].includes(value.feedLanguage) ? value.feedLanguage : (["pt-br", "en", "es"].includes(value.chapter.language) ? value.chapter.language : "all"), chapter: { ...value.chapter, url: `https://mangadex.org/chapter/${value.chapter.id}` } };
  } catch { return null; }
}

function PageImage({ url, index, eager, onReady }: {
  url: string; index: number; eager: boolean; onReady: (index: number, ok: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <figure className="reader-page" data-page={index}>
    {failed ? <div className="reader-image-error" role="alert">
      <p>A página {index + 1} não carregou.</p>
      <button className="secondary-button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Tentar novamente</button>
    </div> : <img key={attempt} src={url} alt={`Página ${index + 1}`} loading={eager ? "eager" : "lazy"}
      onLoad={() => onReady(index, true)} onError={() => { setFailed(true); onReady(index, false); }} />}
  </figure>;
}

export default function Reader({ manga, chapter, chapters, feedPage, feedLanguage, canPrevious, canNext, navigating, onNavigate, onSelect, onClose, onComplete }: {
  manga: Manga; chapter: Chapter; chapters: Chapter[]; feedPage: number; feedLanguage: string;
  canPrevious: boolean; canNext: boolean; navigating: boolean;
  onNavigate: (direction: -1 | 1) => void; onSelect: (chapter: Chapter) => void;
  onClose: () => void; onComplete: () => boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const resume = useRef(readPosition(manga.id));
  const restoring = useRef(resume.current?.chapter.id === chapter.id);
  const target = restoring.current ? resume.current : null;
  const ready = useRef(new Map<number, boolean>());
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [done, setDone] = useState(false);
  const completed = useRef(false);
  const persistFailure = useRef(false);
  const [width, setWidth] = useState(() => {
    try { const n = Number(localStorage.getItem("ark-library:reader-width:v1")); return n >= 420 && n <= 1100 ? n : 780; }
    catch { return 780; }
  });

  function persist() {
    const container = scroll.current;
    if (!container || !pages.length || restoring.current) return;
    const top = container.getBoundingClientRect().top;
    const figures = Array.from(container.querySelectorAll<HTMLElement>("[data-page]"));
    const figure = figures.find(f => f.getBoundingClientRect().bottom > top) || figures.at(-1);
    if (!figure) return;
    const rect = figure.getBoundingClientRect();
    try {
      localStorage.setItem(POSITION_KEY + manga.id, JSON.stringify({ chapter, feedPage, feedLanguage,
        page: Number(figure.dataset.page), offset: Math.max(0, Math.min(1, (top - rect.top) / rect.height)) }));
    } catch {
      if (!persistFailure.current) setNotice("Não foi possível salvar sua posição neste navegador.");
      persistFailure.current = true;
    }
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    dialog.current?.showModal();
    const timer = setInterval(() => persistRef.current(), 800);
    const flush = () => persistRef.current();
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(timer); flush(); window.removeEventListener("pagehide", flush); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(""); setPages([]); ready.current.clear();
    fetch(`/api/chapter/${chapter.id}/pages`, { signal: controller.signal }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
    }).then(d => { if (!controller.signal.aborted) setPages(d.pages); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [chapter.id, retry]);

  function markComplete() {
    if (completed.current) return;
    if (onComplete()) { completed.current = true; setDone(true); }
    else setNotice("O navegador não conseguiu salvar o capítulo lido. Libere espaço e tente novamente.");
  }
  const markRef = useRef(markComplete); markRef.current = markComplete;
  useEffect(() => {
    if (!pages.length || !end.current || !scroll.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && ready.current.size === pages.length &&
          [...ready.current.values()].every(Boolean)) markRef.current();
    }, { root: scroll.current, threshold: 0.5 });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [pages]);

  function pageReady(index: number, ok: boolean) {
    ready.current.set(index, ok);
    if (restoring.current && target && pages.length) {
      const page = Math.min(target.page, pages.length - 1);
      const figure = scroll.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
      if (figure && scroll.current) {
        scroll.current.scrollTop += figure.getBoundingClientRect().top - scroll.current.getBoundingClientRect().top + figure.offsetHeight * target.offset;
        if (Array.from({ length: page + 1 }, (_, i) => ready.current.has(i)).every(Boolean)) {
          restoring.current = false;
          setNotice(`Leitura retomada na página ${page + 1}.`);
        }
      }
    }
    if (end.current && scroll.current && ready.current.size === pages.length && [...ready.current.values()].every(Boolean)) {
      const a = end.current.getBoundingClientRect(), b = scroll.current.getBoundingClientRect();
      if (a.top < b.bottom && a.bottom > b.top) markRef.current();
    }
  }
  function interruptRestore() { restoring.current = false; }
  function close() { persist(); onClose(); }
  return <dialog ref={dialog} className="reader-dialog" aria-labelledby="reader-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header className="reader-toolbar">
      <div className="reader-heading"><span>ARK · LEITOR</span><h2 id="reader-title">{manga.title}</h2><small>Cap. {chapter.number || "especial"} · {chapter.group} · {chapter.language}</small></div>
      <button className="icon-button" aria-label="Fechar leitor" onClick={close}><X size={22} /></button>
      <div className="reader-controls">
        <button className="secondary-button" aria-label="Capítulo anterior" disabled={!canPrevious || navigating} onClick={() => { persist(); onNavigate(-1); }}><ChevronLeft size={16} /> Anterior</button>
        <select aria-label="Capítulo no leitor" value={chapters.some(c => c.id === chapter.id) ? chapter.id : ""} disabled={navigating} onChange={e => { const c = chapters.find(c => c.id === e.target.value); if (c) { persist(); onSelect(c); } }}>
          {!chapters.some(c => c.id === chapter.id) && <option value="">Cap. {chapter.number || "especial"}</option>}
          {chapters.map(c => <option key={c.id} value={c.id}>Cap. {c.number || "especial"} · {c.group}</option>)}
        </select>
        <button className="secondary-button" aria-label="Próximo capítulo" disabled={!canNext || navigating} onClick={() => { persist(); onNavigate(1); }}>Próximo <ChevronRight size={16} /></button>
        <label className="reader-width">Largura <input aria-label="Largura da leitura" type="range" min="420" max="1100" step="20" value={width} onChange={e => {
          setWidth(Number(e.target.value)); try { localStorage.setItem("ark-library:reader-width:v1", e.target.value); } catch { setNotice("Não foi possível guardar a largura da leitura."); }
        }} /></label>
      </div>
    </header>
    <div ref={scroll} className="reader-scroll" onWheel={interruptRestore} onTouchStart={interruptRestore} onKeyDown={interruptRestore} tabIndex={0} aria-label="Páginas do capítulo">
      {notice && <p className="reader-notice" role="status">{notice}</p>}
      {error ? <div className="reader-message" role="alert"><p>{error}</p><button className="primary-button" onClick={() => setRetry(retry + 1)}>Tentar novamente</button></div> : !pages.length ? <p className="reader-message"><LoaderCircle className="spin" size={22} /> Carregando capítulo…</p> : <>
        <div className="reader-pages" style={{ maxWidth: width }}>
          {pages.map((url, i) => <PageImage key={`${retry}:${url}`} url={url} index={i} eager={i === 0 || !!target && i <= target.page} onReady={pageReady} />)}
        </div>
        <div ref={end} className="reader-end">
          <h3>{done ? "Capítulo lido ✓" : "Fim do capítulo"}</h3>
          <p>Tradução: {chapter.group}. Imagens e distribuição: MangaDex.</p>
          <button className="primary-button" onClick={markComplete} disabled={done || !chapter.number}><CheckCheck size={17} /> {done ? "Progresso salvo" : "Marcar como lido"}</button>
          {canNext && <button className="secondary-button" disabled={navigating} onClick={() => { persist(); onNavigate(1); }}>Próximo capítulo <ChevronRight size={16} /></button>}
          <a className="text-link" href={chapter.url} target="_blank" rel="noopener noreferrer">Fonte e créditos no MangaDex <ExternalLink size={14} /></a>
        </div>
      </>}
    </div>
  </dialog>;
}
