'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthBox from '@/components/AuthBox';
import { safeNext, useSession } from '@/lib/useSession';

function Inner() {
  const next = safeNext(useSearchParams().get('next'));
  const user = useSession();
  const go = () => { window.location.assign(next); };
  if (user === undefined) return null;
  if (user) return <div className="rounded-xl border border-line bg-p50 p-4"><p>You are signed in as <b>{user.email}</b>.</p><button type="button" onClick={go} className="mt-3 rounded-lg bg-p900 px-4 py-2.5 font-bold text-white">Continue</button></div>;
  return <AuthBox onSignedIn={go} />;
}
export default function SignInPage() { return <Suspense><Inner /></Suspense>; }
