# Sitemap

Two parts: what the website serves today, and the structure agreed in discussion that is **not built yet**. Keep both in step with `site/src/app` and `site/next.config.ts`.

"In Plasmic?" means a page designed in Plasmic Studio at that path replaces the coded one (the page checks `plasmicData('<path>')`). "Coded only" means Plasmic cannot replace it.

## Today

| Address | What it is | In Plasmic? |
|---|---|---|
| `/` | Home | Yes |
| `/events` | Events list | Yes |
| `/events/[id]` | One event | Coded only |
| `/student-groups` | All groups (committees and CCAs) | Yes |
| `/student-groups/[committee]` | One committee | Coded only |
| `/student-groups/[committee]/[body]` | One group (CCA) | Coded only |
| `/gazette` | Gazette home | Yes |
| `/gazette/all` | Archive | Coded only |
| `/gazette/[slug]` | A story, or a category (the categories are data: Activities, Announcements, Creative, Publications and so on) | Coded only |
| `/gazette/[category]/[sub]` | A sub-category, e.g. `/gazette/creative/humans-of-med` | Coded only |
| `/about/meet-the-team` | Team | Yes |
| `/about/houses` | House system | Yes |
| `/about/honour-roll`, `/about/honour-roll/[ay]` | Honour roll, and one MedSoc term | Coded only |
| `/resources` | Resources and apps (one "Resources" menu, apps included) | Yes |
| `/policy` | Policy contents page (search, documents by tier) | Yes (readers; ExCo keep the coded page unless the design has the editing pieces) |
| `/policy/[slug]` | One policy document (`?v=N` for an older version) | Yes (same rule); `?v=` always coded |
| `/policy/[slug]/latest.pdf` | The document as a PDF (`?v=N` for an older version) | Coded only |
| `/sign-in` | Plain sign-in page (`?next=` says where to go afterwards: this site or another lkcmedsoc.com address). The header's Sign in button opens a lightbox instead; this page is for email links and links from the other apps. Not indexed | Coded only |
| `/policy/changelog` | Every change that has come into force | Coded only |
| `/president-message`, `/about/work-with-us`, `/about/alumni`, `/exco/ay26-27` | Plain text pages from `site/content/*.md` (the `[...slug]` catch-all). `/students-corner` redirects to `/resources` | Coded only |

Not pages: `/api/navigation` (the menu as JSON for the apps), `/plasmic-host` (Studio's host page), `/trial/...` (Plasmic-only sandbox, noindex).

Old Wix and renamed addresses redirect (see `site/next.config.ts`): `/news` and `/news/:slug` go to the Gazette, `/gazette/impact` and `/gazette/events` go to `/gazette/activities`, `/gazette/stories` to `/gazette/creative`, `/student-life/...` and `/student-ccas/...` to `/student-groups/...`, `/about` to `/about/meet-the-team`, and so on.

## Agreed structure (not built yet)

The Student Groups page lists every group (CCAs and committees' CCAs are the same thing: the bodies below a committee). Committees move under About. Houses get their own pages.

| Address | What it is | Replaces |
|---|---|---|
| `/student-groups` | All groups | unchanged |
| `/student-groups/[committee]/[body]` | One group's page | unchanged |
| `/about/leadership` | Every ExCo member (with a short description), every committee (each links to its committee page), year reps, and house reps. The house reps block links to the House System page and to each house's page | `/about/meet-the-team` |
| `/about/committee/[name]` | One committee, with its groups and its activities. There is **no** `/about/committee` index | `/student-groups/[committee]` |
| `/about/house-system` | Overview of the house system, every house name, and the house activities | `/about/houses` |
| `/about/house-system/[house]` | One house, with its people and its activities | new |
| `/about/honour-roll` | Menu of past terms | unchanged |
| `/about/honour-roll/[ay]` | One MedSoc term | unchanged |

To do when building it:

- Redirect `/student-groups/[committee]` to `/about/committee/[committee]`, `/about/houses` to `/about/house-system`, `/about/meet-the-team` and `/about` to `/about/leadership`. Re-point the old Wix redirects that target `/student-groups/<committee>`.
- Update the menu: `shared/menu.json` (copies synced with `node tools/sync-shared.mjs`) and `site/src/app/api/navigation/route.ts`, which builds the Student Groups children as `/student-groups/<committee>`. The other apps read that JSON, so change it in the same deploy.
- Move any Plasmic pages at the old paths in Studio, or the redirects will bypass them.
- Activities on committee and house pages need a body filter. Gazette posts already carry a body (`activities.posts.body_id`, shown as `body`, chosen in the Gazette editor, optional, and an event-linked post takes the event's body). Nothing filters posts or events by a single body yet; that is a data change, not only a routing one.
- The plain text pages (`/president-message`, `/about/work-with-us`, `/about/alumni`, `/exco/ay26-27`) are unchanged by this plan.
