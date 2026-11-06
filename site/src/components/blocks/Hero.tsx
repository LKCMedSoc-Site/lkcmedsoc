import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// Plum hero: giant name on the left, one photo cut on the brand slant on the right.
// In Plasmic: change the words, the photo address and the two buttons.
export default function Hero({
  title = 'We are LKCMedSoc', tagline = '', image = '', primaryLabel = 'See events', primaryHref = '/events',
  secondaryLabel = 'Meet the team', secondaryHref = '/about/meet-the-team', className = '',
}: {
  title?: string; tagline?: string; image?: string; primaryLabel?: string; primaryHref?: string;
  secondaryLabel?: string; secondaryHref?: string; className?: string;
}) {
  const [first, ...rest] = title.split(' ');
  const lead = title.toLowerCase().startsWith('we are') ? 'We are' : first;
  const name = title.toLowerCase().startsWith('we are') ? title.slice(6).trim() : rest.join(' ');
  return (
    <section className={`band band-plum relative z-[30] ${className}`}>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <h1 className="hero-title text-white">
            <span className="rise block text-p300" style={{ ['--d' as string]: '100ms' }}>{lead}</span>
            <span className="rise block" style={{ ['--d' as string]: '220ms' }}>{name || title}</span>
          </h1>
          {tagline ? <p className="rise mt-5 max-w-xl text-lg text-mist md:mt-8 md:text-xl" style={{ ['--d' as string]: '450ms' }}>{tagline}</p> : null}
          <div className="rise mt-6 flex flex-wrap gap-3 md:mt-9" style={{ ['--d' as string]: '600ms' }}>
            {primaryLabel ? <Link href={primaryHref} className="press rounded-full bg-pink px-7 py-3.5 font-bold text-p900 no-underline hover:bg-white">{primaryLabel}</Link> : null}
            {secondaryLabel ? <Link href={secondaryHref} className="press rounded-full border border-p300/60 px-7 py-3.5 font-bold text-white no-underline hover:bg-white/10">{secondaryLabel}</Link> : null}
          </div>
        </div>
        <div className="slab lg:col-span-5"><div className="zoom slant">
          <SafeImage src={image} alt="" priority sizes="(min-width: 1024px) 40vw, 100vw" position="center 30%" className="aspect-[5/4] w-full lg:aspect-[4/5]" />
        </div></div>
      </div>
    </section>
  );
}
