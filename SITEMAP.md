# Sitemap

What the website serves today, plus notes on the structure. Keep it in step with `site/src/app` and `site/next.config.ts`.

"In Plasmic?" means a page designed in Plasmic Studio at that path replaces the coded one (the page checks `plasmicData('<path>')`). "Coded only" means Plasmic cannot replace it.

## Today

| Address | What it is | In Plasmic? |
|---|---|---|
| `/` | Home | Yes |
| `/events` | Events list | Yes |
| `/events/[id]` | One event | Coded only |
| `/student-groups` | All groups (committees and CCAs) | Yes |
| `/student-groups/[committee]/[body]` | One group (CCA) | Coded only |
| `/gazette` | Gazette home | Yes |
| `/gazette/all` | Archive | Coded only |
| `/gazette/[slug]` | A story, or a category (the categories are data: Activities, Announcements, Creative, Publications and so on) | Coded only |
| `/gazette/[category]/[sub]` | A sub-category, e.g. `/gazette/creative/humans-of-med` | Coded only |
| `/about` | About: mission, structure, history, links to the rest | Yes |
| `/about/leadership` | Every ExCo member, committee, year rep and house rep | Yes |
| `/about/house-system` | Overview of the house system and every house | Yes |
| `/about/house-system/[house]` | One house, with its reps | Yes |
| `/about/committee/[committee]` | One committee and its groups (there is no `/about/committee` index) | Yes |
| `/about/honour-roll`, `/about/honour-roll/[ay]` | Honour roll, and one MedSoc term | Coded only |
| `/resources` | Resources and apps (one "Resources" menu, apps included) | Yes |
| `/policy` | Policy contents page (search, documents by tier) | Yes (readers; ExCo keep the coded page unless the design has the editing pieces) |
| `/policy/[slug]` | One policy document (`?v=N` for an older version) | Yes (same rule); `?v=` always coded |
| `/policy/[slug]/latest.pdf` | The document as a PDF (`?v=N` for an older version) | Coded only |
| `/sign-in` | Plain sign-in page (`?next=` says where to go afterwards: this site or another lkcmedsoc.com address). The header's Sign in button opens a lightbox instead; this page is for email links and links from the other apps. Not indexed | Coded only |
| `/policy/changelog` | Every change that has come into force | Coded only |
| `/president-message`, `/about/work-with-us`, `/about/alumni` | Plain text pages from `site/content/*.md` (the `[...slug]` catch-all). `/students-corner` redirects to `/resources` | Coded only |

Not pages: `/api/navigation` (the menu as JSON for the apps), `/plasmic-host` (Studio's host page), `/trial/...` (Plasmic-only sandbox, noindex).

Old Wix and renamed addresses redirect (see `site/next.config.ts`): `/news` and `/news/:slug` go to the Gazette, `/gazette/impact` and `/gazette/events` go to `/gazette/activities`, `/gazette/stories` to `/gazette/creative`, `/student-life/...` and `/student-ccas/...` to `/student-groups/...`, and so on.

## Structure notes

- Committees live under About: `/about/committee/[committee]`. `/student-groups` lists every group; `/student-groups/[committee]/[body]` is one group's page.
- Redirects (see `site/next.config.ts`): `/about/meet-the-team` to `/about/leadership`, `/about/houses` to `/about/house-system`, `/student-groups/[committee]` to `/about/committee/[committee]`, `/exco/ay26-27` to `/about/honour-roll/ay26-27`. The old Wix committee addresses point straight at `/about/committee/...`.
- The menu is `shared/menu.json` (copies synced with `node tools/sync-shared.mjs`). The Student Groups drop-down fills from the database and its committee links go to `/about/committee/<slug>`. A menu edited inside the Plasmic header block replaces the shared one for that header only, so keep it in step.
- Back links: Leadership, House system and Honour roll go "← About"; a committee goes "← Leadership"; a house goes "← House system"; a term goes "← Honour roll".
- Still to do: Plasmic pages at the new paths (the HTML is in `site/plasmic-kit`: `about-page.html`, `leadership-page.html`, `house-system-page.html`, `house-page.html`, `committee-page.html`), the hubs they need (`committeePage`, `housesHub`, `housePage`), and a body filter so committee and house pages can show their own events and news.
- The plain text pages (`/president-message`, `/about/work-with-us`, `/about/alumni`) are unchanged.
