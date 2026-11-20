# LKCMedSoc Policy connector

Lets Claude (the desktop app and Claude Code) read, search, comment on and draft the Policy documents while you write,
signed in as **you**. It sees every document, drafts included, so a new rule can be checked against all the others.

**It can never publish.** It writes the *working copy* only, with a backup of the previous text first.
Publishing stays with the President, in the Policy page.

## One-time setup (about two minutes)

In a terminal, in this folder (`tools/policy-mcp`):

```bash
npm install        # already done once; harmless to repeat
node index.mjs login
```

`login` asks for your Policy email and password. The password is typed hidden and is **not stored**: only a sign-in token is kept,
in a private file in your home folder (`~/.lkcmedsoc-policy-mcp/session.json`, readable only by you).
Only ExCo accounts work. Then check it:

```bash
node index.mjs check     # lists the documents it can see
```

### Claude Code

```bash
claude mcp add --scope user lkcmedsoc-policy -- /usr/local/bin/node /Users/jireh/Projects/LKCMedSoc/tools/policy-mcp/index.mjs
```

### Claude desktop app

Open **Settings → Developer → Edit Config** (the file is `~/Library/Application Support/Claude/claude_desktop_config.json`) and add:

```json
{
  "mcpServers": {
    "lkcmedsoc-policy": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/jireh/Projects/LKCMedSoc/tools/policy-mcp/index.mjs"]
    }
  }
}
```

Quit and reopen the app. (If you already have other `mcpServers`, add this one beside them.)

## What Claude can do

| Tool | What it does |
| --- | --- |
| `list_documents` | Every document, whether it is published, how many clauses |
| `read_document` | One document: a numbered view (to cite "Bodies 3.2(a)") and the exact markdown |
| `read_all_documents` | Everything at once, so a new rule is checked against all the others |
| `search` | Where a word or phrase is used across all documents, with numbers |
| `edit_document` | Exact find-and-replace edits (all or nothing; refused if someone else saved since) |
| `write_document` | Replace a whole working copy (needs the revision it read; refuses to wipe most of a document) |
| `add_comment`, `list_comments` | Comment on a passage, as members do |
| `list_backups`, `restore_backup` | Undo: every write keeps the previous text |

Every write is also stamped "Claude" as the last saver, and a copy of the previous text is saved in
`~/.lkcmedsoc-policy-mcp/backups/`. The page's own "Earlier saves" panel shows the server-side copies.

## Things to know

- **Changes show up for everyone with access.** Edits go to the working copy that ExCo edit. Anyone with the document open will see the
  "someone saved a newer copy" notice, as with any ExCo edit. Members see nothing until the President publishes.
- **The structure rules apply.** The connector uses the editor's own rules (articles, numbered clauses, nothing unnumbered after sub-items),
  read from `policy-site/policy.js`, so what it writes is already in the right shape. If it adjusts anything it says so.
- **Sign out of it any time:** `node index.mjs logout` removes the saved sign-in. Changing your Policy password also ends it.
- **Your drafts go to Claude** when you ask about them, like any document you share with Claude. They contain no student data.

## Try it

- "Read all the documents, then help me write a clause about ties in ExCo votes. Tell me which existing rules it touches."
- "Search for everywhere we say 'Committee Register' and list the clauses."
- "Draft article 5 of the Constitution on amendments, check it against the bylaws, then save it to the working copy."
- "Comment on Bodies 3.2(b) asking whether Initiatives also need an annual review."
- "Undo what you did to the Constitution."

## For developers

`npm test` runs 11 tests against an in-memory stand-in database (`POLICY_MCP_FAKE=1`), through a real MCP client over stdio.
