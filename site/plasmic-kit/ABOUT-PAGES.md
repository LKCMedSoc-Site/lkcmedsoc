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

## House page layout (current)
`house-page.html` has a main column and a sticky side column, in house colour and white only (no purple).
- **Main column:** the write-up (optional, `hasAbout`), then the **House Cup** block (`id="house-cup"`): current placing, a link to `/about/house-system#house-cup`, and "Over the years".
- **Side column:** "Who leads it" (`$ctx.housePage.leaders`, already supplied by `buildBodyPage`), "Coming up" (`events`) and "From the news" (`posts`).
- The old "Meet the house" portrait block and "House activities" section were removed; their content lives in the side column.

## To do: House Cup (house points and ranking)
Nothing exists yet: the schema has no house points or ranking. The house page and house system page HTML already have places waiting for it. Build:

1. **Schema (SQL in `sql/`, same style as `honour_roll.sql`).** Suggested: `house_points(id, house_id, ay, points, reason, awarded_on, event_id null)`, plus a view `house_cup_totals(house_id, ay, points, rank)` that sums per house per AY and ranks them (ties share a rank). Houses are rows in `bodies` with `level = 'House'`. Decide and record whether AY results are "final" once the year closes (e.g. `house_cup_years(ay, is_final)`).
2. **Public read access.** Anonymous read on the totals view (and on `house_points` if a breakdown is shown), as with `stream_reps_public.sql` / `vice_chairs_public.sql`. Check RLS.
3. **Data loader.** A function in `site/src/lib/` (like `honour.ts`) returning per-house totals and ranks for every AY, using `ay_layer.sql` for AY labels and current AY.
4. **Extend `buildBodyPage` (kind `house`) in `site/src/lib/body-page.ts`** with:
   - `currentPlacing`: `{ ay, rank, rankLabel ("1st", "2nd"…), points, isFinal }`
   - `placings`: list of `{ ay, rank, rankLabel, points }`, newest first, past years only
   - `hasPlacings`: true when there is any current or past placing
   Add the same empty values to `BASE_EMPTY`. `HousePageHub` (`components/hubs/BodyHubs.tsx`) passes them through; re-register if props change (`plasmic-init-client.tsx`) and use the "props refresh" in Studio.
5. **Extend `buildHousesHub`** with the current AY's ranked list: `cup: { ay, isFinal, updatedText, rows: [{ rank, rankLabel, name, color, link, points }] }` and `hasCup`.
6. **House system page (`house-system-page.html`).** Replace the `id="house-cup"` placeholder with the ranked table (keep the id). Each row links to the house. Show the AY, a "final / so far" note and the last-updated date.
7. **Write path.** Decide who records points and where (a form in `records/`, or an import). Use the policy for who may award points, and log `awarded_on` and `reason`.
8. **Bind in Studio** once the data is live: house page (`currentPlacing`, `placings` repeat, empty state, `hasPlacings` visibility) and house system page (cup table). The house colour styling is already in the HTML.
9. **Follow-ups.** Add the House Cup to `SITEMAP.md` if it gets its own page or menu entry; add a House Cup figure to the Leadership page's house panels if wanted.
