---
name: document-self-modif
description: Document a modification to the Pi harness (new extension, patch, or convention). Use when the user says "documente cette modif", "ajoute une entrée dans les docs", or after creating something that needs a CONTEXT.md entry.
---

# Document a Harness Modification

Read `~/.pi/agent/CONTEXT.md`.
It contains the Quick Navigation table, Writing Rules, and Folder Structure — match these exactly.

## STEP 1. Draft the text and fill the JSON

Draft the full `CONTEXT.md` content for the new topic.

Start with a good title: `# <Action or Domain>`. Keep it short and `kebab-case`
ready (e.g. `Managing API Keys` → `managing-api-keys`).

You are writing for your future self — when you read this again, you need to
understand what was done and how to act on it immediately. Reference
`docs/managing-api-keys.md` as the canonical example for tone, table
formatting, and section depth.

Sections, in this order:

**Where / What** — critical context first.
- If keys/resources: where they live.
- If a convention: state it upfront with placeholders for infra
  (e.g. project `<agent_name>`, config `<config>`).
- Use a table if there are multiple items.

**How It Works** — operational details.
- Show the exact command or code block.
- Include a placeholders reference table if the command has variables.
- Mention any noteworthy behavior (e.g. "executed on every request, no caching").

**Relevant Files** — table with columns: File, Purpose, Versioned (✅/❌).
- Every file the agent might need to read or edit.

**Background** — brief: what was changed and why. Keep it short.

---

**Then, output this JSON block.** Put the full drafted text in the `content`
field. Everything below feeds the mechanical step.

```json
{
  "topic": "managing-api-keys",
  "title": "Managing API Keys",
  "description": "Doppler-based auth",
  "action": "Add / modify an API key",
  "date": "2026-06-29",
  "content": "# Managing API Keys\n\n## Where / What\n\n..."
}
```

| Field | Source |
|-------|--------|
| `topic` | Title in kebab-case |
| `title` | The title, without `# ` |
| `description` | Short summary — 6 words max |
| `action` | "Want to..." for Quick Navigation (imperative, starts with a verb) |
| `date` | Today's date in `YYYY-MM-DD` |
| `content` | The full CONTEXT.md text drafted above |

---

## STEP 2. Run the bootstrap script (mechanical)

Pipe the JSON from STEP 1 into the script bundled with this skill:

```bash
echo '<json>' | ./scripts/bootstrap-docs
```

It writes the markdown file, updates the docs index,
appends the Quick Navigation row, and inserts into the Folder Structure
tree — all in one shot. **Zero LLM calls after STEP 1.**

## Bundled Resources

- **[bootstrap-docs](scripts/bootstrap-docs)** — main script, does everything
- **[lib.ts](scripts/lib.ts)** — pure functions for index, QuickNav, tree ops
- **[bootstrap-docs.test.ts](scripts/__tests__/bootstrap-docs.test.ts)** — integration tests (8)
- **[lib.test.ts](scripts/__tests__/lib.test.ts)** — unit tests (30)
