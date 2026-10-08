import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { Collection, Manga } from "./types";
import type { ReadingLanguage } from "./reading";
type Suggestion = { manga: Manga; kind: "familiar" | "surprise"; reason: string };
export default function Recommendations({ collection, language, renderCard }: {
  collection: Collection; language: ReadingLanguage; renderCard: (manga: Manga) => ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [checking, setChecking] = useState(true);
  const [connectionReason, setConnectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef<AbortController | null>(null);
  const profile = Object.values(collection);
  const signature = `${language}:${profile.map(item => `${item.manga.id}:${item.status}:${item.favorite}`).sort().join(',')}`;
  useEffect(() => { generation.current?.abort(); setLoading(false); const own = new Set(profile.map(item => item.manga.id)); setItems(current => current.filter(item => !own.has(item.manga.id))); setError(""); return () => generation.current?.abort(); }, [signature]);
  useEffect(() => { generation.current?.abort(); setLoading(false); setItems([]); setMessage(""); setError(""); }, [language, model]);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true);
    fetch('/api/ark/status', { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; }).then(data => {
      if (controller.signal.aborted) return;
      setConnected(data.connected); setModels(data.models); setModel(data.defaultModel || "");
      setConnectionReason(data.reason || '');
    }).catch(e => { if (e.name !== "AbortError") setConnected(false); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [retry]);
  async function generate() {
    generation.current?.abort();
    const controller = new AbortController(); generation.current = controller;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch('/api/ark/recommendations', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language, model,
        items: profile.map(item => ({ id: item.manga.id, title: item.manga.title, tags: item.manga.tags, status: item.status, favorite: item.favorite })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) { setItems(data.items); setMessage(data.message || ""); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível gerar sugestões.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <section className="recommendations-section" id="ark-recommendations" aria-labelledby="recommendations-title">
    <div className="section-heading"><div><span className="eyebrow"><Sparkles size={13} /> ESCOLHIDAS PELO ARK</span><h2 id="recommendations-title">Seus gostos. Uma nova surpresa.</h2>
      <p>Sua IA usa a coleção e os favoritos para sugerir histórias próximas de você e uma escolha diferente.</p></div>
      {connected && models.length > 0 && <label className="ai-model">Sua IA<select aria-label="Modelo da IA" value={model} disabled={loading} onChange={e => setModel(e.target.value)}>{models.map(name => <option key={name}>{name}</option>)}</select></label>}
    </div>
    <div className="ai-connection">
      <span className={connected ? "connected" : ""}>{checking ? "Verificando sua IA…" : connected ? "Ollama conectado" : "Ollama desconectado"}</span>
      {!connected && !checking && <p>{connectionReason === 'hosted-local-ollama' ? 'Este ARK está hospedado no Render e não consegue acessar o Ollama instalado no seu PC. Para usar sua IA local, execute ambos no PC. Recomendações neste site precisam de uma conexão de IA configurada para a hospedagem.' : 'O servidor do ARK não conseguiu conectar ao Ollama. Para usar sua IA local, inicie o Ollama e execute o ARK no mesmo PC.'}</p>}
      {!checking && <button className="secondary-button" onClick={() => setRetry(retry + 1)}><RefreshCw size={15} /> Verificar conexão</button>}
      {connected && !models.length && <p>Instale um modelo no Ollama para começar.</p>}
      {connected && !profile.length && <p>Adicione suas primeiras obras à coleção para receber sugestões.</p>}
      <button className="primary-button" disabled={!connected || !model || !profile.length || loading} onClick={() => void generate()}>
        {loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{loading ? "ARK está escolhendo…" : items.length ? "Outras sugestões" : "Pedir sugestões ao ARK"}
      </button>
    </div>
    {error && <p className="error-copy" role="alert">{error}</p>}
    {message && <p className="form-notice" role="status">{message}</p>}
    {items.length > 0 && <div className="recommendations-grid">{items.map(item => <div key={item.manga.id} className="recommendation">
      <span className={`recommendation-kind ${item.kind}`}>{item.kind === "surprise" ? "Uma surpresa para você" : "Combina com sua coleção"}</span>
      {renderCard(item.manga)}<p>{item.reason}</p>
    </div>)}</div>}
  </section>;
}
