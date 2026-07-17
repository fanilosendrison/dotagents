---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends your capabilities with specialized knowledge, workflows, or tool integrations. Works across Pi, Claude Code, and Codex.
---

# Skill Creator

You are reading this because someone wants you to create or update a skill. This guide
tells you how.

## What Goes in a Skill

A skill bundles four things:

1. **Workflows** — step-by-step procedures for specific tasks
2. **Tool instructions** — how to work with specific file formats or APIs
3. **Domain knowledge** — company schemas, business rules, conventions
4. **Reusable resources** — scripts (run them), references (read them), assets (copy them into output)

## Core Principles

### Concise is Key

Context is a shared resource. Every token you consume in a skill is a token not available for conversation history, other skills, or the user's actual request.

**Default assumption: you are already very smart.** Only add information you don't already have. Before writing anything, ask yourself: "Do I really need this? Is this worth the tokens?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match specificity to the task:

- **High freedom** (text instructions): when multiple approaches are valid or context decides
- **Medium freedom** (pseudocode or parameterized scripts): when there's a preferred pattern
- **Low freedom** (specific scripts, few parameters): when operations are fragile or consistency is critical

### Naming Conventions

All files, scripts, and directories created for a skill MUST strictly adhere to the global naming conventions defined in [`~/.agents/conventions/file-and-folder-naming.md`](../../conventions/file-and-folder-naming.md). Ensure you review these constraints before naming any new resource.

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
└── Bundled Resources (optional)
    ├── scripts/          — executable code (Python, Bash, etc.)
    ├── references/       — docs you load on demand
    └── assets/           — files used in output (templates, images, fonts, etc.)
```

### SKILL.md Format

YAML frontmatter followed by Markdown instructions.

#### Frontmatter

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | 1-64 chars, lowercase a-z, 0-9, hyphens only |
| `description` | Yes | Max 1024 chars. What the skill does AND when you should use it. This is the trigger — the body loads only after you decide to use the skill. |
| `license` | No | License name or reference to bundled file |
| `compatibility` | No | Max 500 chars. Environment requirements |
| `metadata` | No | Arbitrary key-value map (Pi: `short-description`) |
| `allowed-tools` | No | Pre-approved tools (Pi, experimental) |
| `disable-model-invocation` | No | If `true`, skill is hidden from your system prompt. Users must invoke it explicitly via `/skill:name` (Pi) or equivalent |

**Description is everything.** It's the only part always in your context and the sole trigger. Be specific about both what AND when:

Good:
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

Poor:
```yaml
description: Helps with PDFs.
```

#### Body

Instructions you follow after the skill triggers. Use relative paths:

~~~markdown
Run the setup:
```bash
./scripts/setup.sh
```

For advanced usage, see [the reference guide](references/REFERENCE.md).
~~~

### Progressive Disclosure

Three levels, loaded in order:

1. **Metadata** — always in your context (~100 words)
2. **SKILL.md body** — loaded when you decide the skill applies (<5k words)
3. **Bundled resources** — loaded by you on demand

#### Patterns

Keep SKILL.md under 500 lines. Split into references when approaching that limit, and tell
yourself when to load them.

**Pattern 1: Guide with references**

```markdown
# PDF Processing

## Quick start
[code example]

## Advanced
- **Form filling**: See [references/forms.md]
- **API reference**: See [references/reference.md]
```

**Pattern 2: Domain organization**

```
bigquery-skill/
├── SKILL.md (overview + navigation)
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**Pattern 3: Conditional loading**

```markdown
## Editing documents
For simple edits, modify the XML directly.
**For tracked changes**: See [references/redlining.md]
```

- Keep references one level deep — no nested chains
- For reference files >100 lines, include a table of contents
- Don't duplicate information between SKILL.md body and reference files

### What NOT to Include

Do not create: README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, or any auxiliary
documentation. A skill contains only what you need to do the job — nothing about the
process that created it.

---

## Creation Process

Follow these steps in order. Skip a step only if there's a clear reason.

1. Understand the skill with concrete examples
2. Plan reusable contents (scripts, references, assets)
3. Create the skill directory and SKILL.md
4. Edit: implement resources and write SKILL.md
5. Validate with [quick_validate.ts](scripts/quick_validate.ts)
6. Iterate after real usage
7. Commit to the dotagents repo

### Step 1: Understand

Collect concrete examples from the user. For an image-editor skill:

- "What functionality should it support?"
- "Can you give examples of how it would be used?"
- "What would a user say that should trigger this skill?"

Don't flood the user — ask the key questions first, follow up as needed.

### Step 2: Plan

For each example, identify reusable resources:

| Example | Need | Solution |
|---------|------|----------|
| "Rotate this PDF" | Same code rewritten every time | `scripts/rotate_pdf.py` |
| "Build a todo app" | Same boilerplate every time | `assets/hello-world/` template |
| "How many users logged in?" | Schemas rediscovered each time | `references/schema.md` |

### Step 3: Create the Skill Directory

Create the skill under `~/.agents/skills/`:

```bash
mkdir -p ~/.agents/skills/<skill-name>/{scripts,references,assets}
ln -sf ~/.agents/skills/<skill-name> ~/.codex/skills/<skill-name>
```

Then write `SKILL.md` with the frontmatter and body — use the table above to fill in
`name` and `description` at minimum. See [assets/template-skill/SKILL.md](assets/template-skill/SKILL.md)
for a minimal starting point.

Delete any directories you don't need (`scripts/`, `references/`, `assets/` are optional).

### Step 4: Edit

#### Implement resources

Build the scripts, references, and assets you identified in Step 2. **Test the scripts**
by running them — at least a representative sample if there are many.

#### Write SKILL.md

- Use imperative / infinitive form throughout ("Do X", not "You should do X")
- Put all "when to use" information in the frontmatter description, not the body
- Only include information that is beneficial and non-obvious to you
- Write for another instance of yourself — what would it need to know?

Design patterns for reference:
- **Multi-step processes**: [references/workflows.md](references/workflows.md)
- **Output formats**: [references/output-patterns.md](references/output-patterns.md)

Delete any example files and directories you don't need.

### Step 5: Validate

Run [scripts/quick_validate.ts](scripts/quick_validate.ts) to check the skill:

```bash
bun scripts/quick_validate.ts <path/to/skill-folder>
```

Zero dependencies. Checks frontmatter, naming, description quality, TODO markers,
cross-references, and orphan files. Fix all errors before delivering the skill.

### Step 6: Iterate

Use the skill on real tasks. When you notice struggles or inefficiencies, update SKILL.md
or the bundled resources.

### Step 7: Commit

Skills live in a git-tracked repo symlinked from `~/.agents/skills/`. Commit using
Conventional Commits via `/git-commits-push`:

```bash
cd ~/.agents/skills/git-commits-push && bun run start
```

The skill will generate a proper commit message and auto-push.


