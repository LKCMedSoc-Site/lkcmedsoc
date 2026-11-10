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

## groupsHub
Settings: `limit`, `pageSize`, `defaultCommittee` (name or slug), `order` (a-z / random).
Fields: `items`, `totalCount` (matches), `shownCount`, `allCount`, `hasMatches`, `countText`, `activeSearch`, `committees`, `selectedCommitteeMap`, `selectedCommitteeCount`, `isRecruitingOnly`, `anyRecruiting`, `isFiltering`, `spotlight` (this week's group, or null), `spotlightLeaders` (`name`, `title`).
Group: `name, committee, committeeShort, committeeSlug, description, chair, logo, header, recruiting, link, committeeLink, color, onColor, initials`.
Committee: `name, short, slug, href, color, onColor, isSelected, count`.
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
Story: `slug, title, category, categoryColor, categoryOnColor, summary, publishedAt, dateText, author, from, committee, committeeShort, cover, hasCover, link`.
Category: `name, color, onColor, isSelected, count`. Committee: `name, short, isSelected, count`.
Actions: `setSearch(query)`, `setCategory(name)`, `toggleCategory(name)`, `setCommittee(name)`, `toggleCommittee(name)`, `nextPage()`, `prevPage()`, `goToPage(page)`, `clearFilters()`.

## peopleHub
Settings: `limit` (applies to the four flat lists).
Fields: `ay`, `exco`, `committeeHeads`, `yearReps`, `streamReps` (flat lists of people), `committees`, `years`, `excoCount`, `committeeHeadCount`, `yearRepCount`, `streamRepCount`, `activeSearch`, `isFiltering`.
Person: `name, title, photo, hasPhoto, initials, group, groupSlug, link`.
Committee: `name, short, slug, link, groupCount, head` (a person or null), `people`. Year: `name, reps, streams`.
Actions: `setSearch(query)`, `clearFilters()`.
