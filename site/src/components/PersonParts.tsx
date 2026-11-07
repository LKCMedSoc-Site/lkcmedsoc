'use client';
import { useSelector } from '@plasmicapp/loader-nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Person = { name: string; title: string; photo: string; hasPhoto: boolean; initials: string; group: string; link: string };
const SAMPLE: Person = { name: 'Alex Tan', title: 'President', photo: '', hasPhoto: false, initials: 'AT', group: 'Committee', link: '' };
// Inside a People list these read the person being shown. Anywhere else they show a sample, so the card can still be designed.
const usePerson = (): Person => (useSelector('person') as Person | undefined) ?? SAMPLE;

export function PersonText({ field = 'name', className = '' }: { field?: 'name' | 'title' | 'group' | 'initials'; className?: string }) {
  const p = usePerson();
  return <span className={className}>{p[field]}</span>;
}

// The person's photo, in the shape you choose; initials when they have not shared one.
export function PersonPhoto({ shape = 'square', ratio = '1/1', className = '' }: { shape?: 'round' | 'square' | 'rounded'; ratio?: '1/1' | '4/5' | '3/4' | '16/9'; className?: string }) {
  const p = usePerson();
  const radius = shape === 'round' ? '9999px' : shape === 'rounded' ? '16px' : '0';
  const box = { aspectRatio: shape === 'round' ? '1/1' : ratio.replace('/', ' / '), borderRadius: radius, width: '100%', overflow: 'hidden' } as const;
  return p.hasPhoto && p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo} alt={p.name} loading="lazy" style={{ ...box, objectFit: 'cover' }} className={className} />
  ) : (
    <span aria-hidden style={box} className={`display grid place-items-center bg-mist text-4xl text-p900 ${className}`}>{p.initials}</span>
  );
}

// Wrap the whole card in this to make it link to the person's committee page (it does nothing when there is no link).
export function PersonLink({ children, className = '' }: { children?: ReactNode; className?: string }) {
  const p = usePerson();
  return p.link ? <Link href={p.link} className={`block no-underline ${className}`}>{children}</Link> : <div className={className}>{children}</div>;
}
