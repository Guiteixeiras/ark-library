import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookMarked,
  Bookmark,
  Check,
  CheckCheck,
  ChevronRight,
  ChevronLeft,
  Compass,
  ExternalLink,
  Download,
  Heart,
  Library,
  LoaderCircle,
  Moon,
  Search,
  Sparkles,
  Sun,
  Upload,
  History as HistoryIcon,
  Clock3,
  X,
} from "lucide-react";
import {
  MAX_BACKUP_BYTES,
  newItem,
  readCollection,
  STORAGE_KEY,
} from "./library";
import { GENRES, LANGUAGES, PAGE_SIZE } from "./catalog";
import Reader from "./Reader";
import Updates from "./Updates";
import Recommendations from "./Recommendations";
import Releases from "./Releases";
import { History, Lists, ListMembership } from "./PersonalLibrary";
import { createFullBackup, parseFullBackup, PERSONAL_KEY, readPersonal, recordReading, restoreFullBackup } from "./personal";
import type { FullBackup, Personal } from "./personal";
import { chapterIndex, LANGUAGE_KEY, preferredLanguage as readLanguage, readPosition } from "./reading";
import type {
  Chapter,
  Collection,
  CollectionItem,
  Manga,
  ReadingStatus,
} from "./types";

const statusLabels: Record<ReadingStatus, string> = {
  planned: "Quero ler",
  reading: "Lendo",
  completed: "Concluído",
};
const publication: Record<string, string> = {
  ongoing: "Em publicação",
  completed: "Finalizado",
  hiatus: "Em pausa",
  cancelled: "Cancelado",
};
type View = "discover" | "collection" | "favorites" | "history";
const orderLabels: Record<string, string> = {
  popular: "Mais populares",
  rating: "Melhor avaliados",
  latest: "Atualizações recentes",
  title: "Título A–Z",
  relevance: "Relevância",
};

function Cover({
  manga,
  className = "",
}: {
  manga: Manga;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [manga.cover]);
  return (
    <div className={`cover ${className}`}>
      {manga.cover && !failed ? (
        <img
          src={manga.cover}
          alt={`Capa de ${manga.title}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-placeholder">
          <BookMarked size={34} strokeWidth={1.2} />
          <span>{manga.title}</span>
        </div>
      )}
    </div>
  );
}

function MangaCard({
  manga,
  saved,
  onOpen,
  onSave,
}: {
  manga: Manga;
  saved?: CollectionItem;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className="manga-card">
      <div className="card-art">
        <button
          className="cover-open"
          onClick={onOpen}
          aria-label={`Ver ${manga.title}`}
        >
          <Cover manga={manga} />
        </button>
        <span className="kind-badge">{manga.kind}</span>
        <button
          className={`save-cover ${saved ? "saved" : ""}`}
          onClick={onSave}
          aria-label={`${saved ? "Remover" : "Adicionar"} ${manga.title} ${saved ? "da" : "à"} coleção`}
          title={saved ? "Remover da coleção" : "Adicionar à coleção"}
        >
          {saved ? <Check size={17} /> : <Bookmark size={17} />}
        </button>
      </div>
      <button className="card-title" onClick={onOpen}>
        {manga.title}
      </button>
      <div className="card-meta">
        <span>
          {saved
            ? statusLabels[saved.status]
            : manga.tags[0] || publication[manga.status] || "Mangá"}
        </span>
        {saved?.chapter && <span>Cap. {saved.chapter}</span>}
        {!saved && manga.year && <span>{manga.year}</span>}
      </div>
      {!saved && manga.rating !== undefined && <div className="card-rating">★ {manga.rating.toFixed(1)} <span>· {new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(manga.followers || 0)} seguidores</span></div>}
    </article>
  );
}

function Details({
  manga,
  item,
  onClose,
  onUpdate,
  onRemove,
  preferredLanguage,
  startReading,
  requestedChapter,
  personal,
  onPersonalSave,
  onHistory,
}: {
  manga: Manga;
  item?: CollectionItem;
  onClose: () => void;
  onUpdate: (patch: Partial<CollectionItem>) => boolean;
  onRemove: () => void;
  preferredLanguage: string;
  startReading: boolean;
  requestedChapter: Chapter | null;
  personal: Personal;
  onPersonalSave: (p: Personal) => boolean;
  onHistory: (chapter: Chapter, completed?: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapter, setChapter] = useState(item?.chapter || "");
  const [notice, setNotice] = useState("");
  const initialPosition = useRef(startReading && !requestedChapter ? readPosition(manga.id) : null);
  const [chapterPage, setChapterPage] = useState(initialPosition.current?.feedPage || 1);
  const [fetchTick, setFetchTick] = useState(0);
  const [navigationError, setNavigationError] = useState("");
  const pendingStart = useRef(startReading || !!requestedChapter);
  const desiredChapter = useRef(requestedChapter || (!initialPosition.current?.completed ? initialPosition.current?.chapter : null) || null);
  const locator = useRef<Record<string, string>>(desiredChapter.current ? { chapterId: desiredChapter.current.id, ...(desiredChapter.current.number !== null ? { chapterNumber: desiredChapter.current.number } : {}) } : startReading && item?.chapter ? { after: item.chapter } : {});
  const [chapterTotal, setChapterTotal] = useState(0);
  const [reading, setReading] = useState<Chapter | null>(null);
  const [readingPage, setReadingPage] = useState(1);
  const pendingNavigation = useRef<-1 | 1 | null>(null);
  const resume = readPosition(manga.id);
  const [chapterLanguage, setChapterLanguage] = useState(
    requestedChapter ? (requestedChapter.language === "en" ? "en" : "pt-br") : initialPosition.current?.feedLanguage || (preferredLanguage === "en" ? "en" : "pt-br"),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ language: chapterLanguage, page: String(chapterPage), ...locator.current });
    fetch(`/api/manga/${manga.id}/chapters?${params}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        setChapters(d.items);
        setChapterTotal(d.total);
        locator.current = {};
        if (d.page !== chapterPage) setChapterPage(d.page);
        if (pendingStart.current) {
          pendingStart.current = false;
          const primary = d.items.find((c: Chapter) => c.id === d.startId) || (!desiredChapter.current ? d.items[0] : null);
          if (!primary && desiredChapter.current) setError("Este capítulo não está mais disponível. Escolha outro da lista.");
          if (primary) {
            const wanted = desiredChapter.current;
            const oldVersion = primary.alternatives?.find((c: Chapter) => c.id === wanted?.id);
            const { alternatives, ...defaultVersion } = primary;
            const chosen = oldVersion ? { ...oldVersion, alternatives: [defaultVersion, ...alternatives.filter((c: Chapter) => c.id !== oldVersion.id)] } : primary;
            setReadingPage(d.page); setReading(chosen); onUpdate({ status: "reading" });
          }
        }
        if (pendingNavigation.current) {
          const next = pendingNavigation.current === 1 ? d.items[0] : d.items.at(-1);
          if (next) { setReadingPage(d.page); setReading(next); }
          pendingNavigation.current = null;
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          if (pendingNavigation.current) { pendingNavigation.current = null; setNavigationError(e.message); setChapterPage(readingPage); }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [manga.id, chapterLanguage, chapterPage, fetchTick]);
  const readingIndex = chapterIndex(chapters, reading);
  const canPrevious = readingIndex > 0 || chapterPage > 1;
  const canNext = readingIndex >= 0 && readingIndex < chapters.length - 1 || chapterPage * 40 < Math.min(chapterTotal, 10000);
  function openChapter(c: Chapter, page = chapterPage) {
    setNavigationError("");
    onUpdate({ status: "reading" });
    setReadingPage(page);
    setReading(c);
  }
  function navigateChapter(direction: -1 | 1) {
    setNavigationError("");
    const next = chapters[readingIndex + direction];
    if (readingIndex >= 0 && next) openChapter(next);
    else {
      pendingNavigation.current = direction;
      setChapterPage(chapterPage + direction);
    }
  }
  return (
    <>
    <dialog
      ref={dialog}
      className="detail-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-labelledby="detail-title"
    >
      <div className="dialog-inner">
        <button
          className="dialog-close icon-button"
          onClick={onClose}
          aria-label="Fechar detalhes"
        >
          <X size={21} />
        </button>
        <div className="detail-intro">
          <Cover manga={manga} />
          <div>
            <div className="eyebrow">
              {manga.kind} <span>·</span>{" "}
              {publication[manga.status] || "MangaDex"}
            </div>
            <h2 id="detail-title">{manga.title}</h2>
            <div className="detail-tags">
              {manga.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="detail-actions">
              <button
                className="primary-button"
                onClick={() => {
                  if (item) onRemove();
                  else onUpdate({});
                }}
              >
                {item ? <Check size={17} /> : <Bookmark size={17} />}
                {item ? "Na sua coleção · remover" : "Adicionar à coleção"}
              </button>
              <button
                className={`icon-button favorite-button ${item?.favorite ? "active" : ""}`}
                aria-label={
                  item?.favorite ? "Remover dos favoritos" : "Favoritar"
                }
                onClick={() => onUpdate({ favorite: !item?.favorite })}
              >
                <Heart
                  size={20}
                  fill={item?.favorite ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>
        </div>
        <p className="synopsis">
          {manga.description ||
            "Esta obra ainda não tem uma sinopse disponível."}
        </p>
        <section className="progress-panel" aria-labelledby="progress-title">
          <h3 id="progress-title">
            <BookMarked size={17} /> Sua leitura
          </h3>
          <div className="progress-fields">
            <label>
              Status
              <select
                aria-label="Status"
                value={item?.status || "planned"}
                onChange={(e) =>
                  onUpdate({ status: e.target.value as ReadingStatus })
                }
              >
                {Object.entries(statusLabels).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\d+(?:\.\d+)?$/.test(chapter.trim())) {
                  setNotice("Informe um capítulo válido, como 12 ou 12.5.");
                  return;
                }
                onUpdate({ chapter: chapter.trim(), status: "reading" });
                setNotice(`Progresso salvo: capítulo ${chapter.trim()}.`);
              }}
            >
              <label>
                Último capítulo
                <input
                  aria-label="Último capítulo"
                  inputMode="decimal"
                  value={chapter}
                  onChange={(e) => {
                    setChapter(e.target.value);
                    setNotice("");
                  }}
                  placeholder="Ex.: 12"
                  maxLength={12}
                />
              </label>
              <button className="secondary-button" type="submit">
                Salvar
              </button>
            </form>
          </div>
          <p className="form-notice" role="status">
            {notice}
          </p>
        </section>
        <ListMembership manga={manga} personal={personal} onSave={onPersonalSave} ensureSaved={() => !!item || onUpdate({})} />
        <section className="chapter-section">
          <div className="section-heading">
            <h3>Capítulos disponíveis</h3>
            <span>
              Leitura no ARK <BookMarked size={13} />
            </span>
          </div>
          <label className="chapter-language">
            Idioma da leitura
            <select
              aria-label="Idioma da leitura"
              value={chapterLanguage}
              onChange={(e) => { setChapterLanguage(e.target.value === "en" ? "en" : "pt-br"); setChapterPage(1); }}
            >
              {LANGUAGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {resume && <button className="primary-button resume-button" onClick={() => {
            setChapterLanguage(resume.feedLanguage);
            setChapterPage(resume.feedPage);
            desiredChapter.current = resume.chapter;
            locator.current = { chapterId: resume.chapter.id, ...(resume.chapter.number !== null ? { chapterNumber: resume.chapter.number } : {}) };
            pendingStart.current = true;
            setFetchTick(fetchTick + 1);
          }}>Retomar leitura · Cap. {resume.chapter.number || "especial"}</button>}
          {loading ? (
            <p className="muted loading-inline">
              <LoaderCircle className="spin" size={16} /> Buscando capítulos…
            </p>
          ) : error ? (
            <p role="alert" className="error-copy">
              {error}
            </p>
          ) : chapters.length ? (
            <ul className="chapter-list">
              {chapters.map((c) => (
                <li key={c.id}>
                  <button className="chapter-open" onClick={() => openChapter(c)} aria-label={`Ler capítulo ${c.number || "especial"} no ARK`}>
                    <span>
                      Cap. {c.number || "especial"} {c.title && `— ${c.title}`}
                    </span>
                    <small>{c.group}</small>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Marcar capítulo ${c.number || "especial"} como lido`}
                    disabled={!c.number}
                    onClick={() => {
                      if (c.number) {
                        setChapter(c.number);
                        onUpdate({ chapter: c.number, status: "reading" });
                        setNotice(`Progresso salvo: capítulo ${c.number}.`);
                      }
                    }}
                  >
                    <CheckCheck size={17} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Nenhum capítulo disponível nesse idioma para esta obra.
            </p>
          )}
          {chapterTotal > 40 && <div className="pagination-controls chapter-pagination">
            <button className="secondary-button" disabled={loading || chapterPage === 1} onClick={() => setChapterPage(chapterPage - 1)}>Capítulos anteriores</button>
            <span>Página {chapterPage} de {Math.ceil(Math.min(chapterTotal, 10000) / 40)}</span>
            <button className="secondary-button" disabled={loading || chapterPage * 40 >= Math.min(chapterTotal, 10000)} onClick={() => setChapterPage(chapterPage + 1)}>Mais capítulos</button>
          </div>}
          <a
            className="text-link"
            href={manga.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver todos os capítulos no MangaDex <ArrowRight size={15} />
          </a>
        </section>
        <p className="dialog-footnote">
          Dados e capas: MangaDex. Traduções pertencem aos grupos indicados em
          cada capítulo.
        </p>
      </div>
    </dialog>
    {reading && <Reader key={reading.id} manga={manga} chapter={reading} chapters={chapters}
      feedPage={readingPage} feedLanguage={chapterLanguage} canPrevious={canPrevious} canNext={canNext} navigating={loading} navigationError={navigationError}
      onNavigate={navigateChapter} onSelect={openChapter} onClose={() => { pendingNavigation.current = null; setReading(null); if (startReading || requestedChapter) onClose(); }}
      onRead={chapter => onHistory(chapter)}
      onComplete={active => {
        if (!active.number || !/^\d+(?:\.\d+)?$/.test(active.number)) return false;
        const latest = Number(item?.chapter || 0) > Number(active.number) ? item!.chapter : active.number;
        const saved = onUpdate({ chapter: latest, status: "reading" });
        if (saved) { setChapter(latest); onHistory(active, true); }
        return saved;
      }} />}
    </>
  );
}

function BackupPreview({
  incoming,
  current,
  error,
  onClose,
  onRestore,
  workspace,
}: {
  incoming: Collection;
  current: Collection;
  error: string;
  onClose: () => void;
  onRestore: () => void;
  workspace?: FullBackup['workspace'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const entries = Object.entries(incoming);
  const added = entries.filter(([id]) => !current[id]).length;
  const updated = entries.filter(
    ([id, item]) => current[id] && item.updatedAt > current[id].updatedAt,
  ).length;
  return (
    <dialog
      ref={dialog}
      className="detail-dialog backup-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-labelledby="backup-title"
    >
      <div className="dialog-inner">
        <button
          className="dialog-close icon-button"
          aria-label="Fechar importação"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">SUA ESTANTE, EM QUALQUER LUGAR</span>
        <h2 id="backup-title">Restaurar sua coleção</h2>
        <p>
          O arquivo foi validado. Confira o que será combinado com sua
          biblioteca:
        </p>
        <div className="backup-summary">
          <div>
            <strong>{added}</strong>
            <span>novas obras</span>
          </div>
          <div>
            <strong>{updated}</strong>
            <span>atualizações</span>
          </div>
          <div>
            <strong>{entries.length - added - updated}</strong>
            <span>já atualizadas</span>
          </div>
        </div>
        <p>
          Nenhuma obra atual será removida. Para obras repetidas, os dados mais
          recentes serão mantidos.
        </p>
        {workspace && <p>Também serão combinadas {workspace.personal.lists.length} listas e {workspace.personal.history.length} entradas de histórico. Tema, idioma e controles do leitor serão restaurados; posições mais recentes neste navegador serão preservadas.</p>}
        {error && (
          <p role="alert" className="error-copy">
            {error}
          </p>
        )}
        <div className="backup-buttons">
          <button className="secondary-button" onClick={onClose}>
            Cancelar importação
          </button>
          <button className="primary-button" onClick={onRestore}>
            <Upload size={16} /> Importar e combinar
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function App() {
  const [view, setView] = useState<View>("discover");
  const [collection, setCollection] = useState<Collection>(readCollection);
  const [personal, setPersonal] = useState(readPersonal);
  const personalRef = useRef(personal); personalRef.current = personal;
  const [activeList, setActiveList] = useState('all');
  const [scope, setScope] = useState('featured');
  const [storageError, setStorageError] = useState("");
  const [items, setItems] = useState<Manga[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [filter, setFilter] = useState("all");
  const [genre, setGenre] = useState("all");
  const [publicationFilter, setPublicationFilter] = useState("all");
  const [readingLanguage, setReadingLanguage] = useState(readLanguage);
  const [language, setLanguage] = useState<string>(readingLanguage);
  const [sort, setSort] = useState("popular");
  const [localSort, setLocalSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [backupPreview, setBackupPreview] = useState<FullBackup | null>(null);
  const [backupNotice, setBackupNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Manga | null>(null);
  const [directReading, setDirectReading] = useState(false);
  const [requestedChapter, setRequestedChapter] = useState<Chapter | null>(null);
  const collectionRef = useRef(collection); collectionRef.current = collection;
  function openDetails(manga: Manga, direct = false, chapter: Chapter | null = null) {
    setDirectReading(direct); setRequestedChapter(chapter); setSelected(manga);
  }
  const catalog = useRef<HTMLElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1a151f" : "#f5f1f8");
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("ark-library:theme:v1", next);
    } catch {
      setBackupNotice({
        type: "error",
        text: "O tema foi aplicado, mas o navegador não conseguiu guardar sua preferência.",
      });
    }
  }

  function exportCollection() {
    try {
    const url = URL.createObjectURL(
      new Blob([createFullBackup(collection, personal, localStorage, theme)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ark-library-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupNotice({
      type: "success",
      text: "Backup exportado com coleção, listas, histórico, posições e preferências.",
    });
    } catch (error) { setBackupNotice({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível preparar seu backup.' }); }
  }

  async function importCollection(file?: File) {
    if (!file) return;
    setBackupNotice(null);
    setStorageError("");
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("O backup deve ter no máximo 10 MB.");
      setBackupPreview(parseFullBackup(await file.text()));
    } catch (e) {
      setBackupNotice({
        type: "error",
        text:
          e instanceof Error ? e.message : "Não foi possível ler esse arquivo.",
      });
    }
  }

  useEffect(() => {
    if (view !== "discover") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      query: search,
      kind,
      genre,
      status: publicationFilter,
      language,
      sort,
      page: String(page),
      scope: search ? 'all' : scope,
    });
    fetch(`/api/catalog?${params}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        setItems(d.items);
        setTotal(d.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    view,
    search,
    kind,
    genre,
    publicationFilter,
    language,
    sort,
    page,
    retry,
    scope,
  ]);

  function save(next: Collection) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError("");
      collectionRef.current = next;
      setCollection(next);
      return true;
    } catch {
      setStorageError(
        "O navegador não conseguiu salvar sua coleção. Libere espaço ou permita o armazenamento e tente novamente.",
      );
      return false;
    }
  }
  function savePersonal(next: Personal) {
    try { localStorage.setItem(PERSONAL_KEY, JSON.stringify(next)); personalRef.current = next; setPersonal(next); setStorageError(''); return true; }
    catch { setStorageError('Não foi possível salvar suas listas ou o histórico. Libere espaço e tente novamente.'); return false; }
  }
  function addHistory(manga: Manga, chapter: Chapter, completed = false) {
    savePersonal(recordReading(personalRef.current, manga, chapter, completed));
  }
  function update(manga: Manga, patch: Partial<CollectionItem> = {}) {
    return save({
      ...collectionRef.current,
      [manga.id]: {
        ...(collectionRef.current[manga.id] || newItem(manga)),
        ...patch,
        manga,
        updatedAt: Date.now(),
      },
    });
  }
  function remove(id: string) {
    const next = { ...collection };
    delete next[id];
    save(next);
  }
  function navigate(next: View) {
    setView(next);
    setQuery("");
    setFilter("all");
    setSearch("");
    setGenre("all");
    setPublicationFilter("all");
    setLanguage(next === "discover" ? readingLanguage : "all");
    setSort("popular");
    setLocalSort("updated");
    setKind("all");
    setPage(1);
    setActiveList('all');
  }

  const saved = useMemo(
    () => Object.values(collection).sort((a, b) => b.updatedAt - a.updatedAt),
    [collection],
  );
  const reading = saved.filter((i) => i.status === "reading");
  const favorites = saved.filter((i) => i.favorite);
  const localItems = (view === "favorites" ? favorites : saved)
    .filter(i => activeList === 'all' || personal.lists.find(l => l.id === activeList)?.mangaIds.includes(i.manga.id))
    .filter((i) => filter === "all" || i.status === filter)
    .filter((i) =>
      i.manga.title
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
    )
    .filter(
      (i) =>
        genre === "all" ||
        i.manga.tags.includes(GENRES.find((g) => g.id === genre)?.name || ""),
    )
    .filter(
      (i) =>
        publicationFilter === "all" || i.manga.status === publicationFilter,
    )
    .filter((i) => language === "all" || i.manga.languages.includes(language) || language === "pt-br" && i.manga.languages.includes("pt"))
    .sort((a, b) =>
      localSort === "title"
        ? a.manga.title.localeCompare(b.manga.title, "pt-BR")
        : localSort === "chapter"
          ? Number(b.chapter || 0) - Number(a.chapter || 0) ||
            b.updatedAt - a.updatedAt
          : b.updatedAt - a.updatedAt,
    )
    .map((i) => i.manga);
  const displayedTotal = view === "discover" ? total : localItems.length;
  const pageCount = Math.max(
    1,
    Math.ceil(
      (view === "discover" ? Math.min(total, 10000) : localItems.length) /
        PAGE_SIZE,
    ),
  );
  const visible =
    view === "discover"
      ? items
      : localItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters =
    !!query ||
    !!search ||
    filter !== "all" ||
    genre !== "all" ||
    publicationFilter !== "all" ||
    language !== (view === "discover" ? readingLanguage : "all") ||
    kind !== "all" || activeList !== 'all';
  useEffect(() => {
    if (view !== "discover" && page > pageCount) setPage(pageCount);
  }, [view, page, pageCount]);
  const heroManga = items[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("discover");
          }}
          aria-label="ARK Library, início"
        >
          <span className="brand-mark">
            A<span>✦</span>
          </span>
          <span>
            ark<span className="brand-library">library</span>
          </span>
        </a>
        <div className="sidebar-caption">SEU UNIVERSO DE HISTÓRIAS</div>
        <nav aria-label="Navegação principal">
          <button
            className={view === "discover" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("discover")}
          >
            <Compass size={19} /> Explorar <ChevronRight size={15} />
          </button>
          <button
            className={view === "collection" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("collection")}
          >
            <Library size={19} /> Minha coleção <span>{saved.length}</span>
          </button>
          <button
            className={view === "favorites" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("favorites")}
          >
            <Heart size={19} /> Favoritos <span>{favorites.length}</span>
          </button>
          <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('history')}><HistoryIcon size={19} /> Histórico <span>{personal.history.length}</span></button>
          <button className="nav-item" onClick={() => { navigate('discover'); setTimeout(() => document.getElementById('recent-releases')?.scrollIntoView({ behavior: 'smooth' }), 0); }}><Clock3 size={19} /> Capítulos novos <ChevronRight size={15} /></button>
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-caption">UM CAPÍTULO DE CADA VEZ</div>
        <div className="reading-summary">
          <span className="reading-dot" />
          <span>
            {reading.length
              ? `${reading.length} ${reading.length === 1 ? "história em andamento" : "histórias em andamento"}`
              : "Sua próxima história espera"}
          </span>
        </div>
        <button className="ark-note" onClick={() => { navigate("discover"); setTimeout(() => document.getElementById("ark-recommendations")?.scrollIntoView({ behavior: "smooth" }), 0); }}>
          <div className="ark-note-title">
            <Sparkles size={17} /> Sugestões do ARK
          </div>
          <p>Um assistente para descobrir histórias que combinam com você.</p>
          <span className="soon-badge">SUA IA LOCAL</span>
        </button>
        <div className="sidebar-bottom">
          <div className="local-avatar">GU</div>
          <div>
            <strong>Seu espaço de leitura</strong>
            <span>Biblioteca salva neste navegador</span>
          </div>
          <span className="status-dot" />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Biblioteca <ChevronRight size={13} />{" "}
            <strong>
              {view === "discover"
                ? "Explorar"
                : view === "collection"
                  ? "Minha coleção"
                  : view === 'favorites' ? "Favoritos" : "Histórico"}
            </strong>
          </div>
          <form
            className="search-box"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (view === "discover") {
                setSearch(query.trim());
                setPage(1);
                setSort(query.trim() ? "relevance" : "popular");
                catalog.current?.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            <Search size={17} />
            <input
              aria-label="Buscar mangás"
              placeholder="Buscar uma nova história…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (view !== "discover") setPage(1);
              }}
              maxLength={120}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                aria-label="Limpar busca"
                onClick={() => {
                  setQuery("");
                  setSearch("");
                  setPage(1);
                  setSort("popular");
                }}
              >
                <X size={15} />
              </button>
            )}
            <button className="search-submit" aria-label="Buscar" type="submit">
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="topbar-label">
            <span className="status-dot" /> Seu cantinho de leitura
          </div>
          <button
            className="theme-toggle icon-button"
            aria-label={
              theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
            }
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </header>
        <div className="main-content">
          {storageError && <div className="error-state" role="alert">{storageError}</div>}
          <Updates collection={collection} language={readingLanguage} onRead={(manga, chapter) => openDetails(manga, true, chapter)} />
          {view === 'history' && <History personal={personal} query={query} onRead={(manga, chapter) => openDetails(manga, true, chapter)} onSave={savePersonal} />}
          {view === "discover" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="hero-label">
                    <span /> HISTÓRIAS PARA FICAR MAIS UM CAPÍTULO
                  </div>
                  <h1>
                    Um novo universo.
                    <br />
                    Sua próxima <em>leitura.</em>
                  </h1>
                  <p>
                    Mangás, manhwas e histórias que ficam com você.
                    <br className="desktop-break" /> Descubra, organize e siga
                    no seu próprio ritmo.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() =>
                      catalog.current?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Encontrar minha próxima história <ArrowRight size={17} />
                  </button>
                  <div className="hero-bottom">
                    <span className="tiny-star">✦</span>
                    <span>Seu progresso. Suas histórias. Seu ARK.</span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbital orbital-one" />
                  <div className="orbital orbital-two" />
                  <span className="art-spark spark-one">✦</span>
                  <span className="art-spark spark-two">+</span>
                  <span className="art-label">UM MUNDO EM CADA PÁGINA</span>
                  {heroManga ? (
                    <div className="hero-book">
                      <Cover manga={heroManga} />
                      <div className="hero-book-caption">
                        <span>NA ESTANTE DO ARK</span>
                        <strong>{heroManga.title}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="hero-book book-empty">
                      <BookMarked size={70} strokeWidth={1} />
                      <span>
                        Todo universo
                        <br />
                        começa com uma história.
                      </span>
                    </div>
                  )}
                  <div className="floating-note">
                    <BookMarked size={17} />
                    <span>
                      O próximo capítulo
                      <br />
                      <strong>pode surpreender você.</strong>
                    </span>
                  </div>
                </div>
              </section>
              <section className="stats-strip" aria-label="Sua biblioteca">
                <div>
                  <Library size={21} />
                  <span>
                    <strong>{saved.length}</strong> na sua coleção
                  </span>
                </div>
                <div>
                  <BookMarked size={21} />
                  <span>
                    <strong>{reading.length}</strong> em leitura
                  </span>
                </div>
                <div>
                  <CheckCheck size={21} />
                  <span>
                    <strong>
                      {saved.filter((i) => i.status === "completed").length}
                    </strong>{" "}
                    concluídos
                  </span>
                </div>
                <div className="stats-message">
                  Cada história tem seu tempo. <span>Aproveite o seu.</span>
                </div>
              </section>
              {reading.length > 0 && (
                <section className="continue-section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">DE VOLTA À SUA HISTÓRIA</span>
                      <h2>Continue de onde parou</h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => navigate("collection")}
                    >
                      Ver coleção <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="continue-grid">
                    {reading.slice(0, 3).map((i) => (
                      <button
                        key={i.manga.id}
                        className="continue-card"
                        onClick={() => openDetails(i.manga, true)}
                      >
                        <Cover manga={i.manga} />
                        <div>
                          <span>{i.manga.kind}</span>
                          <strong>{i.manga.title}</strong>
                          <small>
                            {i.chapter
                              ? readPosition(i.manga.id)?.completed ? `Continuar após o capítulo ${i.chapter}` : `Continuar · Capítulo ${readPosition(i.manga.id)?.chapter.number ?? i.chapter}`
                              : "Pronto para começar"}
                          </small>
                        </div>
                        <ArrowRight size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {view === 'discover' && <Releases language={readingLanguage} collection={collection} personal={personal} onRead={(manga, chapter) => openDetails(manga, true, chapter)} />}
          {view === "discover" && <Recommendations collection={collection} language={readingLanguage} renderCard={manga => <MangaCard manga={manga} saved={collection[manga.id]} onOpen={() => openDetails(manga)} onSave={() => collection[manga.id] ? remove(manga.id) : update(manga)} />} />}
          {view !== 'history' && <>
          <section className="catalog-section" ref={catalog}>
            <div className="section-heading catalog-heading">
              <div>
                <div className="eyebrow">
                  {view === "discover"
                    ? "O QUE VEM DEPOIS?"
                    : "HISTÓRIAS QUE VOCÊ ESCOLHEU"}
                </div>
                <h2>
                  {view === "discover"
                    ? search
                      ? `Resultados para “${search}”`
                      : scope === 'featured' ? 'Populares e bem avaliados' : "Encontre sua próxima obsessão"
                    : view === "collection"
                      ? "Minha coleção"
                      : "Seus favoritos"}
                  <span className="heading-dot">.</span>
                </h2>
                <p>
                  {view === "discover"
                    ? !search && scope === 'featured' ? `Até 100 obras mais acompanhadas em ${language === 'en' ? 'inglês' : 'português'}, com nota mínima 7 e mil seguidores no MangaDex.` : `Uma seleção do MangaDex, com capítulos em ${language === "en" ? "inglês" : "português"}.`
                    : "Um espaço para cada história que faz parte do seu universo."}
                </p>
              </div>
              {view === "discover" && !loading && !error && (
                <span className="result-count">
                  {total.toLocaleString("pt-BR")} {scope === 'featured' && !search ? 'obras em destaque' : 'histórias no catálogo'}{" "}
                  <ArrowDown size={13} />
                </span>
              )}
              {view !== "discover" && (
                <div className="library-actions">
                  <button
                    className="secondary-button"
                    onClick={exportCollection}
                    disabled={!saved.length}
                  >
                    <Download size={15} /> Exportar coleção
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => backupInput.current?.click()}
                  >
                    <Upload size={15} /> Importar backup
                  </button>
                </div>
              )}
            </div>
            <input
              ref={backupInput}
              type="file"
              accept="application/json,.json"
              aria-label="Arquivo de backup"
              hidden
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void importCollection(file);
              }}
            />
            {backupNotice && (
              <div
                className={`backup-notice ${backupNotice.type}`}
                role={backupNotice.type === "error" ? "alert" : "status"}
              >
                {backupNotice.text}
                <button
                  className="icon-button"
                  aria-label="Fechar aviso"
                  onClick={() => setBackupNotice(null)}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {view !== 'discover' && <Lists personal={personal} collection={collection} active={activeList} onSelect={id => { setActiveList(id); setPage(1); }} onSave={savePersonal} />}
            {view === 'discover' && !search && <div className="filter-tabs discovery-tabs" aria-label="Seleção do catálogo"><button className={scope === 'featured' ? 'selected' : ''} aria-pressed={scope === 'featured'} onClick={() => { setScope('featured'); setSort('popular'); setPage(1); }}>Destaques conhecidos</button><button className={scope === 'all' ? 'selected' : ''} aria-pressed={scope === 'all'} onClick={() => { setScope('all'); setPage(1); }}>Catálogo completo</button></div>}
            <div className="catalog-toolbar">
              <div
                className="filter-tabs"
                aria-label={
                  view === "discover" ? "Tipo de obra" : "Status de leitura"
                }
              >
                {(view === "discover"
                  ? [
                      ["all", "Todos"],
                      ["manga", "Mangás"],
                      ["manhwa", "Manhwas"],
                      ["manhua", "Manhuas"],
                    ]
                  : [
                      ["all", "Todos"],
                      ["reading", "Lendo"],
                      ["planned", "Quero ler"],
                      ["completed", "Concluídos"],
                    ]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={
                      (view === "discover" ? kind : filter) === value
                        ? "selected"
                        : ""
                    }
                    aria-pressed={
                      (view === "discover" ? kind : filter) === value
                    }
                    onClick={() => {
                      setPage(1);
                      view === "discover" ? setKind(value) : setFilter(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="catalog-language">
                {view === "discover"
                  ? `${language === "all" ? "Toda a coleção" : language === "en" ? "Inglês" : "Português"} · ${orderLabels[sort]}`
                  : `${displayedTotal} ${displayedTotal === 1 ? "obra" : "obras"}`}
              </span>
            </div>
            <div className="filter-controls">
              <label>
                Gênero
                <select
                  aria-label="Gênero"
                  value={genre}
                  onChange={(e) => {
                    setGenre(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos os gêneros</option>
                  {GENRES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Publicação
                <select
                  aria-label="Publicação"
                  value={publicationFilter}
                  onChange={(e) => {
                    setPublicationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(publication).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Idioma dos capítulos
                <select
                  aria-label="Idioma dos capítulos"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    if (e.target.value === "pt-br" || e.target.value === "en") {
                      setReadingLanguage(e.target.value);
                      try { localStorage.setItem(LANGUAGE_KEY, e.target.value); }
                      catch { setBackupNotice({ type: "error", text: "Não foi possível guardar sua preferência de idioma." }); }
                    }
                    setPage(1);
                  }}
                >
                  {view !== "discover" && <option value="all">Toda a coleção</option>}
                  {LANGUAGES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ordenar por
                <select
                  aria-label="Ordenar por"
                  value={view === "discover" ? sort : localSort}
                  onChange={(e) => {
                    view === "discover"
                      ? setSort(e.target.value)
                      : setLocalSort(e.target.value);
                    setPage(1);
                  }}
                >
                  {view === "discover" ? (
                    <>
                      <option value="popular">Mais populares</option>
                      <option value="rating">Melhor avaliados</option>
                      {(scope === 'all' || search) && <option value="latest">Atualizações recentes</option>}
                      <option value="title">Título A–Z</option>
                      {search && <option value="relevance">Relevância</option>}
                    </>
                  ) : (
                    <>
                      <option value="updated">Atualizados recentemente</option>
                      <option value="title">Título A–Z</option>
                      <option value="chapter">Capítulo mais avançado</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            {hasFilters && (
              <button
                className="text-link clear-filters"
                onClick={() => navigate(view)}
              >
                <X size={12} /> Limpar filtros
              </button>
            )}
            {view === "discover" && loading ? (
              <div
                className="manga-grid skeleton-grid"
                aria-label="Carregando catálogo"
                aria-busy="true"
              >
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton-card">
                    <div />
                    <span />
                    <small />
                  </div>
                ))}
              </div>
            ) : view === "discover" && error ? (
              <div className="empty-state" role="alert">
                <Compass size={36} />
                <h3>Uma pausa no próximo capítulo</h3>
                <p>{error}</p>
                <button
                  className="primary-button"
                  onClick={() => setRetry(retry + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : visible.length ? (
              <div className="manga-grid">
                {visible.map((m) => (
                  <MangaCard
                    key={m.id}
                    manga={m}
                    saved={collection[m.id]}
                    onOpen={() => openDetails(m)}
                    onSave={() => (collection[m.id] ? remove(m.id) : update(m))}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookMarked size={40} strokeWidth={1.3} />
                <h3>
                  {view === "discover"
                    ? "Essa história ainda não apareceu"
                    : hasFilters
                      ? "Nenhuma obra com esse filtro"
                      : "Sua estante está esperando"}
                </h3>
                <p>
                  {view === "discover"
                    ? "Tente outro título ou ajuste os filtros de gênero e idioma."
                    : hasFilters
                      ? "Experimente outro título ou status de leitura."
                      : "Explore o catálogo e salve as histórias que chamarem sua atenção."}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    navigate(hasFilters ? view : "discover");
                  }}
                >
                  {hasFilters ? "Limpar filtros" : "Explorar histórias"}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {displayedTotal > 0 &&
              !(view === "discover" && (loading || error)) && (
                <nav className="pagination" aria-label="Paginação do catálogo">
                  <span>
                    Mostrando {(page - 1) * PAGE_SIZE + 1}–
                    {(page - 1) * PAGE_SIZE + visible.length} de{" "}
                    {displayedTotal.toLocaleString("pt-BR")}
                  </span>
                  <div>
                    <button
                      className="secondary-button"
                      aria-label="Página anterior"
                      disabled={page === 1}
                      onClick={() => {
                        setPage(page - 1);
                        catalog.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      <ChevronLeft size={15} /> Anterior
                    </button>
                    <span aria-live="polite">
                      Página {page} de {pageCount}
                    </span>
                    <button
                      className="secondary-button"
                      aria-label="Próxima página"
                      disabled={page >= pageCount}
                      onClick={() => {
                        setPage(page + 1);
                        catalog.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Próxima <ChevronRight size={15} />
                    </button>
                  </div>
                </nav>
              )}
            {view === "discover" && total > 10000 && (
              <p className="pagination-hint">
                Refine a busca com os filtros para explorar mais histórias.
              </p>
            )}
          </section>
          </>}
          <section className="nexus-note">
            <div className="nexus-icon">
              <Bookmark size={23} />
            </div>
            <div>
              <h3>Sua biblioteca, conectada.</h3>
              <p>
                A integração com Nexus está planejada para trazer suas listas e
                sincronizar cada capítulo.
              </p>
            </div>
            <span className="soon-badge">PRÓXIMO CAPÍTULO</span>
          </section>
          <footer>
            <div>
              <span className="footer-brand">ark library</span>
              <span>Feito para quem sempre lê mais um capítulo.</span>
            </div>
            <a
              href="https://mangadex.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Catálogo e capas por MangaDex <ExternalLink size={13} />
            </a>
          </footer>
        </div>
      </main>
      {selected && (
        <Details
          key={selected.id}
          manga={selected}
          item={collection[selected.id]}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => update(selected, patch)}
          onRemove={() => remove(selected.id)}
          preferredLanguage={language === "all" ? readingLanguage : language}
          startReading={directReading}
          requestedChapter={requestedChapter}
          personal={personal}
          onPersonalSave={savePersonal}
          onHistory={(chapter, completed) => addHistory(selected, chapter, completed)}
        />
      )}
      {backupPreview && (
        <BackupPreview
          incoming={backupPreview.collection}
          workspace={backupPreview.workspace}
          current={collection}
          error={storageError}
          onClose={() => setBackupPreview(null)}
          onRestore={() => {
            const count = Object.keys(backupPreview.collection).length;
            try {
              const restored = restoreFullBackup(collectionRef.current, personalRef.current, backupPreview);
              collectionRef.current = restored.collection; setCollection(restored.collection);
              personalRef.current = restored.personal; setPersonal(restored.personal); setStorageError('');
              if (restored.workspace) { setTheme(restored.workspace.theme); setReadingLanguage(restored.workspace.language); }
              setBackupPreview(null);
              navigate("collection");
              setBackupNotice({
                type: "success",
                text: `Backup importado: ${count} ${count === 1 ? "obra verificada" : "obras verificadas"}. Sua coleção foi combinada mantendo os dados mais recentes.`,
              });
            } catch (error) { setStorageError(error instanceof Error ? error.message : 'Não foi possível restaurar o backup.'); }
          }}
        />
      )}
    </div>
  );
}
