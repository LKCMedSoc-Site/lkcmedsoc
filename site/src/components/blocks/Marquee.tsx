// A slow scrolling strip of words, separated by a small cross. In Plasmic: type the words, separated by commas.
export default function Marquee({ words = 'Service, Events, Academic, Community, Houses, Leadership', className = '' }: { words?: string; className?: string }) {
  const list = words.split(',').map((w) => w.trim()).filter(Boolean);
  const row = (k: string) => list.map((w, i) => (
    <span key={k + i} className="display flex items-center gap-8 pr-8 text-4xl text-p900 md:text-6xl">
      {w}
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-p300 md:h-6 md:w-6"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor" /></svg>
    </span>
  ));
  return (
    <div className={`marquee overflow-hidden border-y border-line bg-p50 py-5 ${className}`} aria-label={list.join(', ')}>
      <div className="marquee-track flex w-max" aria-hidden>{row('a')}{row('b')}</div>
    </div>
  );
}
