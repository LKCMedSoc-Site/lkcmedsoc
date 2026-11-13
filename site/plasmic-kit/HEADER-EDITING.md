# Editing the site header

The header is one block, **Site header (editable content)**, inside a Plasmic component called **Site header**, which every page uses. You can change its words, links and buttons in Studio without any code. Its look and behaviour are code (see the last section).

## Change the words and links (no code)

1. Open Plasmic Studio, open the **Site header** component (from any page: select the header, click the blue "Site header" link in the right panel).
2. In the left layers list, click **Site header (editable content)**.
3. Edit it in the right-hand **Settings** panel:

| Setting | What it changes |
|---|---|
| Logo text | The name at the left |
| Words beside the logo | The small line beside it on wide screens |
| Menu items | The top-level menu. Click an item to change its label, link and one-line description, and to add, remove or reorder the links in its drop-down |
| Highlight cards | An optional card beside one drop-down (small label, title, text, link) |
| Button text / Button link | The pink Apply button |
| Show the Sign in button / Sign in button text | The Sign in button. Off hides it everywhere, including on phones |
| Slide away when scrolling down | Whether the bar hides while scrolling down |
| Show this drop-down open (Studio only) | Holds a drop-down open on the canvas so you can see it. Does nothing on the live site |

4. Press **Publish** (top right). The live site can take about 5 minutes to change.

## Rules that save trouble

- **Menu items you edit here replace the shared menu for this header only.** The other apps (records, activities, feedback) read `shared/menu.json`, not Studio. When the sitemap changes, update both: the Studio menu items and `shared/menu.json` (then run `node tools/sync-shared.mjs`).
- **Student Groups' drop-down fills itself from the database** when you leave its drop-down links empty. Leave them empty.
- Menu paths must match `SITEMAP.md`. A link to a page that does not exist is a 404.
- Links starting with `/` stay on this site. Links starting with `https://` open the other apps; tick nothing extra, they open in a new tab.

## Sign in

- The button opens a lightbox with the sign-in form. After signing in it shows the person's first letter with a Sign out menu. On phones it is the first row in the menu sheet.
- One sign-in works on every LKCMedSoc address, because the session cookie is shared across `lkcmedsoc.com` and its subdomains.
- `/sign-in?next=/some/page` is the plain page for email links. `next` can be a page on this site or another `lkcmedsoc.com` address; anything else goes to the home page.
- Supabase: every site address must be listed under Authentication > URL Configuration > Redirect URLs, or confirmation and reset emails will not return people to the right place.

## What needs a developer (code)

These are not editable in Studio: colours, fonts, the 64px height, spacing and the shape of the Apply button; moving the search or button; the drop-down animation; the phone menu layout; the sign-in lightbox and its form. They live in `site/src/components/Header.tsx`, `nav/NavMenu.tsx`, `nav/MobileMenu.tsx`, `nav/AccountButton.tsx` and `nav/SignInDialog.tsx`.
