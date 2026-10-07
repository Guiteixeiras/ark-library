import { useEffect, useState } from 'react';
import { ArrowRight, Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import { languageLabel } from './reading';
import type { Personal } from './personal';
import type { Chapter, Collection, Manga } from './types';

export function ListMembership({ manga, personal, onSave, ensureSaved }: {
  manga: Manga; personal: Personal; onSave: (p: Personal) => boolean; ensureSaved: () => boolean;
}) {
  const [error, setError] = useState('');
  return <section className="list-membership" aria-label="Listas desta obra"><h3><ListPlus size={17} /> Suas listas</h3>
    {personal.lists.length ? <div className="list-chips">{personal.lists.map(list => {
      const included = list.mangaIds.includes(manga.id);
      return <button className={included ? 'selected' : ''} key={list.id} aria-pressed={included} onClick={() => {
        if (!included && !ensureSaved()) { setError('Não foi possível adicionar esta obra à coleção.'); return; }
        if (onSave({ ...personal, lists: personal.lists.map(l => l.id !== list.id ? l : { ...l, updatedAt: Date.now(),
          mangaIds: included ? l.mangaIds.filter(id => id !== manga.id) : [...l.mangaIds, manga.id] }) })) setError('');
        else setError('Não foi possível guardar a alteração nesta lista.');
      }}>{included && <Check size={13} />}{list.name}</button>;
    })}</div> : <p>Crie uma lista em Minha coleção para organizar esta história.</p>}
    {error && <p className="error-copy" role="alert">{error}</p>}
  </section>;
}
export function Lists({ personal, collection, active, onSelect, onSave }: {
  personal: Personal; collection: Collection; active: string; onSelect: (id: string) => void; onSave: (p: Personal) => boolean;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault(); const trimmed = name.trim();
    if (!trimmed || personal.lists.some(l => l.id !== editing && l.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError('Use um nome de lista diferente, com até 60 caracteres.'); return;
    }
    if (!editing && personal.lists.length >= 100) { setError('Você já tem 100 listas.'); return; }
    const id = editing || crypto.randomUUID();
    const next = editing ? personal.lists.map(l => l.id === editing ? { ...l, name: trimmed, updatedAt: Date.now() } : l) :
      [...personal.lists, { id, name: trimmed, mangaIds: [], updatedAt: Date.now() }];
    if (onSave({ ...personal, lists: next })) { setName(''); setEditing(null); setError(''); onSelect(id); }
  }
  return <section className="lists-panel" aria-labelledby="lists-title"><h3 id="lists-title"><ListPlus size={18} /> Suas listas</h3>
    <p>Uma história pode fazer parte de várias listas. Abra os detalhes para escolher.</p>
    <div className="list-chips"><button className={active === 'all' ? 'selected' : ''} onClick={() => onSelect('all')}>Toda a coleção</button>
      {personal.lists.map(list => <div className="list-chip-group" key={list.id}>
        <button className={active === list.id ? 'selected' : ''} onClick={() => onSelect(list.id)}>{list.name}<span>{list.mangaIds.filter(id => collection[id]).length}</span></button>
        <button className="icon-button" aria-label={`Renomear lista ${list.name}`} onClick={() => { setEditing(list.id); setName(list.name); setDeleting(null); setError(''); }}><Pencil size={13} /></button>
        <button className="icon-button" aria-label={`Excluir lista ${list.name}`} onClick={() => setDeleting(list.id)}><Trash2 size={13} /></button>
      </div>)}</div>
    <form className="list-form" onSubmit={submit}><input aria-label="Nome da lista" placeholder="Ex.: Treinar inglês" maxLength={60} value={name} onChange={e => setName(e.target.value)} />
      <button className="secondary-button" type="submit">{editing ? 'Salvar nome' : 'Criar lista'}</button>
      {editing && <button type="button" className="icon-button" aria-label="Cancelar renomeação" onClick={() => { setEditing(null); setName(''); }}><X size={16} /></button>}</form>
    {deleting && <div className="inline-confirm"><span>Excluir esta lista? As obras continuam na coleção.</span>
      <button className="text-link" onClick={() => { if (onSave({ ...personal, lists: personal.lists.filter(l => l.id !== deleting) })) { if (active === deleting) onSelect('all'); setDeleting(null); } }}>Excluir lista</button>
      <button className="text-link" onClick={() => setDeleting(null)}>Cancelar</button></div>}
    {error && <p className="error-copy" role="alert">{error}</p>}
  </section>;
}
export function History({ personal, query, onRead, onSave }: {
  personal: Personal; query: string; onRead: (manga: Manga, chapter: Chapter) => void; onSave: (p: Personal) => boolean;
}) {
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setPage(1), [query]);
  const rows = personal.history.filter(h => h.manga.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const actualPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));
  return <section className="history-panel" aria-labelledby="history-title"><div className="section-heading"><div><div className="eyebrow">SEUS ÚLTIMOS CAPÍTULOS</div><h2 id="history-title">Histórico de leitura<span className="heading-dot">.</span></h2><p>Capítulos abertos no leitor, com data e conclusão. Guardamos até 500 entradas neste navegador.</p></div>
    {!!personal.history.length && <button className="secondary-button" onClick={() => setConfirm(true)}><Trash2 size={14} /> Limpar histórico</button>}</div>
    {confirm && <div className="inline-confirm"><span>Limpar o histórico? Seu progresso e sua coleção continuam salvos.</span><button className="text-link" onClick={() => { if (onSave({ ...personal, history: [] })) setConfirm(false); }}>Limpar</button><button className="text-link" onClick={() => setConfirm(false)}>Cancelar</button></div>}
    <div className="history-list">{rows.slice((actualPage - 1) * 20, actualPage * 20).map(entry => <article key={`${entry.manga.id}:${entry.chapter.id}`}>
      <div><h3>{entry.manga.title}</h3><p>{entry.chapter.number !== null ? `Capítulo ${entry.chapter.number}` : entry.chapter.title || 'Especial'} · {languageLabel(entry.chapter.language)} · {entry.completed ? 'Concluído' : 'Aberto'}</p>
        <time dateTime={new Date(entry.readAt).toISOString()}>{new Date(entry.readAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
      <button className="text-link" onClick={() => onRead(entry.manga, entry.chapter)}>Reabrir <ArrowRight size={15} /></button></article>)}</div>
    {!rows.length && <p className="section-status">{query ? 'Nenhuma leitura com esse título.' : 'Seu histórico começa quando você abre um capítulo no ARK.'}</p>}
    {rows.length > 20 && <nav className="pagination" aria-label="Paginação do histórico"><button className="secondary-button" disabled={actualPage === 1} onClick={() => setPage(actualPage - 1)}>Anterior</button><span>Página {actualPage} de {Math.ceil(rows.length / 20)}</span><button className="secondary-button" disabled={actualPage * 20 >= rows.length} onClick={() => setPage(actualPage + 1)}>Próxima</button></nav>}
  </section>;
}
