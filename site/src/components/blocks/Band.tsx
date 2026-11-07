// One coloured band of the page, cut on the brand slant. Put bands one after another, each with a Stack order one higher than the band above it
// (0 for the first), so each band tucks neatly under the cut of the one before. The last band on the page can tick "Last section", and the footer tucks under it.
export type BandTone = 'plum' | 'grape' | 'magenta' | 'pale' | 'grey' | 'mist' | 'pink';

export default function Band({ children, tone = 'pale', order = 0, last = false, contained = true, className = '' }: {
  children?: React.ReactNode; tone?: BandTone; order?: number; last?: boolean; contained?: boolean; className?: string;
}) {
  return (
    <section className={`band band-${tone}${last ? ' band-last' : ''} ${className}`} style={{ zIndex: 30 - order }}>
      {contained ? <div className="mx-auto max-w-6xl px-4">{children}</div> : children}
    </section>
  );
}
