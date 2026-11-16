# Visual page editor: round-trip tests

Checks that opening a page in the Records visual editor and saving it (after any edit) does not change what the page looks like.
Each page in `cases.json` is loaded into the real editor code (in jsdom), written back, and compared: the text must come back
identical, or render identically (for example `*` bullets coming back as `-`). Anything the editor cannot hold (tables, `# ` titles,
strikethrough, HTML tags) must stay as untouched text blocks.

```bash
cd tools/ve-test && npm install && ./prep.sh && node run.mjs
```

Re-run `./prep.sh` after changing `records/visual-editor.js`. Add new pages to `cases.json`. The package versions are pinned to the
same Tiptap version the Records app loads from esm.sh (2.10.3).
