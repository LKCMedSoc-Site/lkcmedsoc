import Link from 'next/link';

const LOOKS = {
  pink: 'bg-pink text-p900 hover:bg-white',
  plum: 'bg-p900 text-white hover:bg-p950',
  white: 'bg-white text-p900 hover:bg-mist',
  'outline-light': 'border border-p300/60 text-white hover:bg-white/10',
  'outline-dark': 'border-2 border-p900 text-p900 hover:bg-p900 hover:text-white',
} as const;

// A rounded button or link in the brand style.
export default function PillButton({ label = 'Button', href = '/', look = 'pink', className = '' }: { label?: string; href?: string; look?: keyof typeof LOOKS; className?: string }) {
  const cls = `press inline-block rounded-full px-7 py-3.5 font-bold no-underline ${LOOKS[look] ?? LOOKS.pink} ${className}`;
  return /^https?:/.test(href)
    ? <a href={href} target="_blank" rel="noopener" className={cls}>{label}</a>
    : <Link href={href || '/'} className={cls}>{label}</Link>;
}
