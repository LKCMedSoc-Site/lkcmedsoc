# lkcmedsoc.com

Next.js (App Router) + Tailwind + shadcn/ui. Public data comes from Supabase; words for static pages are Markdown files in `content/`.

## Run it
```
npm install
npm run dev            # uses the live Supabase project (read-only public data)
npm run mock           # in a second terminal: fake Supabase on :54321
npm run dev:mock       # the site pointed at the fake one
```
Status: written but **not yet built or run** (the build sandbox could not reach the npm registry). First job on a machine with internet: `npm install && npm run build` and fix anything it reports.

## Where things are
| To change… | Edit |
|---|---|
| Colours, fonts | `src/app/globals.css` (the `@theme` block) |
| Menu | `src/lib/nav.ts` |
| Address, email, socials | `src/lib/site.ts` |
| Home page words | `src/lib/home.ts`, `content/president-message.md` |
| About, Policy, etc. | `content/*.md` (TinaCMS will edit these) |
| Old Wix address → new | `next.config.ts` |
| Events / News pages | `src/app/events`, `src/app/news` |

## Data
- Events: `activities.upcoming_events()`, `activities.public_event(aid)`, guest RSVP functions, and `rsvp` / `cancel_rsvp` for signed-in students.
- News: `activities.public_posts(...)`, `activities.public_post(slug)`; photos in the public `post-photos` bucket.
- Post field names in `src/lib/posts.ts` (`normalise`) are a best guess. Check them against `activities_posts.sql`.
- Post text is Markdown, converted then sanitised (`src/lib/markdown.ts`) before display.
- Sign-in is NTU email + password on the page itself (`AuthBox`). Sessions are per website address, so this is separate from the portal's.


## Designing pages in Plasmic

Everything on the site can be designed in Plasmic Studio. Pages and layout pieces fall back to the coded version when there is no Plasmic version, so you can move over one page at a time and nothing breaks in between.

**Replace a page.** In Studio, create a page at the real path and publish it. These paths are checked:
`/`, `/events`, `/student-groups`, `/gazette`, `/resources`, `/policy`, `/policy/[slug]`, `/about/meet-the-team`, `/about/houses`. The full list, and the structure agreed but not built yet, is in `SITEMAP.md` at the repo root.
(To check another page, add `const designed = await plasmicData('/path'); if (designed) return <PlasmicView data={designed} />;` at the top of its page; see `src/app/events/page.tsx`.)

**Replace the header or footer.** Create Plasmic components named exactly `Header` and `Footer`, and publish them.

**Build from these blocks** (Studio's Add menu; registered in `src/plasmic-init-client.tsx`):
- Editable layouts (everything inside is yours to edit and move): **Hero layout (editable)** (a slanted band with a words area and a picture area), **Photo card (editable)** (your own heading and text over a photo), and **Page band (slanted)**.
- Brand pieces to put inside them: **Display text** (the big condensed face, with size and colour), **Button (pill)**, **Photo on the slant**, Counting number, Page title band.
- Fixed layouts (only their props can be changed, not what is inside): Photo hero, Photo card, Section heading. Use the editable ones above when you want to move things around. Scrolling words and Fade in on scroll are also available.
- Header parts: Site header (ready-made), Site footer (ready-made), Menu (desktop), Menu button (phones), Search button.
- Live data (they load their own data): Events with filters, Student groups cards, News cards with filters, CCA spotlight, News list, Events list.
- Colours and fonts appear as tokens (Plum darkest, Plum, Magenta, Orchid, Pale, Lilac, Mist, Pink, Yellow, Grey, Text; Display font, Body font). They follow `src/app/globals.css`.

**Why some blocks cannot be edited on the canvas.** A coded block is sealed: Studio only edits the settings the code exposes. The "editable" shells expose slots, which are areas you fill with Plasmic's own boxes, text and buttons. Live-data blocks (events, student groups, news, CCA spotlight) stay sealed on purpose: change them through their settings.

**Good to know**
- The live blocks fetch in the browser, so on a Plasmic page their content appears just after the page loads. The coded pages fetch on the server. For pages where search ranking matters most (events, student groups, news), compare before switching.
- The app menu bar on records, activities and feedback does not come from Plasmic; it reads `shared/menu.json` (see the main README). If the Plasmic header's menu items differ from that file, the two will differ.
- Visitors only download the Plasmic runtime on pages that really use a Plasmic design.
- Bands: give each band a Stack order one higher than the one above it (0 for the first); tick "Last section" on the final one so the footer tucks under it.
