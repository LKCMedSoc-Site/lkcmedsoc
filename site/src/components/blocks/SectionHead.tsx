import Link from 'next/link';

// Big heading with an optional link on the right. The small label above is optional and off by default.
export default function SectionHead({ eyebrow = '', title = 'Heading', linkLabel = '', linkHref = '', light = false }: { eyebrow?: string; title?: string; linkLabel?: string; linkHref?: string; light?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className={`eyebrow ${light ? 'eyebrow-light' : ''}`}>{eyebrow}</p> : null}
        <h2 className={`h-xl ${eyebrow ? 'mt-2' : ''} ${light ? 'text-white' : ''}`}>{title}</h2>
      </div>
      {linkLabel && linkHref ? <Link href={linkHref} className={`link-arrow ${light ? '!text-white !decoration-p300' : ''}`}>{linkLabel}</Link> : null}
    </div>
  );
}
