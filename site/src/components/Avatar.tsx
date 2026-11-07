'use client';
import { useState } from 'react';

// A round photo of a person, or their initials when they have not shared one (or it cannot load).
export default function Avatar({ name, photo, size = 56, dark = false, className = '' }: { name: string; photo?: string | null; size?: number; dark?: boolean; className?: string }) {
  const [bad, setBad] = useState(false);
  const initials = name.split(/[\s(]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const box = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return photo && !bad ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={name} width={size} height={size} loading="lazy" onError={() => setBad(true)} style={box} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span aria-hidden style={box} className={`display grid shrink-0 place-items-center rounded-full ${dark ? 'bg-p900 text-p300' : 'bg-mist text-p900'} ${className}`}>{initials}</span>
  );
}
