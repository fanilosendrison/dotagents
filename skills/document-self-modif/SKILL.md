---
name: document-self-modif
description: Document a modification to the Pi harness (new extension, patch, or convention). Use when the user says "documente cette modif", "ajoute une entrée dans les docs", or after creating something that needs a CONTEXT.md entry.
---

# Document a Harness Modification

Read `~/.pi/agent/CONTEXT.md`.
It contains the Quick Navigation table, Writing Rules, and Folder Structure —
match these exactly.

Follow these steps to document a harness modification.

## STEP 1. Write CONTEXT.md and output metadata

Write `docs/<topic>/CONTEXT.md` — the file with the full documentation.
Derive `<topic>` from the title: `# Managing API Keys` → `managing-api-keys`.

Start with a good title: `# <Action or Domain>`. Keep it short and `kebab-case` ready.

You are writing for your future self — when you read this again, you need to
understand what was done and how to act on it immediately. Reference
`docs/managing-api-keys/CONTEXT.md` as the canonical example for tone, table
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

**Then, output this JSON block** — it feeds the mechanical steps below.
Do NOT include it in the CONTEXT.md file, output it after writing.

```json
{
  "topic": "managing-api-keys",
  "title": "Managing API Keys",
  "description": "Doppler-based auth",
  "action": "Add / modify an API key",
  "date": "2026-06-29"
}
```

| Field | Source |
|-------|--------|
| `topic` | Title in kebab-case |
| `title` | The title, without `# ` |
| `description` | Short summary from the first sentence or frontmatter — 6 words max |
| `action` | "Want to..." completion for Quick Navigation (imperative, starts with a verb) |
| `date` | Today's date in `YYYY-MM-DD` |

---

The steps below are mechanical — execute them exactly, using the JSON above.
**No LLM call needed for steps 2 and 3.**

---

## STEP 2. Update the index (mechanical)

Add an entry in `docs/CONTEXT.md` under "Existing Modifications":

```
### N. {{title}}
- **Date** : {{date}}
- **Doc** : [`{{topic}}/CONTEXT.md`]({{topic}}/CONTEXT.md)
```

`N` is the next sequential number. Replace `{{...}}` with JSON values.

---

## STEP 3. Update the router (mechanical)

In `~/.pi/agent/CONTEXT.md`, do both:

**Quick Navigation** — add a row:
```
| {{action}} | `docs/{{topic}}/CONTEXT.md` ({{description}}) |
```

**Folder Structure** — add under `docs/`:
```
│   ├── {{topic}}/
│   │   └── CONTEXT.md         ← {{description}}
```

Replace `{{...}}` with JSON values. No thinking required — copy from the JSON.
