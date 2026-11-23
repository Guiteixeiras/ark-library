import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { languageLabel } from "./reading";
import type { FeedLanguage } from "./reading";

type ExternalChapter = { number: string; title: string; host: string; url: string };
type ChapterAvailability = { known: number; readable: number; unavailable: number; english: number; external: ExternalChapter[] };
const PLATFORMS: Record<string, string> = {
  "br.comikey.com": "Comikey Brasil",
  "comikey.com": "Comikey",
  "mangaplus.shueisha.co.jp": "MANGA Plus",
  "www.webnovel.com": "Webnovel",
  "www.tappytoon.com": "Tappytoon",
  "www.pocketcomics.com": "Pocket Comics",
  "www.viz.com": "VIZ",
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Availability({ mangaId, language, onAddEnglish }: {
  mangaId: string; language: FeedLanguage; onAddEnglish: () => void;
}) {
  const [data, setData] = useState<ChapterAvailability | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    // Extra context only: the chapter list already reports its own failures.
    fetch(`/api/manga/${mangaId}/availability?language=${language}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mangaId, language]);
  if (!data || (!data.unavailable && !data.english && !data.external.length)) return null;
  const hosts = [...new Set(data.external.map(c => c.host))];
  return <aside className="availability" aria-label="Disponibilidade dos capítulos">
    {data.unavailable > 0 && <p>
      O MangaDex lista {plural(data.known, "capítulo", "capítulos")} em {languageLabel(language).toLowerCase()}, mas {data.unavailable} {data.unavailable === 1 ? "está indisponível" : "estão indisponíveis"} lá.
      Isso costuma acontecer quando a obra é licenciada e os capítulos são retirados. O ARK não contorna essa retirada.
    </p>}
    {data.english > 0 && <div>
      <p>{plural(data.english, "capítulo que falta em português pode ser lido", "capítulos que faltam em português podem ser lidos")} em inglês.</p>
      <button className="secondary-button" onClick={onAddEnglish}>Completar com inglês</button>
    </div>}
    {hosts.map(host => {
      const chapters = data.external.filter(c => c.host === host);
      return <details key={host}>
        <summary>Ler na plataforma · {PLATFORMS[host] || host} ({plural(chapters.length, "capítulo", "capítulos")})</summary>
        <ul>{chapters.map(c => <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer" title={c.title || undefined}>Cap. {c.number} <ExternalLink size={11} /></a></li>)}</ul>
      </details>;
    })}
  </aside>;
}
