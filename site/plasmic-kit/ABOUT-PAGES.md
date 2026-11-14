# About pages (HTML looks)

Four pages from the agreed structure in `SITEMAP.md`. The HTML is the look only; the `[BIND: …]` markers say what goes where. Colours in the committee and house pages are placeholders (teal `#0f766e`, house red `#b91c1c`); the bindings replace them, as on the group page.

| File | Address | Hub it needs |
|---|---|---|
| `leadership-page.html` | `/about/leadership` | `peopleHub` (exists) plus new fields, below |
| `committee-page.html` | `/about/committee/[name]` | new `committeePage` hub |
| `house-system-page.html` | `/about/house-system` | new `housesHub` |
| `house-page.html` | `/about/house-system/[house]` | new `housePage` hub (may reuse `groupPage`) |

## Not built yet (backend)
- **Leadership:** `peopleHub.exco[i].description` (short line per ExCo member), `peopleHub.committees[i].color / head.title / head.initials`, and a new `peopleHub.houses` list (name, link, color, reps).
- **Committee page:** `name, short, description, color, ay, leaders, groups` (group card fields), `events`, `posts`, `hasLeaders, hasEvents, hasPosts`. Events and posts must include every group under the committee.
- **House pages:** same shape; `housesHub` gives `items` (name, initials, description, color, link), `intro`, `howItWorks`, `events`, `posts`.
- **Activities need a body filter.** Nothing filters posts or events by one body yet (see "To do" in `SITEMAP.md`).
- **Redirects, menu and moving old Plasmic pages** are also in that to-do list.

## Look decisions
- Leadership uses the dark plum hero (brand palette) with an anchor bar; committee and house pages use the group-page hero: colour wash over a photo, the body's colour as the page's primary colour.
- Committee cards on Leadership are filled with the committee's colour; house panels get a coloured top border.
- Same side-column pattern as the group page: sticky, Top 96px, Align self start.
