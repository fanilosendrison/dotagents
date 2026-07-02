---
name: document-wrapper
description: Document an Antigravity wrapper. Use when the user asks to document a wrapper, add wrapper docs, or explain how a wrapper works.
---

# Document an Antigravity Wrapper

Read `~/.gravity/CONTEXT.md`.
It contains the Folder Structure and Quick Navigation table.

## STEP 1. Draft the text and fill the JSON

Draft the full `CONTEXT.md` content for the wrapper.

Start with a good title: `# <Wrapper Name>`. Keep it short and `kebab-case`
ready (e.g. `Git Hook Wrapper` → `git-hook-wrapper`).

You are writing for your future self — when you read this again, you need to
understand what was done and how to act on it immediately.

Sections, in this order:

- **Metadata block**: Date, Type, File.
- **What**: Short description of what the wrapper achieves.
- **How It Works**: Short explanation of the interception trigger and a table of Status / Example Input / Behavior.
- **Shared Logic**: Explain its reliance on the agent enforcer.
- **Relevant Files**: Table with File, Purpose, Versioned.

---

**Then, output this JSON block.** Put the full drafted text in the `content`
field. Everything below feeds the mechanical step.

```json
{
  "topic": "git-hook-wrapper",
  "title": "Git Hook Wrapper",
  "description": "Intercepts git commits",
  "action": "Use the git wrapper",
  "date": "2026-06-29",
  "content": "# Git Hook Wrapper\n\n- **Date**: 2026-06-29\n- **Type**: Git Hook\n- **File**: `~/.gravity/wrappers/git-hook-wrapper/hook.ts`\n\n## What\n\n...\n\n## How It Works\n\n..."
}
```

| Field | Source |
|-------|--------|
| `topic` | Title in kebab-case |
| `title` | The title, without `# ` |
| `description` | Short summary — 6 words max |
| `action` | "Want to..." for Quick Navigation (imperative, starts with a verb) |
| `date` | Today's date in `YYYY-MM-DD` |
| `content` | The full markdown text drafted above |

---

## STEP 2. Run the bootstrap script (mechanical)

Pipe the JSON from STEP 1 into the script bundled with this skill:

```bash
echo '<json>' | ./scripts/bootstrap-wrapper-docs
```

It writes the markdown file, updates the docs index,
appends the Quick Navigation row, and inserts into the Folder Structure
tree — all in one shot. **Zero LLM calls after STEP 1.**

## Bundled Resources

- **[bootstrap-wrapper-docs](scripts/bootstrap-wrapper-docs)** — main script, does everything
- **[lib.ts](scripts/lib.ts)** — pure functions for index, QuickNav, tree ops
