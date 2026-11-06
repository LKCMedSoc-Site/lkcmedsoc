// A slow scrolling strip of words. In Plasmic: type the words, separated by commas.
export default function Marquee({ words = 'Service, Events, Academic, Community, Houses, Leadership', className = '' }: { words?: string; className?: string }) {
  const list = words.split(',').map((w) => w.trim()).filter(Boolean);
  const row = (k: string) => list.map((w, i) => (
    <span key={k + i} className="display flex items-center gap-8 pr-8 text-4xl text-p700 md:text-6xl">{w}<span aria-hidden className="text-p300">✦</span></span>
  ));
  return (
    <div className={`marquee overflow-hidden border-y border-line bg-p50 py-5 ${className}`} aria-label={list.join(', ')}>
      <div className="marquee-track flex w-max" aria-hidden>{row('a')}{row('b')}</div>
    </div>
  );
}
