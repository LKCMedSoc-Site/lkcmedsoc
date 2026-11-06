'use client';
import Image from 'next/image';
import { useState } from 'react';

// One image piece for the whole site.
// - Photos from our Supabase storage are resized for the screen (see next.config.ts).
// - If the file is missing or broken it shows a purple panel instead (or nothing, with onMissing="hide").
// - ratio makes a fixed shape (e.g. "16/9"), so mixed photo sizes still line up.
export default function SafeImage({
  src, alt = '', ratio, sizes = '100vw', priority = false, className = '', imgClassName = '', position = 'center', onMissing = 'panel',
}: {
  src?: string | null; alt?: string; ratio?: string; sizes?: string; priority?: boolean;
  className?: string; imgClassName?: string; position?: string; onMissing?: 'panel' | 'hide';
}) {
  const [bad, setBad] = useState(false);
  const missing = !src || bad;
  if (missing && onMissing === 'hide') return null;
  const ours = !!src && /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src);
  return (
    <div className={`relative overflow-hidden bg-p100 ${className}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      {missing ? (
        <div aria-hidden className="absolute inset-0 grid place-items-center bg-gradient-to-br from-p700 to-p900">
          <span className="display text-3xl text-p300/40">LKCMedSoc</span>
        </div>
      ) : (
        <Image
          src={src!} alt={alt} fill sizes={sizes} priority={priority} unoptimized={!ours}
          className={`object-cover ${imgClassName}`} style={{ objectPosition: position }}
          onError={() => setBad(true)}
        />
      )}
    </div>
  );
}
