import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// Full-width photo hero. In Plasmic: change the words, the photo address and the two buttons.
export default function Hero({
  title = 'We are LKCMedSoc', tagline = '', image = '', primaryLabel = 'See events', primaryHref = '/events',
  secondaryLabel = 'Meet the team', secondaryHref = '/about', className = '',
}: {
  title?: string; tagline?: string; image?: string; primaryLabel?: string; primaryHref?: string;
  secondaryLabel?: string; secondaryHref?: string; className?: string;
}) {
  const words = title.split(' ');
  return (
    <section className={`relative isolate flex min-h-[86svh] items-end overflow-hidden bg-p900 text-white ${className}`}>
      <div className="kenburns absolute inset-0 -z-20"><SafeImage src={image} alt="" priority sizes="100vw" position="center 35%" className="h-full w-full" /></div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-p900/95 via-p900/55 to-p900/5" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-p900/70 via-p900/20 to-transparent" />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-40 md:pb-24">
        <h1 className="h-hero text-white">
          {words.map((w, i) => (
            <span key={i} className="mr-[.22em] inline-block overflow-hidden align-bottom"><span className="rise inline-block" style={{ ['--d' as string]: `${150 + i * 110}ms` }}>{w}</span></span>
          ))}
        </h1>
        {tagline ? <p className="rise mt-6 max-w-2xl text-lg text-p100 md:text-xl" style={{ ['--d' as string]: '650ms' }}>{tagline}</p> : null}
        <div className="rise mt-9 flex flex-wrap gap-3" style={{ ['--d' as string]: '800ms' }}>
          {primaryLabel ? <Link href={primaryHref} className="rounded-full bg-white px-7 py-3.5 font-bold text-p900 no-underline transition hover:bg-p100">{primaryLabel}</Link> : null}
          {secondaryLabel ? <Link href={secondaryHref} className="rounded-full border border-white/60 px-7 py-3.5 font-bold text-white no-underline transition hover:bg-white/10">{secondaryLabel}</Link> : null}
        </div>
      </div>
      <div aria-hidden className="nudge absolute bottom-6 right-6 hidden text-2xl text-white/70 md:block">↓</div>
    </section>
  );
}
