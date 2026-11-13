// A tiny stand-in for the live Supabase project, for local testing only (no sign-in, no database).
// Run: npm run mock   then: npm run dev:mock
// It answers the same RPC calls the site makes: supabase.schema('activities').rpc(name, args).
import http from 'node:http';


const today = new Date(); const d = (n) => new Date(today.getTime() + n * 864e5).toISOString().slice(0, 10);
const events = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'Freshmen Welcome Night', body: 'LKCMedSoc', venue: 'Clinical Sciences Building, Level 1', start_date: d(7), end_date: d(7), start_time: '18:30', end_time: '21:00', summary: 'Meet your seniors, houses and CCAs.', status: 'Approved', visibility: 'Public', rsvp_open: true, guest_rsvp_open: true, checkin_open: false, spots_left: 12, my_rsvp: null },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Teddy Bear Hospital', body: 'Project Teddy', venue: 'Community centre', start_date: d(14), end_date: d(15), start_time: null, end_time: null, summary: 'Two-day outreach for children.', status: 'Approved', visibility: 'Members', rsvp_open: true, guest_rsvp_open: false, checkin_open: false, spots_left: 0, my_rsvp: null },
];
const mk = (i, cat) => ({ slug: 'post-' + i, title: `Sample ${cat} write-up ${i}`, category: cat, summary: 'A short summary of what happened.', published_at: new Date(today.getTime() - i * 864e5 * 9).toISOString(),
  body_md: `## Highlights\n\nWe **did** a thing. [A link](https://example.com)\n\n<script>alert('xss')</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n- one\n- two`, cover_path: null, photos: [], event: i % 2 ? { id: events[0].id, title: events[0].title } : null });
const cats = ['Impact', 'Events', 'Announcements', 'Stories'];
const posts = Array.from({ length: 30 }, (_, i) => mk(i + 1, cats[i % 4]));

const rpc = {
  upcoming_events: () => events.filter((e) => e.visibility === 'Public'),
  public_event: ({ aid }) => events.find((e) => e.id === aid && e.visibility === 'Public') ?? null,
  public_posts: ({ p_limit = 12, p_offset = 0, p_category = null }) => {
    const all = posts.filter((p) => !p_category || p.category === p_category);
    return { total: all.length, items: all.slice(p_offset, p_offset + p_limit) };
  },
  public_post: ({ p_slug }) => posts.find((p) => p.slug === p_slug) ?? null,
  guest_rsvp: ({ p_name, p_email, p_consent }) => { if (!p_consent) throw new Error('Consent needed'); return { code: 'GUEST123', status: 'Going', name: p_name }; },
  guest_rsvp_status: () => null,
};

// The policy_* functions need policy-seed.json, which is not in Git: without it the mock simply has no policy pages.
try { Object.assign(rpc, (await import('./policy-mock.mjs')).policyRpc); } catch { console.log('policy mock off (no policy-seed.json)'); }

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const m = /^\/rest\/v1\/rpc\/(\w+)/.exec(req.url ?? '');
  if (!m || !rpc[m[1]]) { res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ message: 'mock: not implemented ' + req.url })); return; }
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', () => {
    try { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rpc[m[1]](body ? JSON.parse(body) : {}))); }
    catch (e) { res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ message: e.message })); }
  });
}).listen(54321, () => console.log('mock Supabase on http://localhost:54321'));
