# Report for the HTML agent (LKCMedSoc website)

From the backend and repo agent. Last reviewed 2026-11-12. Everything below is live on `main` unless it says "not built yet".
Read `STUDIO-BROWSER-GUIDE.md` (how bindings are done in Studio) and `DATA-CHEATSHEET.md` (field and action lists) alongside this.

## 1. Who does what
| HTML agent | Backend / repo agent | Director (in Plasmic Studio) |
|---|---|---|
| The LOOK of pieces: heroes, cards, chips, toolbars, pagination, panels, footer. Static, inline-styled HTML, one paste per page. | Data, filters, paging, server rendering, the header block, motion rules, tokens, database, git. | Pastes the HTML, then (with an agent) binds fields to data and actions in Studio. |

Do NOT add behaviour or data to the HTML. Do not build filters that "work". Draw how they look; the bindings are done afterwards (section 4).

## 2. Design system (keep exactly)

**Direction.** NYU Casa Italiana's editorial structure (split dark hero masthead over a photo, clean toolbars, borderless cards with a bottom divider link) in our colours and fonts, plus gentle 36px diagonal slants on heroes and vibrant accents. Pale page, one dark plum hero and footer, generous white space.

**Brand colours** (hex only, use exactly these):
| Role | Hex |
|---|---|
| Page canvas | `#f5eff5` |
| Darkest plum: hero, header, footer | `#2a0628` |
| Plum: headings, filled buttons | `#4d0a49` |
| Magenta: eyebrows, accents | `#8e2a88` |
| Orchid: soft text on dark panels | `#d3a6cf` |
| Mist: search box, default fills, callouts | `#ebe1fa` |
| Lilac: dark-mode eyebrows and dates | `#c3a1f2` |
| Pink: buttons on dark panels, dots | `#ff9fe6` |
| Body text | `#2a0f28` |
| Muted text | `#6a5a69` |
| Hairlines and dividers | `#ddd2dc` |
| White | `#ffffff` |

**Yellow is no longer used.** An old notice-strip yellow (`#e9ee2e`) exists in the code only for the legacy notice feature; do not use it in new HTML. The colour of the notice strip is open: ask the Director.

**Committee and group colours are separate from the brand palette.** Each body (committee or CCA) stores a colour NAME in the database; the site turns it into one of eight vivid, non-purple colours so committees stand out against the purple site. Purple, magenta and plum are NOT available to bodies. Every one takes white text. Do not hard-code them in layouts; in sample HTML use any one (teal `#0f766e` is the placeholder) and the bindings replace it.
| Name | Hex |
|---|---|
| blue | `#1d4ed8` |
| cyan | `#0e7490` |
| teal | `#0f766e` |
| green | `#15803d` |
| amber | `#b45309` |
| orange | `#c2410c` |
| red | `#b91c1c` |
| slate | `#475569` |

A body with no colour gets one picked from its name, chosen so committees never share a colour (while colours remain). A CCA with no colour takes its committee's. Four derived values come with every body, all bound in Studio: `color` (the fill), `onColor` (always white), `tint` (about 12% see-through, for light resting states) and `overlay` (about 55% see-through, a wash over a photo). Source: `site/src/lib/tones.ts`.

**Fonts.** `'DIN Engschrift', 'Arial Narrow', sans-serif` for page titles and big headings only: uppercase, line-height 0.88 to 0.94, letter-spacing 0.01em (hero 96px, spotlight and callout titles 44px, card titles 32px). `'DIN', Arial, sans-serif` for everything else.

**Shape.** Panels and card pictures 8px or 12px radius (cards: 12px); buttons, chips and pills fully rounded (999px); 1px borders; no heavy shadows. The site adds a soft hover shadow automatically; do not draw one.

**Page structure.** The fixed header is 64px tall. Every full-width outer box is `width:100%` and a flex column with `align-items:center` (Plasmic drops centring otherwise). Every inner container is `width:100%; max-width:1152px; margin:0 auto; padding:0 16px; box-sizing:border-box`, which lines up with the header logo and Apply button. A hero has `padding:136px 0 0` on its outer box.

**Hero (three parts on every page):** a photo overlay (`<img>` absolutely positioned, `object-fit:cover`, `opacity:0.18`); a large decorative graphic on the right; and a 36px bottom slant, an `<img>` with a data-URI polygon filled `#f5eff5`. The graphic is now a Plasmic ICON that uses `currentColor`, so its colour is changed in Studio's Design tab, not in a URL. In pasted HTML a linked SVG `<img>` cannot be recoloured; paste the raw `<svg>` with `fill="currentColor"` (Iconify's SVG endpoint without a colour does this) and the Director pastes it directly.

**Footer.** Built. See `footer.html` here. Dark `#2a0628`, a 36px slant from the page colour at the top, three columns (identity and Apply, Explore, Follow), a large ghost wordmark and a copyright line. If a Plasmic component named exactly `Footer` is published it replaces the coded footer on every page.

## 3. HTML rules
Inline `style` only; flexbox only; one root element per piece (one paste per page); no `<style>`, classes, scripts or `<input>`/`<select>` (draw a search box as a rounded `<div>`); `<a>` for links, `<button>` for buttons.
Write `display:flex`, never `inline-flex`. Never put `display:block` on an `<img>`. Never use the `gap:` shorthand: write `column-gap:...; row-gap:...;` (the shorthand makes Plasmic warn).
Pictures: `<img src="https://placehold.co/640x360/ebe1fa/4d0a49?text=Image" alt="...">`. Arrows as text "→".
Dynamic text spans must say what they bind, so Plasmic labels the layer: `[BIND: currentItem.name]`, `[BIND: $ctx.groupsHub.countText]`.
The site adds motion automatically, so do not fake it. It only works with the right structure:
- A whole card is ONE `<a>`, so it lifts 2px with a soft shadow on hover. Give it `flex:1 1 250px; width:100%; max-width:360px`.
- An `<img>` inside an `<a>` zooms to 1.05. Keep it alone in its own `overflow:hidden` box.
- A trailing arrow must be the LAST child beside a sibling text span so it slides 4px.
- Buttons and button-like links rise 2px with a soft shadow on hover and press down on click.

## 4. What data exists
Field lists: `DATA-CHEATSHEET.md`. Context names: `$ctx.groupsHub`, `$ctx.eventsHub`, `$ctx.newsHub`, `$ctx.peopleHub`.

| Piece | Bound to | Fields to imitate |
|---|---|---|
| Event card | `eventsHub.items[i]` | title, whenText, day, monthShort, venue, summary, committeeShort, spotsText, cover (hasCover), link |
| Event spotlight | `eventsHub.next` | same fields, plus `notice` (show, text, link) |
| Gazette (news) card | `newsHub.items[i]`; lead story `newsHub.first` | title, summary, categoryLabel (+ categoryColor, categoryOnColor, categoryTint), dateText, from, cover (hasCover), link |
| Group card | `groupsHub.items[i]` | name, description, chair, committeeShort, color, onColor, tint, overlay, header, logo, initials, link |
| Person card | `peopleHub.exco / committeeHeads / yearReps / streamReps [i]` | name, title, photo (hasPhoto), initials, group, link |
| Committee chip | `groupsHub.committees[i]` | short, count, color, onColor, tint, isSelected, slug |
| Search bar | `activeSearch`, action `setSearch` | placeholder text only |
| Pagination | `pageText`, `pages[]` (number, isCurrent), `hasPrevPage`, `hasNextPage` | "Page 2 of 5", numbered buttons |
| Result count | `countText` | "52 groups" |

Design cards for the thin real data:
- **No picture.** Only about 1 of 52 groups has a header image. The group card is ONE image block that works both ways: a solid body-colour box that shows the logo (or the initials) centred, with the photo and a body-colour wash over it when a photo exists.
- **Empty text.** All group descriptions are empty today, and event blurbs are often empty. Layouts must survive a missing line.
- Design for 20+ items and several pages (groups are 12 per page).

## 5. State and look
- **Committee chip:** light at rest (the `tint` fill, `color` text and border), solid when pressed (`color` fill, white text). No dot. The count uses the text colour at about 75% opacity, never a fixed grey.
- **Committee pill under a card:** `tint` background with `color` text.
- **Page numbers:** the current page is solid plum with white text; the others are white with plum text.
- Several chips can be on at once in groups, events and news.
- Draw enabled and disabled versions of Previous and Next if needed.
- Do not draw hover; the site adds it.

## 6. Not built yet
A carousel; an events Month view and List/Month toggle; a utility row above the header. Events does not yet use the stored committee colours (it has none). The Gazette colours stories by category, not committee. The news page is now the Gazette at `/gazette` (the old `/news` route is gone); its hub is still `newsHub`. Recruiting is removed entirely: do not draw a Recruiting tag or filter. Legacy: `GroupsBrowser.tsx` (the coded Student Groups page, shown only if the Plasmic page is down) still uses its own old purple colour list.

## 7. Header
The header is a registered block ("Site header (editable content)"), not HTML. Its logo text, menu items, drop-down links, highlight cards and Apply button are settings in Studio. Do not draw one; describe changes to the Director.

## 8. Working files in this folder
`filter-chip.html`, `group-card.html`, `search-bar.html`, `footer.html` and `gazette-page.html` (a whole page in one paste) are current patterns: copy their structure and styling for new pages. They use placeholder text and a teal placeholder colour.

## 9. Open decisions
- The notice strip colour, now that yellow is retired.
- Event cover shape: currently cropped to 16:9 on upload. Recommended: keep the original proportions and let each design crop (fixed-height image area, `object-fit:cover`).
