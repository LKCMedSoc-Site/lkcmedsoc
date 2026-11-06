import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Text written by students or editors is untrusted: strip everything except a short safe list.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'code', 'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    h1: 'h2',
  },
};

export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(html, OPTIONS);
}

/** For rich text that is already HTML (the Plasmic CMS editor). */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html ?? '', OPTIONS);
}

// ---- Group pages: the write-up managers type in the records app (records/pages.js has the same block rules) ----
const GROUP_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: [...(OPTIONS.allowedTags as string[]), 'aside', 'div', 'figure'],
  allowedClasses: { aside: ['blk-callout'], div: ['blk-photos'], figure: ['blk-quote'], a: ['blk-button'] },
};
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const parse = (md: string) => marked.parse(md, { async: false, gfm: true, breaks: false }) as string;

/**
 * Markdown plus four blocks:
 *   :::callout ... :::      a highlighted box
 *   :::photos ... :::       photos side by side
 *   :::quote ... :::        a pull quote
 *   :::button Label | https://link     a big button
 */
export function renderGroupMarkdown(md: string): string {
  const lines = (md ?? '').replace(/\r/g, '').split('\n');
  const out: string[] = []; let buf: string[] = []; let i = 0;
  const flush = () => { if (buf.length) { out.push(parse(buf.join('\n'))); buf = []; } };
  while (i < lines.length) {
    const ln = lines[i]; let m: RegExpExecArray | null;
    if ((m = /^:::(callout|photos|quote)\s*$/.exec(ln))) {
      flush(); const inner: string[] = []; i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) { inner.push(lines[i]); i++; }
      i++;
      const html = parse(inner.join('\n'));
      out.push(m[1] === 'callout' ? `<aside class="blk-callout">${html}</aside>` : m[1] === 'photos' ? `<div class="blk-photos">${html}</div>` : `<figure class="blk-quote">${html}</figure>`);
      continue;
    }
    if ((m = /^:::button\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/.exec(ln))) { flush(); out.push(`<p><a class="blk-button" href="${esc(m[2])}">${esc(m[1])}</a></p>`); i++; continue; }
    buf.push(ln); i++;
  }
  flush();
  return sanitizeHtml(out.join('\n'), GROUP_OPTIONS);
}
