# Policy pages in Plasmic Studio: paste and bind, step by step

Two pages: the contents page (`/policy`) and a document page (`/policy/[slug]`). Read `DATA-CHEATSHEET.md` for every field (sections policyHub, policyDoc, Policy editing) and `STUDIO-BROWSER-GUIDE.md` for how a value is made dynamic (hover a field, three dots, Use dynamic value, Switch to Code, type, Save).

## 0. Before Studio

1. The code (hubs and editing pieces) must be on the live site, because Studio loads the pieces from the site's host page. If "Policy hub" is missing from Studio's Insert menu, the code is not deployed yet.
2. Reload the Studio project once the deploy has finished.
3. At least one document should be "Shown on the website" (editor: `/policy` while signed in as ExCo, the "For ExCo: all documents" panel). Until then the hubs have nothing to show.

Copy the HTML with the Terminal commands below, select the page's root in the layers tree, press Cmd+V, and delete anything the paste leaves behind. Studio overwrites the clipboard when you click, so copy again right before each paste.

```bash
pbcopy < site/plasmic-kit/policy-index.html      # contents page
pbcopy < site/plasmic-kit/policy-document.html   # document page
```

## 1. Contents page, path `/policy`

1. New page, path `/policy`, blank. Paste `policy-index.html` into it.
2. Insert **Policy hub (documents and search)**. In the layers tree, drag the pasted root inside the hub's slot (so everything is inside the hub).
3. **Draft notice** box: Visibility, dynamic value `$ctx.policyHub.anyDraft`.
4. **Search box**: delete the drawn box and insert Studio's **Text input** in its place (keep the Search button next to it). On change: Run element action, Policy hub, Set search, with the input's value. (Same wiring as the Student Groups search.)
5. **Search results block** (the one with `[BIND: $ctx.policyHub.resultsText]`): Visibility `$ctx.policyHub.isSearching`. Its heading text: `$ctx.policyHub.resultsText`. On the result row: Repeat element, collection `$ctx.policyHub.results`, name `currentResult`. Link (href) `currentResult.link`. Texts: `currentResult.ref`, `currentResult.heading`, `currentResult.docTitle`, `currentResult.snippet`. Delete any extra sample row.
6. **Policy editing: all documents (ExCo)**: Insert it under the search box (where the comment says). Readers never see it.
7. **Tier block** (the wrapper with the tier heading and rows): Repeat element, collection `$ctx.policyHub.tiers`, name `currentTier`. Tier heading text: `currentTier.label`. Note text: `currentTier.note`.
8. **Row** (the whole `<a>`): Repeat element, collection `currentTier.items`, name `currentItem`. Link (href) `currentItem.link`. Title text `currentItem.title`. Summary text `currentItem.summary`, Visibility `!!currentItem.summary`. Status text `currentItem.statusText`. Delete the second sample row.
9. **"Nothing published yet."**: Visibility `!currentTier.hasItems`.
10. Preview (play button): you should see the tiers and documents, and search should filter. Then ask for Publish.

## 2. Document page, path `/policy/[slug]`

1. New page, path `/policy/[slug]` (the square brackets make it a dynamic route). Paste `policy-document.html`.
2. Insert **Policy document hub (one document)**. Set **Document address** to a dynamic value: `$ctx.params.slug`.
3. Insert **Policy editing: wrap the document** inside the hub. Drag the pasted root inside the wrapper (hub, then wrapper, then your design).
4. **Top bar**: tier text `$ctx.policyDoc.tierLabel`. PDF link: text `$ctx.policyDoc.pdfLabel`, href `$ctx.policyDoc.pdfLink`. Insert **Policy editing: mode switch** at the right of the bar.
5. **Title** `$ctx.policyDoc.title`. **Summary** `$ctx.policyDoc.summary`, Visibility `$ctx.policyDoc.hasSummary`.
6. **Status block**, the value (right-hand) texts: `$ctx.policyDoc.statusText`; `$ctx.policyDoc.currentThrough` (row Visibility `$ctx.policyDoc.hasCurrentThrough`); `$ctx.policyDoc.effectiveText` (row Visibility `$ctx.policyDoc.hasEffective`); `$ctx.policyDoc.tierLabel`; `$ctx.policyDoc.owner`.
7. **Draft notice** box: Visibility `$ctx.policyDoc.isDraft`.
8. **Contents column** link: Repeat element, collection `$ctx.policyDoc.provisions`, name `currentProvision`. Link `currentProvision.link`. Texts `currentProvision.ref` and `currentProvision.heading`. Delete the second sample link.
9. Insert **Policy editing: proposals banner** above the first provision.
10. **Provision block** (the row with the number, heading and text): Repeat element, collection `$ctx.policyDoc.provisions`, name `currentProvision`. Add an `id` attribute (Settings, HTML attributes, +, `id`) with dynamic value `currentProvision.ref`, so links like `#B-9.4` land on it.
    - Number: text `currentProvision.ref`, link `currentProvision.link`.
    - Heading: text `currentProvision.heading`.
    - Text: delete the drawn text box and insert **Policy provision text**. Set **HTML** to `currentProvision.html`.
    - Source notes (the italic right-aligned line): Repeat element, collection `currentProvision.notes`, name `currentNote`; text `currentNote`; Visibility `currentProvision.hasNotes`.
    - Insert **Policy editing: one provision** in the right-hand column, move the heading, the text and the notes inside it, and set **Provision number** to `currentProvision.ref`. (Keep the repeat on the outer block, not on this piece.)
11. Delete the second sample provision (B-9.3, the table). It only shows how a table looks; the real tables come from the text.
12. Insert **Policy editing: add a provision** after the last provision.
13. **Versions** section: Visibility `$ctx.policyDoc.hasVersions`. Row: Repeat element `$ctx.policyDoc.versions`, name `currentVersion`; link `currentVersion.link`; texts `currentVersion.version`, `currentVersion.dateText`, `currentVersion.title`.
14. **Recent changes** section: Visibility `$ctx.policyDoc.hasChanges`. Row: Repeat element `$ctx.policyDoc.recentChanges`, name `currentChange`; texts `currentChange.number`, `currentChange.title`, `currentChange.dateText`.
15. **Previous / Next** links: href `$ctx.policyDoc.prev.link` and text `$ctx.policyDoc.prev.title`, Visibility `$ctx.policyDoc.hasPrev`. Same for next with `$ctx.policyDoc.next...` and `hasNext`.
16. Preview, then ask for Publish.

## 3. After publishing

- Readers see the Plasmic pages (the live pages can take about 5 minutes to change).
- Signed-in ExCo see the same page plus the editing controls, as long as the design contains "wrap the document" (document page) and "all documents (ExCo)" (contents page). If a design leaves those out, ExCo are shown the coded page instead, so they can never be locked out.
- Zoom and print are part of the coded page only. Add a Print link in Studio if you want one.
- An older version (`?v=2`) and `/policy/changelog` always use the coded pages.
