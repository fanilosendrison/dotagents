---
name: document-self-modif
description: Document a new harness modification (extension, patch, or convention) in the dotpi repo. Use when the user says "documente cette modif", "ajoute une entrée dans les docs", or after creating a new extension/patch that needs a CONTEXT.md entry.
---

# Document a Harness Modification

Reference `~/.pi/agent/CONTEXT.md` for writing conventions and the existing index.
This file is already in context — use its Quick Navigation table, Writing Rules,
and Folder Structure to stay consistent with existing docs.

## Step 1: Write the CONTEXT.md

Derive `<topic>` as kebab-case from the title (e.g. `# Managing API Keys` → `managing-api-keys`).

Write `docs/<topic>/CONTEXT.md` with this header:

```
# <Title>

- **Date**: YYYY-MM-DD
- **Type**: Extension | Patch | Convention
- **File**: `~/.pi/agent/<path>`
```

Then these sections, in order:

**What** — critical context first. What was done, where it lives.
**Why** — the problem it solves.
**How It Works** — operational details (code block, command, behavior).
**Relevant Files** — table: `File | Purpose | Versioned (✅/❌)`.
**Background** — brief: what changed and why. Keep it short.

### Style reference

Read `docs/managing-api-keys/CONTEXT.md` for the canonical example:
- Tables use `|` with aligned columns
- Sections separated by `---`
- Placeholders use `<angle_brackets>`

## Step 2: Update the index

Add an entry in `docs/CONTEXT.md` under "Existing Modifications" at the end:

```
### N. <Title>
- **Date** : YYYY-MM-DD
- **Doc** : [`<topic>/CONTEXT.md`](<topic>/CONTEXT.md)
```

Increment N from the last existing entry (currently 7 entries).

## Step 3: Update the router

Add a row to the Quick Navigation table in `~/.pi/agent/CONTEXT.md`:

```
| Understand the <lowercase description> | `docs/<topic>/CONTEXT.md` (<one-line summary>) |
```

Match the table format exactly — separator dashes must align with header widths.
