# Building the Student groups page natively in Plasmic Studio

The **Student groups hub** is a controller: it loads the groups, keeps the filters, and gives Studio data and actions.
It draws nothing itself, so every input, chip and card on the page can be Studio's own elements.
(I have not driven Studio myself, so button names below are from Plasmic's docs and may differ slightly. Tell me if a step doesn't match.)

## 0. Paste the three starting pieces

Open each `.html` file in this folder, select all, copy, and paste onto the Studio canvas (Cmd+V). Plasmic should convert it into normal stacks, text and boxes.
Make each one a **component** (right-click > Extract as component) and name it: `Group card`, `Filter chip`, `Search bar`.
Replace raw colours and fonts with the tokens (the pasted ones use the same hex values and DIN font names).

## 1. The page skeleton

1. Add **Student groups hub (start here)**. Delete its starter contents (they are the old coded pieces).
2. Inside it, add your own stacks. Everything in this guide goes inside the hub.

## 2. Data you can bind to

Pick these from the "dynamic value" (lightning bolt) menu under `groupsHub`.

| Field | What it is |
|---|---|
| `items` | The groups that match the filters now (each has the fields below) |
| `totalCount`, `allCount` | How many match, and how many exist |
| `countText` | "12 groups match", ready to show |
| `hasMatches` | false when the filters match nothing (use it to show an empty message) |
| `isLoading`, `hasError` | For loading and error messages |
| `activeSearch` | The words currently searched |
| `committees` | One entry per committee: `name`, `short`, `slug`, `href`, `color`, `onColor`, `isSelected`, `count` |
| `selectedCommitteeMap` | `{ "careers": true, ... }`, to look up whether a committee is on, by its slug |
| `selectedCommitteeCount`, `isRecruitingOnly`, `anyRecruiting`, `isFiltering` | Filter state |

Each entry in `items` has: `name`, `committee`, `committeeShort`, `committeeSlug`, `description`, `chair`, `logo`, `header`, `recruiting`, `link`, `committeeLink`, `color`, `onColor`, `initials`.

## 3. Actions you can run

On an element's **Interactions** (e.g. "On click", "On change"): *Run component action* > pick the hub > pick the action.

| Action | Argument | Use it for |
|---|---|---|
| `setSearch` | `query` (text) | The search input's "on change" |
| `toggleCommittee` | `slug` (text) | A chip's "on click", with the chip's committee `slug` |
| `setRecruitingOnly` | `on` (true/false) | A switch |
| `toggleRecruitingOnly` | none | A "Recruiting" button |
| `clearFilters` | none | A "Clear" button |

## 4. Wire each piece

**Search bar.** Replace the placeholder text in the pasted bar with Studio's **Text input**. Interaction: on change > `setSearch` with the input's current value.

**Filter chip.** Give the component a variant called `isSelected` (selected look: dark purple fill, white text). Give it props `label` (text) and `slug`.
Interaction: on click > `toggleCommittee` with `slug`.

**The chip row.** Add a horizontal stack. Turn on **Repeat** for one chip and choose `groupsHub.committees`. Then, for the chip:
- label = `currentItem.short`
- slug = `currentItem.slug`
- `isSelected` variant = `currentItem.isSelected` (no JavaScript needed; `groupsHub.selectedCommitteeMap[currentItem.slug]` also works)
- dot colour = `currentItem.color`

**Group card + grid.** Add a grid or wrapping stack. Turn on **Repeat** and choose `groupsHub.items`. Inside, put the `Group card` and bind:
- name = `currentItem.name`, description = `currentItem.description`, chair = `currentItem.chair`
- committee tag text = `currentItem.committeeShort`, its background = `currentItem.color`, its text colour = `currentItem.onColor`
- picture = `currentItem.header` (or `logo`). Use "visible when" `currentItem.header` so groups without a picture show the coloured initials box instead (`currentItem.initials`).
- "Recruiting" tag: visible when `currentItem.recruiting`
- the card's link = `currentItem.link`

**Counts and messages.**
- A text bound to `groupsHub.countText`.
- An "empty" message visible when `groupsHub.hasMatches` is false.
- A "Clear" button visible when `groupsHub.isFiltering`; on click > `clearFilters`.
- A loading message visible when `groupsHub.isLoading`.

## 5. Notes

- Groups here load in the browser, so they aren't in the page's raw HTML yet (planned: server-side first load).
- The old coded pieces still work inside the hub, so existing pages are unaffected.
