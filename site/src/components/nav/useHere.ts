'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Which menu entry is the page you are on.
// On the website that is the current path. In the header frame shown at the top of an app (/embed/header, see shared/suite-nav.js)
// the path is always /embed/header, so "here" is the app around the frame instead: the menu link whose address has the same host
// (inventory.lkcmedsoc.com -> Resources > Inventory). The frame learns that host from document.referrer, which is the app page's address.
function useAppHost(): string {
  const [host, setHost] = useState('');
  useEffect(() => {
    if (window.self === window.top) return;
    // ?app=<host> on the frame's address wins (for testing, or a browser that sends no referrer).
    const given = new URLSearchParams(location.search).get('app');
    if (given) { setHost(given.toLowerCase()); return; }
    try { setHost(new URL(document.referrer).hostname); } catch { /* no referrer: nothing is marked */ }
  }, []);
  return host;
}

export function useHere(): (href: string) => boolean {
  const path = usePathname();
  const app = useAppHost();
  return (href: string) => {
    if (/^https?:\/\//.test(href)) {
      if (!app) return false;
      try { return new URL(href).hostname === app; } catch { return false; }
    }
    if (app) return false;
    return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
  };
}
