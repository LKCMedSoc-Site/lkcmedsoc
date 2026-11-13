# Data and actions for every hub

Each hub is a controller that draws nothing. Inside it, use `$ctx.<name>` for data and "Run component action" (on an element's interactions) for actions. In a repeated element the current record is `currentItem`.
All hubs also give `isLoading` and `hasError`, and take a "Show at most" (`limit`, 0 = all) setting for small previews.

**Paging (groups, events and news hubs).** Set **Items per page** (`pageSize`, 0 = no paging; it takes over from `limit`). Then every hub also gives:
`page`, `pageCount`, `pageSize`, `hasNextPage`, `hasPrevPage`, `pageText` ("Page 2 of 5"), `rangeFrom`, `rangeTo` (for "6 to 10 of 23"), and `pages` (a list of `number` and `isCurrent`, to repeat as numbered buttons).
Actions: `nextPage()`, `prevPage()`, `goToPage(page)` (clamped, so 99 goes to the last page). The page returns to 1 whenever the search or a filter changes.

**Several at once (checkbox facets).** In the events and news hubs, `toggleCommittee` / `toggleCategory` now keep a whole set; `setCommittee` / `setCategory` choose exactly one (empty text = none). Read the set from `selectedCommittees` / `selectedCategories` (lists of names), the checked state of a row from `selectedCommitteeMap[name]` / `selectedCategoryMap[name]` or the row's own `isSelected`, and how many are on from `selectedCommitteeCount` / `selectedCategoryCount`. `selectedCommittee` and `selectedCategory` still give the first one, so older designs keep working. The groups hub was already several-at-once.

| Hub (Insert menu name) | Context name |
|---|---|
| Student groups hub (start here) | `groupsHub` |
| Events hub (data and filters) | `eventsHub` |
| News hub (data and filters) | `newsHub` |
| People hub (data and search) | `peopleHub` |
| Policy hub (documents and search) | `policyHub` |
| Policy document hub (one document) | `policyDoc` |

## groupsHub
Settings: `limit`, `pageSize`, `defaultCommittee` (name or slug), `order` (a-z / random).
Fields: `items`, `totalCount` (matches), `shownCount`, `allCount`, `hasMatches`, `countText`, `activeSearch`, `committees`, `selectedCommitteeMap`, `selectedCommitteeCount`, `isRecruitingOnly`, `anyRecruiting`, `isFiltering`, `spotlight` (this week's group, or null), `spotlightLeaders` (`name`, `title`).
Group: `name, committee, committeeShort, committeeSlug, description, chair, logo, header, recruiting, link, committeeLink, color, onColor, tint, overlay, initials`.
(`color` is the body's own colour, or its committee's if it has none. `onColor` is the text colour on it, always white. `tint` is a light, see-through version for resting chips and pills; `overlay` is a stronger see-through version to wash over a photo. Colours come from each body's stored colour, see `src/lib/tones.ts`.)
Committee: `name, short, slug, href, color, onColor, tint, overlay, isSelected, count`.
Actions: `setSearch(query)`, `toggleCommittee(slug)`, `nextPage()`, `prevPage()`, `goToPage(page)`, `clearFilters()`. (The recruiting actions still exist but are not used.)

## eventsHub
Settings: `limit`, `pageSize`, `defaultRsvpOnly`, `defaultCommittee` (one name, or several separated by commas).
Fields: `items`, `monthGroups` (`key`, `label`, `events`), `totalCount`, `shownCount`, `allCount`, `hasMatches`, `countText`, `committees`, `months`, `next` (soonest event or null), `notice` (`show`, `text`, `link`, `daysAway`), `activeSearch`, `selectedCommittee`, `selectedMonth`, `isRsvpOnly`, `isOpenToEveryone`, `isFiltering`.
Event: `id, title, venue, summary, organiser, committee, committeeShort, startDate, endDate, startTime, endTime, whenText, day, monthShort, monthKey, monthLabel, cover, hasCover, link, rsvpOpen, guestRsvpOpen, checkinOpen, spotsLeft, spotsText, isFull, ntuOnly`.
Committee: `name, short, isSelected, count`. Month: `key, label, short, isSelected, count`.
Actions: `setSearch(query)`, `setCommittee(name)`, `toggleCommittee(name)`, `setMonth(key)`, `toggleMonth(key)`, `setRsvpOnly(on)`, `toggleRsvpOnly()`, `setOpenToEveryone(on)`, `toggleOpenToEveryone()`, `nextPage()`, `prevPage()`, `goToPage(page)`, `clearFilters()`.

## newsHub
Settings: `limit` (12), `pageSize`, `defaultCategory`, `defaultCommittee` (one name, or several separated by commas).
Fields: `items`, `first`, `totalCount`, `shownCount`, `allCount`, `hasMatches`, `countText`, `categories`, `committees`, `activeSearch`, `selectedCategory`, `selectedCommittee`, `isFiltering`.
Story: `slug, title, category, categoryLabel, categoryColor, categoryOnColor, categoryTint, categoryOverlay, featured, summary, publishedAt, dateText, author, from, committee, committeeShort, cover, hasCover, link` (`link` is `/gazette/<slug>`; `categoryLabel` reads "Event write-ups" for Events; the category colours are deepened brand purples with white text, `Tint` is a light see-through version and `Overlay` a stronger one for a photo wash).
Category: `name, label, color, onColor, tint, overlay, isSelected, count`. Committee: `name, short, isSelected, count`.
Actions: `setSearch(query)`, `setCategory(name)`, `toggleCategory(name)`, `setCommittee(name)`, `toggleCommittee(name)`, `nextPage()`, `prevPage()`, `goToPage(page)`, `clearFilters()`.

## peopleHub
Settings: `limit` (applies to the four flat lists).
Fields: `ay`, `exco`, `committeeHeads`, `yearReps`, `streamReps` (flat lists of people), `committees`, `years`, `excoCount`, `committeeHeadCount`, `yearRepCount`, `streamRepCount`, `activeSearch`, `isFiltering`.
Person: `name, title, photo, hasPhoto, initials, group, groupSlug, link`.
Committee: `name, short, slug, link, groupCount, head` (a person or null), `people`. Year: `name, reps, streams`.
Actions: `setSearch(query)`, `clearFilters()`.

## policyHub
Settings: none. Drawn on the contents page at `/policy`.
Fields: `tiers` (always four: Constitution, Bylaws, Guides, NTU and School rules; repeat it, then repeat its `items`), `items` (every document, flat), `totalCount`, `anyDraft`, `activeSearch`, `isSearching`, `results`, `hasResults`, `resultsText`, `changelogLink`.
Tier: `key, label, note, items, count, hasItems`. Show "Nothing published yet." when `!currentTier.hasItems`.
Document: `slug, title, summary, hasSummary, tier, tierLabel, owner, isDraft, isInForce, statusText, version, effectiveText, provisionCount, provisionsText, link`.
Search result: `ref, heading, snippet, docTitle, docSlug, link`.
Actions: `setSearch(query)` (words, or a number like B-9.4), `clearSearch()`.

## policyDoc
Settings: **Document address** (`slug`). On a page at `/policy/[slug]` bind it to `$ctx.params.slug`. Leave it empty while designing: the first document shows as a preview.
Fields: `title, summary, hasSummary, tier, tierLabel, owner, slug, isDraft, isInForce, isOldVersion, statusText, version, shownVersion, effectiveText, hasEffective, currentThrough, hasCurrentThrough, link, pdfLink, pdfLabel, provisions, provisionCount, versions, hasVersions, recentChanges, hasChanges, prev, next, hasPrev, hasNext, changelogLink, isLoading, notFound, hasError`.
Provision (`provisions`): `ref` ("B-9.4"), `heading`, `html` (the provision's text as ready-made HTML: bind it to a rich-text/HTML element, it already holds the lists and tables), `notes` (text lines such as "Adopted A-001, in force 13 November 2026"; repeat them), `hasNotes`, `link` ("#B-9.4").
Version (`versions`): `version, dateText, title, link, isCurrent`. Change (`recentChanges`): `number` ("A-001"), `title, dateText, link`. `prev` and `next`: `title, link, slug`, or null.
Notes: the contents column repeats `provisions` too (use `ref` and `heading`; `link` jumps to the provision). `pdfLink` always serves the version in force; the label already says "Download draft PDF" for a draft.
Editors: see "Policy editing" below. An older version (`?v=2`) always uses the coded page.

## Policy editing (ExCo only)
Pieces in the Insert menu, all named "Policy editing: …". **Readers never see any of them**: they draw nothing unless a signed-in ExCo member is viewing, and the database checks who is asking on every action. They are placed in the design, not bound to data (except the provision number).
| Piece | Where it goes |
|---|---|
| Policy editing: wrap the document | Around the WHOLE document design, inside the Policy document hub. Gives `$ctx.policyEdit` (`isExco, mode, isEditing, canEdit, openProposalCount`). Needs no settings. |
| Policy editing: mode switch | In the top bar. The Viewing / Editing switch (Suggesting for a document in force). |
| Policy editing: proposals banner | Above the first provision. Proposals about the whole document (such as adopting a draft), with their votes. |
| Policy editing: one provision | Inside the repeat over `$ctx.policyDoc.provisions`: put that provision's elements (number, heading, `html`, notes) inside it. Set **Provision number** to `currentProvision.ref`. In Editing or Suggesting, ExCo get an Edit button and the editor replaces the elements; pending proposals show under it. |
| Policy editing: add a provision | After the last provision. |
| Policy editing: all documents (ExCo) | On the contents page. Every document, published or not, with a "Shown on the website" tick. |
Safety net: ExCo get the coded page (which has all of this built in) unless the design contains "wrap the document" (document page) or "all documents (ExCo)" (contents page). So a design that forgets them can never lock editors out. Readers always get the Plasmic page.
`$ctx.policyEdit.isEditing` is handy for styling: for example, a thin outline on each provision while someone is editing.
