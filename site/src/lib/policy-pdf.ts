import path from 'node:path';
import PDFDocument from 'pdfkit';
import { marked, type Token, type Tokens } from 'marked';
import { tierLabel, statusText, longDate, type DocView } from './policy';

// A policy document as a PDF: title page, contents, every clause with its number, a footer with the version and page numbers.
// Built from the same clause text the website shows, so the two cannot differ. Drafts carry a DRAFT mark on every page.
// Type is Arimo (src/fonts/arimo, SIL Open Font License), embedded in the file: it has Arial's exact letter widths, so the PDF looks the same on every device.
// Colour: white pages, the one darkest purple for every accent and fill, neutral grey for secondary text and rules.
const PURPLE = '#2a0628', INK = '#1f1f1f', MUTED = '#595959', LINE = '#cfcfcf';
const FONT_DIR = path.join(process.cwd(), 'src', 'fonts', 'arimo');
const REG = 'Arimo', BOLD = 'Arimo-Bold', ITAL = 'Arimo-Italic', BOLDITAL = 'Arimo-BoldItalic';
const M = 56;                                  // page margin

// Arimo covers the symbols the policy uses (arrows, ≥, …). Only invisible characters need tidying.
const clean = (s: string) => s.replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '').replace(/[\u00a0\u2000-\u200a]/g, ' ');

type Run = { text: string; font: string };
function runs(tokens: Token[] | undefined, font = REG, out: Run[] = []): Run[] {
  for (const t of tokens ?? []) {
    const bold = font.includes('Bold'), ital = font.includes('Italic');
    if (t.type === 'strong') runs((t as Tokens.Strong).tokens, ital ? BOLDITAL : BOLD, out);
    else if (t.type === 'em') runs((t as Tokens.Em).tokens, bold ? BOLDITAL : ITAL, out);
    else if (t.type === 'codespan') out.push({ text: clean((t as Tokens.Codespan).text), font: REG });
    else if (t.type === 'br') out.push({ text: '\n', font });
    else if (t.type === 'link') runs((t as Tokens.Link).tokens, font, out);
    else if ('tokens' in t && Array.isArray((t as { tokens?: Token[] }).tokens)) runs((t as { tokens: Token[] }).tokens, font, out);
    else if ('text' in t) out.push({ text: clean(String((t as { text: string }).text).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')), font });
  }
  return out;
}
const plain = (tokens: Token[] | undefined) => runs(tokens).map((r) => r.text).join('');

export async function policyPdf(view: DocView): Promise<Buffer> {
  const { doc, clauses } = view;
  const draft = doc.status === 'draft';
  const d = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M + 14, left: M, right: M }, bufferPages: true, font: path.join(FONT_DIR, 'Arimo-Regular.ttf'), info: { Title: `${doc.title}${draft ? ' (draft)' : ` (version ${doc.shown_version})`}`, Author: 'LKCMedSoc', Subject: 'MedSoc policy' } });
  d.registerFont(REG, path.join(FONT_DIR, 'Arimo-Regular.ttf')); d.registerFont(BOLD, path.join(FONT_DIR, 'Arimo-Bold.ttf'));
  d.registerFont(ITAL, path.join(FONT_DIR, 'Arimo-Italic.ttf')); d.registerFont(BOLDITAL, path.join(FONT_DIR, 'Arimo-BoldItalic.ttf'));
  const chunks: Buffer[] = [];
  d.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => d.on('end', () => res(Buffer.concat(chunks))));
  const W = d.page.width - M * 2;
  const room = (h: number) => { if (d.y + h > d.page.height - d.page.margins.bottom) d.addPage(); };

  // ---- title page ----
  d.rect(0, 0, d.page.width, 250).fill(PURPLE);
  d.fillColor('#ffffff').font(BOLD).fontSize(10).text('LKCMEDSOC POLICY  ·  ' + tierLabel(doc.tier).toUpperCase(), M, 70, { characterSpacing: 1.5 });
  d.fillColor('#ffffff').font(BOLD).fontSize(30).text(clean(doc.title), M, 100, { width: W, lineGap: 2 });
  d.fillColor('#ffffff').font(REG).fontSize(12).text(clean(doc.summary), M, d.y + 14, { width: W * 0.85 });
  d.fillColor(INK).font(BOLD).fontSize(11).text(draft ? 'Draft proposal. Not yet in force.' : `Version ${doc.shown_version}${doc.shown_version < doc.version ? ' (superseded)' : ''}`, M, 280);
  d.font(REG).fillColor(MUTED).fontSize(10.5);
  if (!draft && doc.effective_on) d.text(`Effective ${longDate(doc.effective_on)}`);
  d.text(`Changed by: ${clean(doc.owner)}`);
  d.text(`Read online: lkcmedsoc.com/policy/${doc.slug}`);
  d.moveDown(2);

  // ---- contents ----
  d.fillColor(PURPLE).font(BOLD).fontSize(14).text('Contents');
  d.moveDown(0.5);
  for (const c of clauses) {
    room(16); const y = d.y;
    d.fillColor(PURPLE).font(BOLD).fontSize(10).text(c.ref, M, y, { width: 50, lineBreak: false });
    d.fillColor(INK).font(REG).text(clean(c.heading), M + 54, y, { width: W - 54 });
  }

  // ---- clauses ----
  const block = (t: Token, x: number, w: number) => {
    if (t.type === 'space' || t.type === 'hr') return;
    if (t.type === 'heading') { room(40); d.moveDown(0.4); d.fillColor(PURPLE).font(BOLD).fontSize(11.5).text(plain((t as Tokens.Heading).tokens), x, d.y, { width: w }); d.moveDown(0.3); return; }
    if (t.type === 'paragraph' || t.type === 'text') { para(runs((t as Tokens.Paragraph).tokens ?? [t]), x, w); d.moveDown(0.6); return; }
    if (t.type === 'list') { list(t as Tokens.List, x, w); d.moveDown(0.4); return; }
    if (t.type === 'table') { table(t as Tokens.Table, x, w); d.moveDown(0.8); return; }
    if (t.type === 'blockquote') { const s = d.y; for (const k of (t as Tokens.Blockquote).tokens) block(k, x + 14, w - 14); d.moveTo(x + 4, s).lineTo(x + 4, d.y - 4).lineWidth(2).strokeColor(PURPLE).stroke(); return; }
    if (t.type === 'code') { d.fillColor(INK).font(REG).fontSize(9).text(clean((t as Tokens.Code).text), x, d.y, { width: w }); d.moveDown(0.6); return; }
    if ('text' in t) { para([{ text: clean(String((t as { text: string }).text)), font: REG }], x, w); d.moveDown(0.6); }
  };
  const para = (rs: Run[], x: number, w: number) => {
    d.fillColor(INK).fontSize(10.5);
    if (!rs.length) return;
    // Runs of different weight continue one text flow; the width is given once, on the first run (repeating it narrows the line after a bold word).
    rs.forEach((r, i) => {
      d.font(r.font);
      if (i === 0) d.text(r.text, x, d.y, { width: w, continued: rs.length > 1, lineGap: 2.5 });
      else d.text(r.text, { continued: i < rs.length - 1, lineGap: 2.5 });
    });
  };
  const list = (l: Tokens.List, x: number, w: number) => {
    l.items.forEach((it, i) => {
      room(20);
      const mark = l.ordered ? `${(Number(l.start) || 1) + i}.` : '•';
      const y = d.y;
      d.fillColor(PURPLE).font(BOLD).fontSize(10.5).text(mark, x, y, { width: 16 });
      d.y = y;
      const kids = it.tokens;
      kids.forEach((k, n) => { if (k.type === 'list') list(k as Tokens.List, x + 16, w - 16); else if (k.type === 'text' || k.type === 'paragraph') { para(runs((k as Tokens.Text).tokens ?? [k]), x + 16, w - 16); if (n < kids.length - 1) d.moveDown(0.2); } });
      d.moveDown(0.3);
    });
  };
  const table = (t: Tokens.Table, x: number, w: number) => {
    const n = t.header.length; const pad = 5;
    // columns: share the width by how much text each holds, never narrower than 10%
    const weight = t.header.map((_, c) => Math.max(8, Math.min(60, Math.max(plain(t.header[c].tokens).length, ...t.rows.map((r) => plain(r[c]?.tokens).length)))));
    const total = weight.reduce((a, b) => a + b, 0);
    let ws = weight.map((v) => Math.max(w * 0.1, (v / total) * w)); const sum = ws.reduce((a, b) => a + b, 0); ws = ws.map((v) => (v / sum) * w);
    // never narrower than the longest word in the column (so a word is not broken across lines); the other columns give up the difference
    d.font(BOLD).fontSize(9.5);
    const minW = t.header.map((_, c) => Math.max(...[t.header[c].tokens, ...t.rows.map((r) => r[c]?.tokens)].map((tk) => Math.max(0, ...plain(tk).split(/\s+/).map((wd) => d.widthOfString(wd)))), 0) + pad * 2 + 2);
    for (let k = 0; k < 4; k++) {
      const short = ws.reduce((a, v, i) => a + Math.max(0, minW[i] - v), 0); if (short < 0.5) break;
      const room2 = ws.reduce((a, v, i) => a + Math.max(0, v - minW[i]), 0); if (room2 <= 0) break;
      ws = ws.map((v, i) => (v < minW[i] ? minW[i] : Math.max(minW[i], v - (short * Math.max(0, v - minW[i])) / room2)));
    }
    const row = (cells: Token[][], head: boolean) => {
      d.font(head ? BOLD : REG).fontSize(9.5);
      const txt = cells.map((c) => plain(c));
      const h = Math.max(...txt.map((s, i) => d.heightOfString(s, { width: ws[i] - pad * 2 }))) + pad * 2;
      room(h);
      const y = d.y; let cx = x;
      txt.forEach((s, i) => { d.fillColor(head ? PURPLE : INK).font(head ? BOLD : REG).fontSize(9.5).text(s, cx + pad, y + pad, { width: ws[i] - pad * 2 }); cx += ws[i]; });
      d.moveTo(x, y + h).lineTo(x + w, y + h).lineWidth(head ? 1.2 : 0.5).strokeColor(head ? PURPLE : LINE).stroke();
      d.y = y + h;
    };
    row(t.header.map((h) => h.tokens), true);
    t.rows.forEach((r) => row(r.map((c) => c.tokens), false));
    d.x = x; void n;
  };

  clauses.forEach((c, i) => {
    if (i === 0) d.addPage();
    else {                                   // clauses flow one after another; start a fresh page only when little room is left
      room(130); d.moveDown(1);
      d.moveTo(M, d.y).lineTo(M + W, d.y).lineWidth(0.5).strokeColor(LINE).stroke(); d.moveDown(1);
    }
    d.fillColor(PURPLE).font(BOLD).fontSize(10).text(c.ref, M, d.y);
    d.fillColor(PURPLE).font(BOLD).fontSize(16).text(clean(c.heading), M, d.y + 2, { width: W });
    d.moveDown(0.6);
    for (const t of marked.lexer(c.body_md)) block(t, M, W);
  });

  // ---- footer and (for drafts) the DRAFT mark, on every page ----
  const range = d.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    d.switchToPage(range.start + i);
    if (draft) {
      d.save(); d.rotate(-35, { origin: [d.page.width / 2, d.page.height / 2] });
      d.fillColor(PURPLE).fillOpacity(0.06).font(BOLD).fontSize(110).text('DRAFT', 0, d.page.height / 2 - 60, { width: d.page.width, align: 'center', lineBreak: false });
      d.restore(); d.fillOpacity(1);
    }
    const by = d.page.height - 40;
    d.moveTo(M, by - 6).lineTo(d.page.width - M, by - 6).lineWidth(0.5).strokeColor(LINE).stroke();
    d.fillColor(MUTED).font(REG).fontSize(8.5);
    d.page.margins.bottom = 0;     // the footer sits in the bottom margin
    d.text(`LKCMedSoc  ·  ${clean(doc.title)}  ·  ${draft ? 'Draft proposal' : statusText({ status: doc.status, version: doc.shown_version })}`, M, by, { width: W - 70, lineBreak: false });
    d.text(`Page ${i + 1} of ${range.count}`, d.page.width - M - 70, by, { width: 70, align: 'right', lineBreak: false });
  }
  d.end();
  return done;
}
