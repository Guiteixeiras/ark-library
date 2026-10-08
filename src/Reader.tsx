import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Maximize, Minimize, PanelTopClose, PanelTopOpen, X } from "lucide-react";
import { canonicalChapter, chapterIndex, languageLabel, POSITION_KEY, readPosition, readReaderPreferences, READER_SETTINGS_KEY } from "./reading";
import type { ReaderPreferences } from "./reading";
import type { Chapter, Manga } from "./types";

function PageImage({ url, index, eager, onReady }: {
  url: string; index: number; eager: boolean;
  onReady: (index: number, ok: boolean, width?: number, height?: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <figure className="reader-page" data-page={index}>
    {failed ? <div className="reader-image-error" role="alert">
      <p>A página {index + 1} não carregou.</p>
      <button className="secondary-button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Tentar novamente</button>
    </div> : <img key={attempt} src={url} alt={`Página ${index + 1}`} loading={eager ? "eager" : "lazy"}
      onLoad={e => onReady(index, true, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      onError={() => { setFailed(true); onReady(index, false); }} />}
  </figure>;
}

export default function Reader({ manga, chapter, chapters, feedPage, feedLanguage, canPrevious, canNext, navigating, navigationError, onNavigate, onSelect, onClose, onComplete, onRead, onDetails }: {
  manga: Manga; chapter: Chapter; chapters: Chapter[]; feedPage: number; feedLanguage: string;
  canPrevious: boolean; canNext: boolean; navigating: boolean; navigationError: string;
  onNavigate: (direction: -1 | 1) => void; onSelect: (chapter: Chapter) => void;
  onClose: () => void; onComplete: (chapter: Chapter) => boolean; onRead: (chapter: Chapter) => void;
  onDetails: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const resume = useRef(readPosition(manga.id));
  const saved = resume.current?.chapter.id === chapter.id ? resume.current : null;
  const anchor = useRef<{ page: number; offset: number } | null>(saved && { page: saved.page, offset: saved.offset });
  const restoring = useRef(!!saved);
  const ready = useRef(new Map<number, boolean>());
  const visited = useRef(new Set<number>());
  const recorded = useRef(new Set<string>());
  const showControlsButton = useRef<HTMLButtonElement>(null);
  const hideControlsButton = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(chapter);
  const [prefs, setPrefs] = useState(readReaderPreferences);
  const [currentPage, setCurrentPage] = useState(saved?.page || 0);
  const [pages, setPages] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [done, setDone] = useState(saved?.completed === true);
  const [fullscreen, setFullscreen] = useState(false);
  const ownsFullscreen = useRef(false);
  const completed = useRef(saved?.completed === true);
  const persistFailure = useRef(false);
  const currentPageRef = useRef(currentPage); currentPageRef.current = currentPage;

  function visiblePosition() {
    const container = scroll.current;
    if (!container) return { page: currentPage, offset: 0 };
    const top = container.getBoundingClientRect().top;
    const figures = Array.from(container.querySelectorAll<HTMLElement>("[data-page]"));
    const figure = figures.find(f => f.getBoundingClientRect().bottom > top) || figures.at(-1);
    if (!figure) return { page: currentPage, offset: 0 };
    const rect = figure.getBoundingClientRect();
    return { page: Number(figure.dataset.page), offset: Math.max(0, Math.min(1, (top - rect.top) / Math.max(1, rect.height))) };
  }
  function persist() {
    if (!pages.length || restoring.current) return;
    try {
      localStorage.setItem(POSITION_KEY + manga.id, JSON.stringify({ chapter: canonicalChapter(active), feedPage, feedLanguage, completed: completed.current, ...visiblePosition() }));
    } catch {
      if (!persistFailure.current) setNotice("Não foi possível salvar sua posição neste navegador.");
      persistFailure.current = true;
    }
  }
  const persistRef = useRef(persist); persistRef.current = persist;
  useEffect(() => {
    document.documentElement.dataset.readerOpen = "true";
    dialog.current?.showModal();
    const timer = setInterval(() => persistRef.current(), 800);
    const flush = () => persistRef.current();
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener("pagehide", flush);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => { delete document.documentElement.dataset.readerOpen; clearInterval(timer); flush(); window.removeEventListener("pagehide", flush); document.removeEventListener("fullscreenchange", onFullscreen); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(""); setPages([]); ready.current.clear();
    async function load() {
      const choices = [chapter, ...(chapter.alternatives || []).slice(0, 8)];
      for (const [i, candidate] of choices.entries()) {
        const response = await fetch(`/api/chapter/${candidate.id}/pages?quality=${prefs.quality}`, { signal: controller.signal });
        const data = await response.json();
        if (response.ok) {
          if (controller.signal.aborted) return;
          if (candidate.id !== active.id) {
            anchor.current = null; restoring.current = false; setCurrentPage(0);
            setNotice("Abrimos uma tradução disponível deste capítulo.");
          }
          setActive(candidate);
          setPages(data.pages);
          setCurrentPage(page => Math.min(page, data.pages.length - 1));
          return;
        }
        if (response.status !== 404 || i === choices.length - 1) throw new Error(data.error);
      }
    }
    load().catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [chapter.id, prefs.quality, retry]);

  function applyAnchor() {
    const a = anchor.current, container = scroll.current;
    if (!a || !container || !pages.length) return;
    const page = Math.min(a.page, pages.length - 1);
    const figure = container.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!figure) return;
    container.scrollTop += figure.getBoundingClientRect().top - container.getBoundingClientRect().top + figure.offsetHeight * a.offset;
    const loaded = prefs.mode === "paged" ? ready.current.has(page) : Array.from({ length: page + 1 }, (_, i) => ready.current.has(i)).every(Boolean);
    if (loaded) { anchor.current = null; restoring.current = false; }
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (anchor.current) applyAnchor();
      else if (prefs.mode === "paged") scroll.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [pages, prefs.mode, prefs.width, prefs.size, prefs.controlsHidden, fullscreen, prefs.mode === "paged" ? currentPage : -1]);

  function markComplete() {
    if (completed.current || active.number === null) return;
    if (onComplete(active)) { completed.current = true; setDone(true); }
    else setNotice("O navegador não conseguiu salvar o capítulo lido. Libere espaço e tente novamente.");
  }
  function maybeComplete() {
    if (!pages.length || !scroll.current || !end.current || restoring.current) return;
    const allRead = prefs.mode === "vertical"
      ? ready.current.size === pages.length && [...ready.current.values()].every(Boolean)
      : currentPageRef.current === pages.length - 1 && visited.current.size === pages.length && ready.current.get(currentPageRef.current);
    const a = end.current.getBoundingClientRect(), b = scroll.current.getBoundingClientRect();
    if (allRead && a.top < b.bottom && a.bottom > b.top) markComplete();
  }
  const markRef = useRef(maybeComplete); markRef.current = maybeComplete;
  useEffect(() => {
    if (!pages.length || !end.current || !scroll.current) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) markRef.current(); }, { root: scroll.current, threshold: 0.5 });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [pages, prefs.mode, currentPage]);

  function pageReady(index: number, ok: boolean, width?: number, height?: number) {
    if (ok && !recorded.current.has(active.id)) { recorded.current.add(active.id); onRead(active); }
    ready.current.set(index, ok);
    if (ok && (prefs.mode === "vertical" || index === currentPageRef.current)) visited.current.add(index);
    if (ok && (index === currentPageRef.current || index === 0)) setDimensions(`${width} × ${height}`);
    applyAnchor();
    maybeComplete();
  }
  function changePreferences(patch: Partial<ReaderPreferences>) {
    const next = { ...prefs, ...patch };
    const position = visiblePosition();
    anchor.current = position; restoring.current = true;
    if (patch.mode === "paged" && prefs.mode !== "paged") { visited.current.clear(); if (ready.current.get(position.page)) visited.current.add(position.page); }
    setCurrentPage(position.page); setPrefs(next);
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(next)); }
    catch { setNotice("A preferência foi aplicada, mas não pôde ser salva neste navegador."); }
  }
  function goPage(page: number) {
    persist(); anchor.current = null; restoring.current = false;
    setCurrentPage(Math.max(0, Math.min(pages.length - 1, page)));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); ownsFullscreen.current = true; changePreferences({ controlsHidden: true }); }
    } catch { setNotice("A tela cheia não está disponível neste navegador."); }
  }
  function close() {
    persist();
    if (document.fullscreenElement && ownsFullscreen.current) void document.exitFullscreen().catch(() => {});
    onClose();
  }
  function showDetails() {
    persist();
    if (document.fullscreenElement && ownsFullscreen.current) void document.exitFullscreen().catch(() => {});
    onDetails();
  }
  function toggleControls() {
    const hidden = !prefs.controlsHidden;
    changePreferences({ controlsHidden: hidden });
    requestAnimationFrame(() => (hidden ? showControlsButton.current : hideControlsButton.current)?.focus({ preventScroll: true }));
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input, select, textarea") || target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (prefs.mode === "paged" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault(); goPage(e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : currentPage + (e.key === "ArrowRight" ? 1 : -1));
      } else if (e.key.toLowerCase() === "f") { e.preventDefault(); void toggleFullscreen(); }
      else if (e.key.toLowerCase() === "m") { e.preventDefault(); changePreferences({ mode: prefs.mode === "vertical" ? "paged" : "vertical" }); }
      else if (e.key.toLowerCase() === "h") { e.preventDefault(); toggleControls(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [prefs, currentPage, pages.length]);

  const selectedIndex = chapterIndex(chapters, chapter);
  const atLast = prefs.mode === "vertical" || currentPage === pages.length - 1;
  return createPortal(<dialog ref={dialog} className="reader-dialog" aria-labelledby="reader-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header id="reader-toolbar" className="reader-toolbar" hidden={!!prefs.controlsHidden}>
      <div className="reader-heading"><span>ARK · SUA LEITURA</span><h2 id="reader-title">{manga.title}</h2>
        <small>Cap. {active.number ?? "especial"} · Tradução: {active.group} · {languageLabel(active.language)}</small></div>
      <button className="secondary-button reader-work-button" onClick={showDetails}><BookOpen size={16} /> Ver obra</button>
      <button ref={hideControlsButton} className="icon-button" aria-label="Recolher controles" title="Recolher controles (H)" aria-controls="reader-toolbar" aria-expanded="true" onClick={toggleControls}><PanelTopClose size={20} /></button>
      <button className="icon-button" aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} title="Tela cheia (F)" onClick={() => void toggleFullscreen()}>
        {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>
      <button className="icon-button" aria-label="Fechar leitor" onClick={close}><X size={22} /></button>
      <div className="reader-controls">
        <button className="secondary-button" aria-label="Capítulo anterior" disabled={!canPrevious || navigating} onClick={() => { persist(); onNavigate(-1); }}><ChevronLeft size={16} /> Anterior</button>
        <select aria-label="Capítulo no leitor" value={selectedIndex >= 0 ? chapters[selectedIndex].id : ""} disabled={navigating} onChange={e => { const c = chapters.find(c => c.id === e.target.value); if (c) { persist(); onSelect(c); } }}>
          {selectedIndex < 0 && <option value="">Cap. {chapter.number ?? "especial"}</option>}
          {chapters.map(c => <option key={c.id} value={c.id}>Cap. {c.number ?? "especial"}{c.title ? ` — ${c.title}` : ""}</option>)}
        </select>
        <button className="secondary-button" aria-label="Próximo capítulo" disabled={!canNext || navigating} onClick={() => { persist(); onNavigate(1); }}>Próximo <ChevronRight size={16} /></button>
      </div>
      {navigationError && <p role="alert" className="error-copy">{navigationError}</p>}
      <div className="reader-settings">
        <label>Leitura<select aria-label="Modo de leitura" value={prefs.mode} onChange={e => changePreferences({ mode: e.target.value as ReaderPreferences["mode"] })}><option value="vertical">Vertical</option><option value="paged">Página por página</option></select></label>
        <label>Qualidade<select aria-label="Qualidade das imagens" value={prefs.quality} onChange={e => changePreferences({ quality: e.target.value as ReaderPreferences["quality"] })}><option value="original">Original · máxima qualidade</option><option value="compressed">Econômica · menos dados</option></select></label>
        <label>Imagem<select aria-label="Tamanho das imagens" value={prefs.size} onChange={e => changePreferences({ size: e.target.value as ReaderPreferences["size"] })}><option value="fit">Largura personalizada</option><option value="screen">Ocupar a tela</option><option value="native">Tamanho real</option></select></label>
        <label className="reader-width">Largura<input aria-label="Largura da leitura" type="range" min="420" max="1100" step="20" value={prefs.width} disabled={prefs.size !== "fit"} onChange={e => changePreferences({ width: Number(e.target.value) })} /></label>
      </div>
      <div className="reader-page-controls">
        {prefs.mode === "paged" && <button className="icon-button" aria-label="Página anterior do capítulo" disabled={currentPage === 0 || !pages.length} onClick={() => goPage(currentPage - 1)}><ChevronLeft size={18} /></button>}
        <span aria-live="polite">{pages.length ? `Página ${currentPage + 1} de ${pages.length}` : "Carregando páginas"}</span>
        {prefs.mode === "paged" && <button className="icon-button" aria-label="Próxima página do capítulo" disabled={currentPage === pages.length - 1 || !pages.length} onClick={() => goPage(currentPage + 1)}><ChevronRight size={18} /></button>}
        {dimensions && <small>{dimensions} px · {prefs.quality === "original" ? "Original" : "Econômica"}</small>}
        <details className="reader-shortcuts"><summary>Atalhos</summary><p>F: tela cheia · H: mostrar/recolher controles · M: modo de leitura · ← e →: páginas no modo paginado.</p></details>
      </div>
    </header>
    {prefs.controlsHidden && <button ref={showControlsButton} className="reader-controls-handle" aria-label="Mostrar controles" aria-controls="reader-toolbar" aria-expanded="false" title="Mostrar controles (H)" onClick={toggleControls}><PanelTopOpen size={17} /> Controles</button>}
    {prefs.controlsHidden && (navigationError || notice) && <p className="reader-floating-notice" role="status">{navigationError || notice}</p>}
    <div ref={scroll} className="reader-scroll" onScroll={() => {
      if (!restoring.current && prefs.mode === "vertical") setCurrentPage(visiblePosition().page);
      maybeComplete();
    }} onKeyDown={e => { if (["PageDown", "PageUp", "ArrowUp", "ArrowDown", " ", "Home", "End"].includes(e.key)) { anchor.current = null; restoring.current = false; } }} onWheel={() => { anchor.current = null; restoring.current = false; }} onTouchStart={() => { anchor.current = null; restoring.current = false; }}
      tabIndex={0} aria-label="Páginas do capítulo">
      {notice && <p className="reader-notice" role="status">{notice}</p>}
      {error ? <div className="reader-message" role="alert"><p>{error}</p><button className="primary-button" onClick={() => setRetry(retry + 1)}>Tentar novamente</button></div> : !pages.length ? <p className="reader-message"><LoaderCircle className="spin" size={22} /> Carregando capítulo…</p> : <>
        <div className={`reader-pages ${prefs.size === "native" ? "native-size" : prefs.size === "screen" ? "screen-size" : ""}`} style={{ maxWidth: prefs.size === "fit" ? prefs.width : undefined }}>
          {pages.map((url, i) => (prefs.mode === "vertical" || i === currentPage) && <PageImage key={`${retry}:${url}`} url={url} index={i}
            eager={prefs.mode === "paged" || i === 0 || i <= (anchor.current?.page ?? -1)} onReady={pageReady} />)}
        </div>
        {atLast && <div ref={end} className="reader-end">
          <h3>{done ? "Capítulo lido ✓" : "Fim do capítulo"}</h3>
          <p>Tradução: {active.group}. Imagens e distribuição: MangaDex.</p>
          <button className="primary-button" onClick={markComplete} disabled={done || active.number === null}><CheckCheck size={17} /> {done ? "Progresso salvo" : "Marcar como lido"}</button>
          {canNext && <button className="secondary-button" disabled={navigating} onClick={() => { persist(); onNavigate(1); }}>Próximo capítulo <ChevronRight size={16} /></button>}
          <a className="text-link" href={active.url} target="_blank" rel="noopener noreferrer">Fonte e créditos no MangaDex <ExternalLink size={14} /></a>
          <button className="text-link" onClick={showDetails}><BookOpen size={15} /> Ver obra e capítulos</button>
        </div>}
      </>}
    </div>
  </dialog>, document.body);
}
