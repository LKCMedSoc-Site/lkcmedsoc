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

/** The embed address for a YouTube or Vimeo link, or null. Only these two hosts are ever embedded, and the address is rebuilt from the video id. */
export function videoEmbedUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /\/(?:video\/)?(\d{6,12})(?:\/|$)/.exec(u.pathname);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

/** Post text is Markdown. A line `:::video <YouTube or Vimeo link>` becomes a responsive video; anything else with ::: stays plain text. */
export function renderMarkdown(md: string): string {
  const videos: string[] = [];
  const src = (md ?? '').replace(/^:::video[ \t]+(\S+)[ \t]*$/gm, (line, url: string) => {
    const embed = videoEmbedUrl(url);
    if (!embed) return line;
    videos.push(embed);
    return `\nLKCVIDEO${videos.length - 1}TOKEN\n`;
  });
  const html = sanitizeHtml(marked.parse(src, { async: false, gfm: true, breaks: false }) as string, OPTIONS);
  return html.replace(/<p>LKCVIDEO(\d+)TOKEN<\/p>/g, (_m, i: string) => {
    const embed = videos[Number(i)];
    return embed ? `<div class="blk-video"><iframe src="${embed}" title="Video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : '';
  });
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
