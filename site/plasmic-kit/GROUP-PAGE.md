# One student group's page, built in Plasmic Studio

The page at `/student-groups/[committee]/[body]` (for example `/student-groups/careers/psychiatry-sig`). The coded page in `src/app/student-groups/[committee]/[body]/page.tsx` stays as the fallback and is replaced the moment a Plasmic page exists at that path.

## Look (decided)
- **A background hero with colour transparency.** The group's header photo fills the hero, under a see-through wash of the group's colour (about 80%), with a 36px slant at the bottom. No header photo: the colour alone is the hero.
- **The group's colour is the page's primary colour.** The hero wash, the headings, links, buttons, callouts, the "Who leads it" panel and the committee chips all take `$ctx.groupPage.color`. Never hard-code a colour in this page. Purple is not used for the content; it stays in the site header and footer.
- **Social links are icons.** Round outline icon buttons next to the Join button, one per link in `$ctx.groupPage.links`.

## Steps
1. Open `group-page.html` in this folder, copy it, and paste onto a new Studio page at `/student-groups/[committee]/[body]` (Cmd+V). The colours in it are placeholders (teal `#0f766e`); the bindings replace them.
2. Add **Group page hub (one group)** and put the whole page inside it. Set **Committee address** to `$ctx.params.committee` and **Group address** to `$ctx.params.body`. (Leave both empty while designing: a real group is shown as a preview.)
3. Bind the fields below. The `[BIND: …]` markers in the pasted HTML say which field goes where.
4. For the icon row, repeat ONE link over `$ctx.groupPage.links`: `href` = `currentItem.url`, and inside it put **Group page: social icon** with **Which icon** = `currentItem.kind`. Colour the icon like text (it uses the text colour).
5. For the write-up, delete the sample text and put **Group page: write-up** in its place. It draws the students' write-up with every block styled in the group's colour.
6. Visibility: the Join button when `hasJoin`; the icon row when `hasLinks`; the write-up when `hasAbout`; Coming up when `hasEvents`; From the news when `hasPosts`; the leaders list when `hasLeaders`; committee chips when `hasSiblings`.
7. Publish (the Director does this).

## `$ctx.groupPage`
`isLoading`, `notFound`, `name`, `description`, `initials`, `committee`, `committeeShort`, `committeeLink`, `link`, `logo`, `hasLogo`, `header`, `hasHeader`.
Colours (all from the group's own colour, else its committee's): `color` (the fill), `onColor` (always white), `tint` (light, see-through), `overlay` (stronger, for a wash over a photo).
`aboutHtml` and `hasAbout` (ready-made, safe HTML: use the **Group page: write-up** component rather than binding this).
`join` (`label`, `url`) and `hasJoin`. `links` (each `kind`, `label`, `url`) and `hasLinks`: Instagram, the group's other links, then the website, no repeats.
`ay`, `leaders` (each `name`, `title`, `photo`, `hasPhoto`, `initials`), `hasLeaders`.
`events` (each `id`, `title`, `venue`, `summary`, `whenText`, `startTime`, `day`, `monthShort`, `cover`, `hasCover`, `link`) and `hasEvents`: this group's upcoming events, at most 6.
`posts` (each `slug`, `title`, `summary`, `category`, `dateText`, `cover`, `hasCover`, `link`) and `hasPosts`: its news, at most 6.
`siblings` (each `name`, `link`, `color`, `onColor`, `tint`, `logo`) and `hasSiblings`: the other groups in its committee.

## What students can customise (in the Records app, Group pages)
Everything on the page is theirs to edit, the way a Notion page is:
- **Colour:** a preset or any colour (darkened only if white text would be hard to read).
- **Logo and header photo**, the **short description**, and the **join link**.
- **Icon links:** Instagram, website, plus any number (up to 10) of Telegram, TikTok, YouTube, Facebook, LinkedIn, WhatsApp, Discord, X, email and website links. The type is picked from the pasted link.
- **The write-up**, with a toolbar: headings (emoji work), bold, italic, links, lists, photos, **2 or 3 columns**, **toggles** (open/close sections), callouts, photo rows, pull quotes, join buttons, **YouTube/Vimeo videos** and dividers. Blocks can sit inside columns and toggles.

Block syntax (same in `records/pages.js` and `src/lib/markdown.ts`; keep them in step):
```
:::columns
## Left
text
|||
## Right
text
:::

:::toggle Who can join?
Any LKC student.
:::

:::video https://youtu.be/…
:::callout / :::photos / :::quote … :::
:::button Join us | https://…
```

## Before it works
Run `sql/body_socials.sql` once in the Supabase SQL editor (adds the icon-links list and the safe save function). The site and the Records app both work before that, just without the icon-links box.
