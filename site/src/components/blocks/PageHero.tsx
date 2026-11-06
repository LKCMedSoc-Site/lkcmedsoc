import Link from 'next/link';

// Dark title band for inner pages, cut on the brand slant. Follow it with a <section className="band band-pale">.
export default function PageHero({ title, intro, back, children }: { title: string; intro?: string; back?: { label: string; href: string }; children?: React.ReactNode }) {
  return (
    <section className="band band-plum" style={{ zIndex: 30 }}>
      <div className="mx-auto max-w-6xl px-4">
        {back ? <Link href={back.href} className="mb-4 inline-block text-sm font-bold text-p300 no-underline hover:text-white">← {back.label}</Link> : null}
        <h1 className="hero-title max-w-4xl text-white !text-[clamp(3rem,9vw,7rem)]">{title}</h1>
        {intro ? <p className="mt-4 max-w-2xl text-lg text-mist md:text-xl">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
