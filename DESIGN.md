# Design rules

The single source for how LKCMedSoc UI looks. It covers the public website (`site/`, coded pages and Plasmic pages) and, where noted, the internal apps (`activities-site/`, `feedback-site/`, `gazette-site/`, `records/`). Read it before building or changing any UI.

Related files: `PRODUCT.md` (who and what for), `site/src/app/globals.css` (the tokens, the source of truth for values), `site/plasmic-kit/HTML-AGENT-REPORT.md` (the brief for the agent that draws pieces for Plasmic; it follows these rules and adds the HTML-only constraints).

## Direction
NYU Casa Italiana's editorial structure (a split dark masthead, clean toolbars, borderless cards with a bottom divider link) in our colours and fonts. Pale page, one dark plum masthead and footer, generous white space, real photographs over decoration, gentle diagonal slants on heroes and bands, vibrant accents.

## Colour
Tokens live in the `@theme` block of `site/src/app/globals.css`. Use the tokens in code, never a one-off hex.

| Role | Token | Hex |
|---|---|---|
| Page canvas | `p50` | `#f5eff5` |
| Darkest plum: masthead, header, footer, dark panels | `p950` | `#2a0628` |
| Plum: headings, filled buttons | `p900` | `#4d0a49` |
| Magenta: eyebrows, accents | `p500` | `#8e2a88` |
| Orchid: soft text on dark | `p300` | `#d3a6cf` |
| Mist: search boxes, default fills, callouts | `mist` | `#ebe1fa` |
| Lilac: eyebrows and dates on dark | `lilac` | `#c3a1f2` |
| Pink: buttons on dark panels | `pink` | `#ff9fe6` |
| Body text / muted / hairlines | `ink` / `muted` / `line` | `#2a0f28` / `#6a5a69` / `#ddd2dc` |
| Success / error | `ok` / `bad` | `#1d7a4d` / `#b3261e` |

- **Yellow is retired.** `acid` (`#e9ee2e`) stays in the code only for the legacy notice strip. Do not use it in new work. The notice strip's new colour is an open decision.
- **Committee and group colours are separate from the brand palette.** Each body stores a colour name in `records.bodies.color`; `site/src/lib/tones.ts` turns it into one of eight vivid, non-purple colours (blue, cyan, teal, green, amber, orange, red, slate), each with white text. Purple, magenta and plum are never given to a body. Never hard-code a body colour in a layout: use the derived `color` (fill), `onColor` (white), `tint` (about 12% see-through, for light resting states) and `overlay` (about 55%, a wash over a photo).
- Contrast: AA for text. Do not rely on colour alone to show state.

## Type
- `DIN Engschrift` (the `display` class): page titles and big headings only. Uppercase, line-height .88 to .94, letter-spacing .01em.
- `DIN` (the default sans): everything else. Hosted in Supabase storage (`fonts` bucket); the site falls back to Arial and system fonts.
- Small labels (`eyebrow`): 0.8rem, bold, uppercase, wide tracking, magenta (lilac on dark).

## Shape and depth
- Cards and pictures: 8px to 12px radius. Buttons, chips and pills: fully rounded (999px). 1px borders. No heavy shadows; the site adds a soft one on hover.
- Heroes and bands end on a slant (`band` classes in `globals.css`; 36px in Plasmic heroes). The first band is the dark plum masthead, the last band carries `band-last` so the footer tucks under it.

## Layout
- Content container: `max-w-6xl` with 16px side padding (1152px max in Plasmic pieces), aligned with the header logo and the Apply button.
- Header is 64px and fixed. Mobile first: every page works at 375px with no horizontal scroll.
- Plain flat sections inside one band suit dense reading pages (the Gazette home uses a masthead band and one pale band). Stack many slanted bands only on marketing pages such as the home page.

## Components
- **Cards:** a whole card is one link. Image on top (4:3 for lists, 16:10 for features), date and body in small muted text, a bold headline, a short clamped summary. Provide a no-picture fallback (a plum panel with the wordmark, or a body-colour block with initials) because most real data has no picture.
- **Chips and filters:** light at rest (`tint` fill, `color` text and border), solid when selected. Several can be on at once. The count uses the text colour at about 75%, never a fixed grey.
- **Buttons:** pill-shaped. Plum fill on light panels, pink fill on dark panels. A disabled state for Previous and Next.
- **Pagination:** the current page is solid plum with white text, the others white with plum text.
- **Empty and thin data:** every layout must survive a missing summary, picture, or body. Design for 20+ items and several pages.
- **Category labels (Gazette):** Impact, Event write-ups, Announcements, Stories. Known deviation: `NewsCard` and `NewsHub` still colour category pills with the old four-colour set (including yellow for Announcements). Replace with plum, magenta, lilac and orchid variants when that code is next touched.

## Motion
Defined in `globals.css` and switched off for people who ask for reduced motion. Do not fake it in markup.
- Cards lift 2px with a soft shadow on hover; a picture inside a link zooms to 1.04 to 1.05 (keep it alone in an `overflow:hidden` box); a trailing arrow slides 4px; buttons rise 2px and press down on click. Hover effects only where there is a real mouse.
- Entrances (`reveal`, `rise`) are short and used sparingly.

## Accessibility
Visible focus states (magenta outline). Respect `prefers-reduced-motion`. Real links and buttons, labelled form fields, alt text on informative pictures. Sections have headings in order.

## Internal apps
`activities-site/`, `feedback-site/`, `gazette-site/` and `records/` are plain HTML, CSS and JavaScript with their own `style.css`, built to the same palette and fonts. Their tokens are close to the site's, but the darkest plum there is `#3a0a2e` (`--p900`) where the site uses `#2a0628` (`p950`). Keep new internal screens on the app's own `style.css` tokens. The shared menu bar (`suite-nav.js`) is the same everywhere and sets the dark `#2a0628` strip on top.

## Plasmic
Pages can be designed in Plasmic Studio and replace the coded page at the same path (`plasmicData('/path')`). Coded pages stay as the fallback. Registered blocks, tokens and the HTML constraints for pasted pieces are in `site/README.md` and `site/plasmic-kit/`.
