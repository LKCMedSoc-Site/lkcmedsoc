# LKCMedSoc

Code for the LKCMedSoc website and internal tools. This repository is public: it must never contain keys, passwords, spreadsheets or any personal data. The keys that appear in `config.js` files are the *publishable* kind, which are public by design; the database rules protect the data.

| Folder | What it is | Address | Hosted on |
|---|---|---|---|
| `site/` | Public website (Next.js; layout edited in Plasmic) | lkcmedsoc.com | Vercel |
| `activities-site/` | LKCMedSoc Activities: events, write-ups and approvals | activities.lkcmedsoc.com | Vercel |
| `feedback-site/` | LKCMedSoc Feedback: suggestions, issues and SSLG meetings | feedback.lkcmedsoc.com | Vercel |
| `records/` | Leadership and participation records | records.lkcmedsoc.com | Vercel |
| `Inventory/` | Inventory app | inventory.lkcmedsoc.com | Vercel |
| `sql/` | Database set-up files (Supabase project: lkcmedsoc-inventory) | not hosted | none |

Each folder is its own Vercel project: set the project's "Root Directory" to the folder name. DNS for lkcmedsoc.com is on Cloudflare.

**One sign-in:** `records/`, `activities-site/` and `feedback-site/` (and the main site) keep the Supabase session in a cookie shared across `lkcmedsoc.com` and its subdomains (`sso.js` in each folder, `site/src/lib/sso.ts` for the website), so signing in or out on one does it for all. The three `sso.js` files are identical copies. On other addresses (localhost, preview links) each site falls back to its own browser storage. In the Supabase dashboard, Authentication > URL Configuration must list every site address as an allowed redirect.
