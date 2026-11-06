import Link from 'next/link';
import Reveal from './Reveal';

// Small label, big heading, and an optional link on the right. Used at the top of each home page section.
export default function SectionHead({ eyebrow = '', title = 'Heading', linkLabel = '', linkHref = '', light = false }: { eyebrow?: string; title?: string; linkLabel?: string; linkHref?: string; light?: boolean }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className={`eyebrow ${light ? 'eyebrow-light' : ''}`}>{eyebrow}</p> : null}
        <h2 className={`h-xl mt-2 ${light ? 'text-white' : ''}`}>{title}</h2>
      </div>
      {linkLabel && linkHref ? <Link href={linkHref} className={`link-arrow ${light ? '!text-white' : ''}`}>{linkLabel}</Link> : null}
    </Reveal>
  );
}
