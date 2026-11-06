import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="display text-5xl">Page not found</h1>
      <p className="mt-4 text-muted">That address does not exist (any more). Try the menu above, or go <Link className="underline" href="/">home</Link>.</p>
    </div>
  );
}
