# Report for the HTML agent (LKCMedSoc website)

From the backend and repo agent. Everything below is live on `main` unless it says "not built yet".

## 1. Who does what
| HTML agent (you) | Backend / repo agent (me) | Director (in Plasmic Studio) |
|---|---|---|
| The LOOK of pieces: cards, chips, search bar, toolbars, pagination, panels, heroes. Static, inline-styled HTML. | Data, filters, paging, server rendering, the header block, motion rules, tokens, database, git. | Pastes your HTML, extracts components, binds fields to data, sets responsive layout, copy and images. |

Do NOT add behaviour or data to the HTML. Do not build filters that "work". Draw how they look; the Director wires them to data and actions that already exist (section 4).

## 2. Design system (keep exactly)
Colours (hex only): page `#f5eff5` · darkest plum `#2a0628` (dark panels, header, footer) · plum `#4d0a49` (headings, filled buttons) · magenta `#8e2a88` · orchid `#d3a6cf` · mist `#ebe1fa` · lilac `#c3a1f2` · pink `#ff9fe6` (accent button on dark) · yellow `#e9ee2e` (notices only) · text `#2a0f28` · muted `#6a5a69` · line `#ddd2dc` · white.
Fonts: `'DIN Engschrift', 'Arial Narrow', sans-serif` for large page titles and big section headings only; `'DIN', Arial, sans-serif` for everything else.
Shape: panels and card images 8px radius; buttons, chips and tags fully rounded (999px); 1px borders; almost no shadow.
Direction: the Casa Italiana reference with OUR colours and fonts. Pale page, contained rounded panels, dark plum emphasis panels, generous white space, no diagonal shapes. NOT in the repo (do not assume them): warm paper tokens (`#faf8fa`, `#f4f1ea`, `#dfd9ce` and similar) and "stopper" divs. If you want warm neutrals, ask the Director first.

## 3. HTML rules
Inline `style` only; flexbox only; one root element per piece; no `<style>`, classes, scripts, hover CSS or transitions; `<a>` for links, `<button>` for buttons, `<div>` for boxes; no `<input>`/`<select>` (draw the field as a rounded box with placeholder text); widths in % or max-width; cards `width:100%`; pictures as `<img src="https://placehold.co/640x360/ebe1fa/4d0a49?text=Image" alt="...">`; arrows as text "→" "←".
The site adds motion automatically, so do not fake it. It works only when the structure is right:
- A whole card must be ONE `<a>` wrapping its content, so it lifts 2px on hover.
- An `<img>` inside an `<a>` zooms to 1.05. Keep the image alone in its own wrapper box so the zoom is clipped.
- A trailing arrow must be the LAST child next to other content (e.g. "View details" then "→"), so it slides 4px. Caution: the last text in any link with two or more children also slides.
- Links and buttons press down slightly on click.

## 4. What data exists, so sample text matches the real fields
Full field lists: `site/plasmic-kit/DATA-CHEATSHEET.md`. Context names: `$ctx.groupsHub`, `$ctx.eventsHub`, `$ctx.newsHub`, `$ctx.peopleHub`. All render on the server, with live data in the first HTML.

| Piece | Bound to | Fields to imitate in sample text |
|---|---|---|
| Event card | `eventsHub.items[i]` | title, whenText, day, monthShort, venue, summary, committeeShort, spotsText, cover (hasCover), link |
| Event spotlight / banner | `eventsHub.next` | same fields; `notice` (show, text, link) for the yellow strip |
| News card | `newsHub.items[i]` | title, summary, category (+ categoryColor, categoryOnColor), dateText, from, cover (hasCover), link |
| Group card | `groupsHub.items[i]` | name, description, chair, committeeShort (+ color, onColor), header, logo, initials, link |
| Person card | `peopleHub.exco / committeeHeads / yearReps / streamReps [i]` | name, title, photo (hasPhoto), initials, group, link |
| Filter chip | `committees[i]` / `categories[i]` / `months[i]` | label, count, a colour dot, isSelected |
| Search bar | `activeSearch` | placeholder text only |
| Checkbox facet row | `selectedCommitteeMap[name]` / `selectedCategoryMap[name]` | label, count, checked |
| Pagination | `hasPrevPage`, `hasNextPage`, `pageText`, `pages[]`, `rangeFrom`, `rangeTo` | "Page 2 of 5", "6 to 10 of 23", numbered buttons |
| Result count / empty / loading | `countText`, `hasMatches`, `isLoading` | "12 events match", an empty message |

Design every card in TWO versions, because the real data is thin:
- **No image.** Event covers are optional. Only about 1 of 52 groups has a header image. Draw a good fallback (a block in the committee colour with the initials) as its own separate piece.
- **Empty text.** All group descriptions are empty today and the single event has no public blurb. Layouts must not break when a line is missing.
- Sample sizes are small now (1 upcoming event, 23 stories, 52 groups), but design for 20+ items and for several pages.

## 5. State and variants
- Chips and checkbox rows: give a default and a selected version (selected is filled plum with white text). The Director binds the variant to `isSelected`.
- Several chips or checkboxes can be on at once in groups, events and news.
- Pagination: draw enabled and disabled versions of the prev and next buttons.
- Draw a hover-free version only; hover is added by the site.

## 6. Not built yet (don't design around these as if they exist)
A carousel with prev/next arrows (coming, behaviour from me); a Month view and a List/Month toggle for events (needs code); the style tokens for radius and spacing (coming); a utility row above the header (social icons, search, outlined button) as an option on the header block (coming). Recruiting is removed entirely: do not draw a "Recruiting" tag or filter.

## 7. Header
The header is a registered block ("Site header (editable content)"), not HTML. Its logo text, menu items, drop-down links, highlight cards and Apply button are settings in Studio. Do not draw a header to paste; draw other page parts and, if you want changes to the header, describe them to me.

## 8. How to hand work back to me
Send HTML or a screenshot of it in Studio and I will check: exact palette and fonts, real link and button tags, phone-width behaviour, and whether the sample fields match section 4. For a piece that must bind to many fields I can also write the HTML myself.

## 9. Open decisions
- Event cover shape: currently cropped to 16:9 on upload. Recommended: keep the original proportions and let each design crop it. Awaiting the Director's choice. Design cards so they work with a cover in any shape (fixed-height image area, object-fit cover).
