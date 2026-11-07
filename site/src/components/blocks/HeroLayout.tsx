import type { BandTone } from './Band';

// The hero as a layout you fill in yourself: a coloured band cut on the brand slant with two areas, words on one side and a picture
// on the other. Put your own text, buttons and photo in the areas; everything inside is yours to edit and move.
export default function HeroLayout({ children, media, tone = 'plum', order = 0, last = false, mediaSide = 'right', className = '' }: {
  children?: React.ReactNode; media?: React.ReactNode; tone?: BandTone; order?: number; last?: boolean; mediaSide?: 'left' | 'right'; className?: string;
}) {
  const flip = mediaSide === 'left';
  return (
    <section className={`band band-${tone}${last ? ' band-last' : ''} ${className}`} style={{ zIndex: 30 - order }}>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 lg:grid-cols-12 lg:gap-6">
        <div className={`lg:col-span-7 ${flip ? 'lg:order-2' : ''}`}>{children}</div>
        <div className={`lg:col-span-5 ${flip ? 'lg:order-1' : ''}`}>{media}</div>
      </div>
    </section>
  );
}
