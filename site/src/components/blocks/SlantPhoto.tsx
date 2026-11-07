import SafeImage from '@/components/SafeImage';

// A photo cut on the brand slant, optionally with the lilac slab offset behind it.
export default function SlantPhoto({ src = '', ratio = '16/10', slab = false, className = '' }: { src?: string; ratio?: string; slab?: boolean; className?: string }) {
  const photo = <div className="zoom slant"><SafeImage src={src} sizes="(min-width: 768px) 50vw, 100vw" ratio={ratio} className="w-full" /></div>;
  return <div className={className}>{slab ? <div className="slab">{photo}</div> : photo}</div>;
}
