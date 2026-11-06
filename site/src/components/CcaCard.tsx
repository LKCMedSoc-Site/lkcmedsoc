import type { Body, Leader } from '@/lib/records';
import Leaders from './Leaders';

export default function CcaCard({ body, leaders }: { body: Body; leaders: Leader[] }) {
  const links = [body.recruitment && ['Join us', body.recruitment], body.instagram && ['Instagram', body.instagram.startsWith('http') ? body.instagram : `https://instagram.com/${body.instagram.replace(/^@/, '')}`], body.website && ['Website', body.website]].filter(Boolean) as [string, string][];
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <h3 className="text-lg font-bold text-p900">{body.name}</h3>
      {body.description ? <p className="mt-1 text-sm text-muted">{body.description}</p> : null}
      <Leaders list={leaders} className="mt-3" />
      {links.length ? <p className="mt-3 flex flex-wrap gap-x-4 text-sm">{links.map(([l, h]) => <a key={l} className="underline" href={h} target="_blank" rel="noopener">{l}</a>)}</p> : null}
    </div>
  );
}
