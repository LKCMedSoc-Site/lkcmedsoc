import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Text written by students or editors is untrusted: strip everything except a short safe list.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'code', 'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'] },
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
