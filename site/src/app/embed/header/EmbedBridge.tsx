'use client';
import { useEffect } from 'react';
import { browserClient } from '@/lib/supabase';

// Runs inside the framed header (/embed/header) and talks to the app page around it:
//  - how tall the frame should be: just the bar, or the whole window while a menu, the search or a sign-in box is open;
//  - when somebody signs in or out here, so the app can refresh its own data;
//  - links go to the whole window, never open inside the little frame.
export default function EmbedBridge() {
  useEffect(() => {
    const html = document.documentElement;
    html.style.background = 'transparent'; document.body.style.background = 'transparent'; html.style.overflow = 'hidden';
    const send = (msg: Record<string, unknown>) => { try { window.parent.postMessage({ lkc: 'header', ...msg }, '*'); } catch { /* no parent */ } };
    let hover = false, focus = false, last = '';
    const bar = () => document.querySelector('header');
    const report = (ready = false) => {
      const h = bar()?.getBoundingClientRect().height ?? 64;
      const open = hover || focus || !!document.querySelector('[role="dialog"]');
      const key = `${Math.round(h)}|${open}|${ready}`;
      if (key === last && !ready) return;
      last = key; send({ ready, height: Math.round(h), open });
    };
    const over = (e: MouseEvent) => { const t = e.target as Element | null; hover = !!t?.closest?.('header,[role="dialog"]'); report(); };
    const leave = () => { hover = false; report(); };
    const fin = () => { focus = !!document.activeElement?.closest?.('header'); report(); };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      e.preventDefault(); e.stopPropagation();
      try { (window.top ?? window).location.href = a.href; } catch { window.open(a.href, '_top'); }
    };
    document.addEventListener('mouseover', over); document.documentElement.addEventListener('mouseleave', leave);
    document.addEventListener('focusin', fin); document.addEventListener('focusout', () => setTimeout(fin, 0));
    document.addEventListener('click', click, true);
    const mo = new MutationObserver(() => report()); mo.observe(document.body, { childList: true, subtree: true });
    const ro = new ResizeObserver(() => report()); const b = bar(); if (b) ro.observe(b);
    report(true);
    // Signing in or out here: tell the app (only when the person really changed, not on every token refresh).
    const sb = browserClient(); let who: string | null | undefined;
    const { data } = sb.auth.onAuthStateChange((_ev, session) => {
      const id = session?.user?.id ?? null;
      if (who !== undefined && id !== who) send({ auth: id ? 'signed-in' : 'signed-out' });
      who = id;
    });
    const ready = setTimeout(() => report(true), 600);   // once more after the menu and session have rendered
    return () => {
      document.removeEventListener('mouseover', over); document.documentElement.removeEventListener('mouseleave', leave);
      document.removeEventListener('focusin', fin); document.removeEventListener('click', click, true);
      mo.disconnect(); ro.disconnect(); data.subscription.unsubscribe(); clearTimeout(ready);
    };
  }, []);
  return null;
}
