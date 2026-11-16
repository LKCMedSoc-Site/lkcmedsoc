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

/**
 * Image size: `![alt](url){w=60}` shows the picture at 60% of the column width; `{w=60 align=right}` (left, center or right) also places it.
 * No size means full width, as before. Runs on already-sanitised HTML and builds the style itself from digits only, so it cannot be abused.
 * records/pages.js has the same rule for its preview; keep the two in step.
 */
export function sizeImages(html: string): string {
  return html.replace(/<img ([^>]*?)\s*\/?>\{w=(\d{1,3})(?:\s+align=(left|center|right))?\}/g, (_m, attrs: string, w: string, align?: string) => {
    const pct = Math.min(100, Math.max(10, Number(w)));
    return `<img ${attrs} class="blk-img${align ? ` blk-img-${align}` : ''}" style="width:${pct}%" />`;
  });
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
  const html = sizeImages(sanitizeHtml(marked.parse(src, { async: false, gfm: true, breaks: false }) as string, OPTIONS));
  return html.replace(/<p>LKCVIDEO(\d+)TOKEN<\/p>/g, (_m, i: string) => {
    const embed = videos[Number(i)];
    return embed ? `<div class="blk-video"><iframe src="${embed}" title="Video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : '';
  });
}

/** For rich text that is already HTML (the Plasmic CMS editor). */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html ?? '', OPTIONS);
}

// ---- Group pages: the write-up managers type in the records app (records/pages.js has the same block rules; keep the two in step) ----
const GROUP_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: [...(OPTIONS.allowedTags as string[]), 'aside', 'div', 'figure', 'details', 'summary'],
  allowedAttributes: { ...(OPTIONS.allowedAttributes as Record<string, string[]>), div: ['data-n', 'data-cols', 'data-w', 'data-align'] },
  allowedClasses: { aside: ['blk-callout'], div: ['blk-photos', 'blk-columns', 'blk-col'], figure: ['blk-quote'], a: ['blk-button'], details: ['blk-toggle'] },
};
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const parse = (md: string) => marked.parse(md, { async: false, gfm: true, breaks: false }) as string;

// A line that opens a block that has a closing ::: line (the one-line blocks, button and video, do not).
const OPENS = /^:::(callout|photos|quote|columns|toggle)(?:\s+.*)?$/;

/**
 * Markdown plus these blocks (each closes with a line of just :::, and they can sit inside each other):
 *   :::callout ... :::      a highlighted box
 *   :::photos ... :::       photos side by side; `:::photos cols=3 shape=round` sets how many per row (2 to 4) and the crop (square, round, wide)
 *   :::quote ... :::        a pull quote
 *   :::columns ... :::      two to four columns; a line of just ||| starts the next column
 *   :::toggle Title ... ::: a section that opens and closes
 *   :::button Label | https://link     a big button
 *   :::video https://youtube.com/...   a YouTube or Vimeo video
 */
export function renderGroupMarkdown(md: string): string {
  const videos: string[] = [];
  const html = blocks((md ?? '').replace(/\r/g, '').split('\n'), videos, 0);
  const clean = lightboxable(sizeGalleries(sizeImages(sanitizeHtml(html, GROUP_OPTIONS))));
  return clean.replace(/<p>LKCVIDEO(\d+)TOKEN<\/p>/g, (_m, i: string) => {
    const embed = videos[Number(i)];
    return embed ? `<div class="blk-video"><iframe src="${embed}" title="Video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : '';
  });
}

/**
 * The optional `cols=3 w=70 align=center` on a `:::photos` line, as data attributes (values are checked: cols 2-4, width 10-100 as a percentage of the column,
 * align left/center/right). Pictures always keep their own shape. records/pages.js has the same rule.
 */
function photoOpts(line: string): string {
  const cols = /\bcols=([234])\b/.exec(line), w = /\bw=(\d{1,3})\b/.exec(line), align = /\balign=(left|center|right)\b/.exec(line);
  return (cols ? ` data-cols="${cols[1]}"` : '') + (w ? ` data-w="${Math.min(100, Math.max(10, Number(w[1])))}"` : '') + (w && align ? ` data-align="${align[1]}"` : '');
}

/**
 * Makes the pictures in a write-up reachable by keyboard for the viewer (components/ProseLightbox.tsx): a picture that is not inside a link gets tabindex,
 * role=button and, when it has no alt text, a label. Done here, on the server, so the page and what the browser builds agree (no change after load).
 */
export function lightboxable(html: string): string {
  return html.replace(/(<a\b[^>]*>\s*)?(<img\b[^>]*>)/g, (m, a: string | undefined, img: string) => {
    if (a) return m;
    const named = /\balt="[^"]+"/.test(img);
    return `<img tabindex="0" role="button" data-lb="1"${named ? '' : ' aria-label="Enlarge photo"'}${img.slice(4)}`;
  });
}

/** Turns a gallery's data-w / data-align into its width and position. Runs on already-sanitised HTML and builds the style from digits and fixed words only. */
export function sizeGalleries(html: string): string {
  return html.replace(/<div class="blk-photos"([^>]*)>/g, (m, attrs: string) => {
    const w = /data-w="(\d{1,3})"/.exec(attrs); if (!w) return m;
    const align = (/data-align="(left|center|right)"/.exec(attrs) || [])[1];
    const pos = align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : '';
    return `<div class="blk-photos"${attrs} style="width:${Math.min(100, Math.max(10, Number(w[1])))}%;${pos}">`;
  });
}

function blocks(lines: string[], videos: string[], depth: number): string {
  const out: string[] = []; let buf: string[] = []; let i = 0;
  const flush = () => { if (buf.length) { out.push(parse(buf.join('\n'))); buf = []; } };
  while (i < lines.length) {
    const ln = lines[i]; let m: RegExpExecArray | null;
    if (depth < 4 && (m = OPENS.exec(ln))) {
      flush(); const inner: string[] = []; let open = 1; i++;
      while (i < lines.length) {
        if (/^:::\s*$/.test(lines[i])) { open--; if (open === 0) break; }
        else if (OPENS.test(lines[i])) open++;
        inner.push(lines[i]); i++;
      }
      i++;
      const kind = m[1];
      if (kind === 'columns') {
        const cols: string[][] = [[]]; let nest = 0;
        for (const l of inner) {
          if (/^:::\s*$/.test(l)) nest--; else if (OPENS.test(l)) nest++;
          if (nest === 0 && /^\|\|\|\s*$/.test(l)) cols.push([]); else cols[cols.length - 1].push(l);
        }
        out.push(`<div class="blk-columns" data-n="${Math.min(cols.length, 4)}">${cols.slice(0, 4).map((c) => `<div class="blk-col">${blocks(c, videos, depth + 1)}</div>`).join('')}</div>`);
        continue;
      }
      const body = blocks(inner, videos, depth + 1);
      if (kind === 'toggle') { const title = ln.replace(/^:::toggle\s*/, '').trim() || 'More'; out.push(`<details class="blk-toggle"><summary>${esc(title)}</summary>${body}</details>`); }
      else out.push(kind === 'callout' ? `<aside class="blk-callout">${body}</aside>` : kind === 'photos' ? `<div class="blk-photos"${photoOpts(ln)}>${body}</div>` : `<figure class="blk-quote">${body}</figure>`);
      continue;
    }
    if ((m = /^:::button\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/.exec(ln))) { flush(); out.push(`<p><a class="blk-button" href="${esc(m[2])}">${esc(m[1])}</a></p>`); i++; continue; }
    if ((m = /^:::video\s+(\S+)\s*$/.exec(ln))) {
      const embed = videoEmbedUrl(m[1]);
      if (embed) { flush(); videos.push(embed); out.push(`<p>LKCVIDEO${videos.length - 1}TOKEN</p>`); i++; continue; }
    }
    buf.push(ln); i++;
  }
  flush();
  return out.join('\n');
}
