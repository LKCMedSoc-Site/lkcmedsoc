# Driving Plasmic Studio in the browser: what works and what breaks

For an agent that has to bind and edit pages in Plasmic Studio through the built-in browser pane. Learned the hard way on /student-groups.
Read this with `DATA-CHEATSHEET.md` (what data and actions exist) and `HTML-AGENT-REPORT.md` (how the pasted HTML is written).

## The split of work

- **Static look (colours, spacing, fonts, layout):** put it in the pasted HTML or in repo code. Do not click through Studio for it.
- **Bindings (data, visibility, repeats, click actions):** these must be done in Studio, one element at a time. This guide is for that.
- **You cannot paste for the user.** The browser pane cannot read the clipboard. Put the HTML on the clipboard with `pbcopy`, select the right container in Studio, and ask the user to press Cmd+V. Studio also overwrites the clipboard when you click, so re-run `pbcopy` right before asking.
- **Publishing:** the permission check blocks clicking Publish (production deploy). Open the dialog if useful, then ask the user to press Publish. After publishing, the live page can take about 5 minutes to change (the pages revalidate every 300 s).

## Rules of the pane

1. **The user signs in.** Never enter passwords. If the pane shows the login page, ask them to sign in, then reload the project URL.
2. **Screenshots lag one step.** After any click, wait 2 s and screenshot again before believing what you see. A frame that looks unchanged is often just late.
3. **Coordinates move.** Panel layout shifts with the selected element, and the canvas zoom changes. Re-screenshot before clicking by coordinate. Prefer the layers tree (the Outline icon, top-left) over clicking on the canvas.
4. **Never type when you are not sure where focus is.** Letters go to canvas shortcuts. "style" typed into nothing zoomed the canvas. Delete removes the selected element. Backspace in the wrong place deleted a component. Check a field is focused (zoom in) before typing.
5. **Escape** closes a popup, but pressing it twice cancels an open editor without saving. One Escape at most, then click Save.
6. **Undo is Cmd+Z**, and it undoes in odd steps. Check the layers tree after each one.
7. **Selecting:** click a row in the layers tree. `Shift+Return` selects the parent, `Return` selects the first child.
8. **The pane may be in preview mode** (the user flips it). If you see "Back to studio" at top right, click it before editing. Clicks in preview follow links.

## The one recipe that matters: make a value dynamic

Almost everything is "bind this field to an expression". The path is always the same:

1. Select the element.
2. Hover the field and click the **three dots at its far right edge**. They only appear on hover.
3. Choose **Use dynamic value**.
4. In the popup click **Switch to Code** (top right). Click into the editor, `Cmd+A`, `Backspace`.
5. Type the expression, for example `currentItem.name`. Look at the preview on the right: it must show real data. An empty value or an error means it is wrong.
6. Click **Save**.

Where each field's dots are:
- **Text content:** Settings → Text → Content.
- **Image source:** right-click the image preview in Settings → Image → **Use dynamic value**. Opens the code editor straight away.
- **Visibility:** click the "not visible" (eye-slash) icon first, then the dots at the right of the Visibility row → **Use dynamic value**. The Condition field is then the dynamic one.
- **Any CSS value that must come from data:** add an attribute. Settings → **HTML attributes → +**, type `style`, pick the first `style` in the list, then use the dots → Use dynamic value. Expression is an object: `({ backgroundColor: currentItem.color })`.
- **Repeat element:** Settings → Repeat element → **+**, then edit Collection the same way, e.g. `$ctx.groupsHub.items`.
- **Click actions:** Settings → Interactions → On click → **Add new action** → Action: **Run element action** → Element: the hub → Action: pick it (Set search, Toggle committee, Next page, Go to page, Clear filters). Arguments are dynamic values too. The Action dropdown can need two or three seconds to open: wait and click once.

## Mistakes that cost hours

- **Plain text is not an expression.** A field that shows black text like `currentItem.slug` is a literal string. A real expression shows in green monospace. A chip filter did nothing for days because its Slug argument was literal text. Always confirm the preview shows a real value (`"careers"`, not `currentItem.slug`).
- **Typing into a box that was already dynamic appends.** You can end up with a literal prefix glued to the code (`"currentItem.slugcareers"`). Delete the literal part.
- **The code editor does not always close brackets.** A syntax error in the preview after typing `({ color: x` means add ` })` at the end (`ctrl+End` first). Quotes close themselves.
- **The Style attribute sometimes opens a blank object editor** instead of the menu. Cancel it and use the three-dots menu on the hovered row.
- **The opacity dropdown often will not open.** Ask the user to set opacity.
- **After a paste, old pieces remain.** Delete leftovers (old images, fallback boxes) and check visibility conditions that now hide the new block.
- **Pasted spans become text elements.** Padding and background on a pasted `<span>` can end up on the text element; they bind fine with the style attribute.
- **Studio saves automatically**, but nothing is live until Publish.

## Checking your work

- In the editor, the canvas renders live data, so a bound card should show real names and colours. A broken image icon usually means an empty value, which is expected where visibility hides it.
- Studio's **preview** (play button) runs the real actions: type in the search box, click a chip, click Next. Use it before asking the user to publish.
- After publishing, test the live page with the browser pane: `find` the control, click it, then read the page text or evaluate `document.body.innerText`. The chip filter, paging text ("Page 2 of 5") and counts are good checks.

## What exists

- Hubs: `$ctx.groupsHub`, `$ctx.eventsHub`, `$ctx.newsHub`, `$ctx.peopleHub` (see `DATA-CHEATSHEET.md` for fields and actions).
- Committee and group colours come from `src/lib/tones.ts` and are stored per body in Supabase. Elements read `color`, `onColor`, `tint` (light, see-through) and `overlay` (stronger wash for photos). Static hex values in pasted HTML are placeholders; the bindings replace them.
- Pasted pages use the sample patterns in `HTML-AGENT-REPORT.md`. Labels in dynamic spans say `[BIND: field]` so the layer names show what to bind.
