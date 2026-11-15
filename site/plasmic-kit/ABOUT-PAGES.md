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

## House Cup data (built: lookups are live, Studio bindings still to do)
House points are entered by ExCo on the activities site (`#/house-cup`, built in `activities-site/housecup.js`). Database: `sql/house_cup.sql`.

**How the score works (so the copy is right).** Each academic year (AY) has its own list of *reasons* (Sports Day, Quiz Night...). A reason has one entry: points for every house, and a weight (%). A house's score for a reason is its **share** of the points all houses earned for that reason, times the weight. A house's `points` below is its **total score out of 100**, not raw points. Ties share a rank. The public never receives raw points. Weights are scaled to 100 if they do not add up yet, and a year is `isFinal` once ExCo locks it.

**Where the data comes from.** `src/lib/house-cup.ts` loads `activities.house_cup(ay)` for every year that has results. It is seeded on the server like the other hubs (`hub-seed.ts`, only when the page uses `HousePageHub` or `HousesHub`) and falls back to loading in the browser. Plasmic registration did not change, so no props refresh is needed in Studio.

### `$ctx.housePage` (HousePageHub), new fields
| Field | Type | Meaning |
|---|---|---|
| `currentPlacing` | object | This house's place in the **current AY** (the year in `$ctx.housePage.ay`). Fields below. Empty strings when the year has no results yet. |
| `hasCurrentPlacing` | bool | Use for visibility of the "current placing" figure. |
| `placings` | list | Places in **every other year** that has results, newest first. Each item has the same fields as `currentPlacing`. |
| `hasPastPlacings` | bool | Visibility of the "Over the years" strip; show the empty state when false. |
| `hasPlacings` | bool | True if there is a current or any past placing. Visibility of the whole House Cup block (`id="house-cup"`). |

Fields of `currentPlacing` and of each `placings` item (`currentItem.` inside the repeat): `ay` ("AY26/27"), `rank` (number), `rankLabel` ("1st", "2nd"), `points` (text, score out of 100, e.g. "55.5"), `isFinal` (bool), `statusText` ("Final" or "So far"). On committee pages these are all empty.

### `$ctx.housesHub` (HousesHub), new fields
| Field | Type | Meaning |
|---|---|---|
| `cup` | object | The current AY's table. |
| `hasCup` | bool | Visibility of the ranked table; show a "no results yet" line when false. Keep `id="house-cup"` on the block either way. |

`cup.ay` ("AY26/27"), `cup.isFinal`, `cup.statusText` ("Final results" or "Results so far"), `cup.updatedText` ("Updated 12 Nov"). `cup.rows`: houses in rank order (repeat over this), each with `rank`, `rankLabel`, `name`, `link` (the house page), `points` (score out of 100), and the house colours `color`, `onColor`, `tint`, `initials`. `cup.reasons`: the year's reasons for a "how it is scored" list, each with `name` and `weightText` ("20%").

Rows tie on rank (two houses can both be "2nd"), so show `rankLabel`, not the row position.

### Where it goes in the HTML
- `house-page.html`: the `id="house-cup"` block (current placing, "Over the years").
- `house-system-page.html`: the `id="house-cup"` block (ranked table).

### Still to do
- Bind the two HTML pages in Studio (use `plasmic-kit/STUDIO-BROWSER-GUIDE.md`).
- Optional: a House Cup figure on the Leadership page's house panels; a menu entry if it gets its own page.
- Who edits: only ExCo today (`activities.is_exco()` in `house_cup_guard`).
