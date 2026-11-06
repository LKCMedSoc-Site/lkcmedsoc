# LKCMedSoc

Code for the LKCMedSoc website and internal tools. This repository is public: it must never contain keys, passwords, spreadsheets or any personal data. The keys that appear in `config.js` files are the *publishable* kind, which are public by design; the database rules protect the data.

| Folder | What it is | Address | Hosted on |
|---|---|---|---|
| `site/` | Public website (Next.js; layout edited in Plasmic) | lkcmedsoc.com | Vercel |
| `portal-site/` | Activities, events, write-ups and approvals | portal.lkcmedsoc.com | Vercel |
| `records/` | Leadership and participation records | records.lkcmedsoc.com | Vercel |
| `Inventory/` | Inventory app | inventory.lkcmedsoc.com | Vercel |
| `sql/` | Database set-up files (Supabase project: lkcmedsoc-inventory) | not hosted | none |

Each folder is its own Vercel project: set the project's "Root Directory" to the folder name. DNS for lkcmedsoc.com is on Cloudflare.
