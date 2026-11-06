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
