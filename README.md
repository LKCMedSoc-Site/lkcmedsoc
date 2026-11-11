# LKCMedSoc

Code for the LKCMedSoc website and internal tools. This repository is public: it must never contain keys, passwords, spreadsheets or any personal data. The keys that appear in `config.js` files are the *publishable* kind, which are public by design; the database rules protect the data.

| Folder | What it is | Address | Hosted on |
|---|---|---|---|
| `site/` | Public website (Next.js; layout edited in Plasmic) | lkcmedsoc.com | Vercel |
| `activities-site/` | LKCMedSoc Activities: events, write-ups and approvals | activities.lkcmedsoc.com | Vercel |
| `gazette-site/` | LKCMedSoc Gazette: write, review, publish and curate posts (shares the post tables with Activities) | gazette.lkcmedsoc.com | Vercel |
| `feedback-site/` | LKCMedSoc Feedback: suggestions, issues and SSLG meetings | feedback.lkcmedsoc.com | Vercel |
| `records/` | Leadership and participation records | records.lkcmedsoc.com | Vercel |
| `Inventory/` | Inventory app | inventory.lkcmedsoc.com | Vercel |
| `sql/` | Database set-up files (Supabase project: lkcmedsoc-inventory) | not hosted | none |

**Design:** UI rules (colour, type, shape, components, motion) are in `DESIGN.md`; product context is in `PRODUCT.md`.

Each folder is its own Vercel project: set the project's "Root Directory" to the folder name. DNS for lkcmedsoc.com is on Cloudflare.

**One menu:** the site menu is `shared/menu.json`. The website header reads it, and `records/`, `activities-site/` and `feedback-site/` show it as a bar across the top (`suite-nav.js`, in each folder). Each app carries its own copy, so nothing depends on another site being reachable.

**One sign-in:** `records/`, `activities-site/` and `feedback-site/` (and the main site) keep the Supabase session in a cookie shared across `lkcmedsoc.com` and its subdomains (`sso.js` in each folder, `site/src/lib/sso.ts` for the website), so signing in or out on one does it for all.  On other addresses (localhost, preview links) each site falls back to its own browser storage. In the Supabase dashboard, Authentication > URL Configuration must list every site address as an allowed redirect.


**Shared files:** `menu.json`, `suite-nav.js` and `sso.js` exist as identical copies in several folders. The masters are in `shared/`. After changing one, run `node tools/sync-shared.mjs` (or `node tools/sync-shared.mjs --check` to see which copies differ).
