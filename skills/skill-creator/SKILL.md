---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends the agent's capabilities with specialized knowledge, workflows, or tool integrations. Works across Pi, Claude Code, and Codex.
---

# Skill Creator

This skill provides guidance for creating effective, harness-agnostic skills.

## About Skills

Skills are modular, self-contained packages that extend an agent's capabilities by providing
specialized knowledge, workflows, and tools. They transform a general-purpose agent into a
specialized one equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else the
agent needs: system prompt, conversation history, other Skills' metadata, and the actual user
request.

**Default assumption: the agent is already very smart.** Only add context the agent
doesn't already have. Challenge each piece of information: "Does the agent really need this
explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

- **High freedom** (text instructions): when multiple approaches are valid or context drives decisions
- **Medium freedom** (pseudocode or parameterized scripts): when a preferred pattern exists but variation is ok
- **Low freedom** (specific scripts, few parameters): when operations are fragile, error-prone, or consistency is critical

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation loaded into context on demand
    └── assets/           - Files used in output (templates, images, fonts, etc.)
```

### SKILL.md Format

A SKILL.md consists of YAML frontmatter followed by Markdown instructions.

#### Frontmatter

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Max 64 chars, lowercase a-z, 0-9, hyphens |
| `description` | Yes | Max 1024 chars. What the skill does AND when to use it. This is the primary trigger — the body is only loaded AFTER the skill triggers. |
| `license` | No | License name or reference to bundled file |
| `compatibility` | No | Max 500 chars. Environment requirements (target product, system packages, etc.) |
| `metadata` | No | Arbitrary key-value map. Pi uses `short-description` for summaries. |
| `allowed-tools` | No | Space-delimited list of pre-approved tools (Pi, experimental) |
| `disable-model-invocation` | No | When `true`, the skill is hidden from the system prompt. Users must invoke it explicitly via `/skill:name` (Pi) or equivalent. |

**Name rules:** 1-64 chars, lowercase + numbers + hyphens only, no leading/trailing/consecutive hyphens.

**Description best practices — critical.** The description is the only part always in context and
determines whether the agent loads the skill. Be specific about both what and when:

Good:
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

Poor:
```yaml
description: Helps with PDFs.
```

#### Body

Instructions the agent follows after the skill triggers. Use relative paths from the skill
directory for scripts, references, and assets:

```markdown
Run the setup script:
```bash
./scripts/setup.sh
```

For advanced usage, see [the reference guide](references/REFERENCE.md).
```

### Progressive Disclosure

Skills use a three-level loading system:

1. **Metadata** (name + description) — always in context (~100 words)
2. **SKILL.md body** — loaded when the skill triggers (<5k words)
3. **Bundled resources** — loaded on demand by the agent

#### Progressive Disclosure Patterns

Keep SKILL.md under 500 lines. When approaching this limit, split content into reference files
and describe clearly when to load them.

**Pattern 1: High-level guide with references**

```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber:
[code example]

## Advanced features
- **Form filling**: See [forms.md](references/forms.md)
- **API reference**: See [reference.md](references/reference.md)
```

**Pattern 2: Domain-specific organization**

```
bigquery-skill/
├── SKILL.md (overview + navigation)
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**Pattern 3: Conditional details**

```markdown
## Editing documents
For simple edits, modify the XML directly.
**For tracked changes**: See [references/redlining.md]
```

**Guidelines:**
- Keep references one level deep from SKILL.md — no nested reference chains
- For reference files >100 lines, include a table of contents
- Avoid duplicating information between SKILL.md and reference files

### What to Not Include

Do NOT create extraneous files:
- README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, etc.
- Setup/testing procedures, user-facing documentation
- Auxiliary context about the skill creation process

A skill should only contain what the agent needs to do the job.

---

## Skill Creation Process

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (`init_skill.py`)
4. Edit the skill (implement resources and write SKILL.md)
5. Test the skill (`test_skill.py`)
6. Iterate based on real usage

### Step 1: Understanding the Skill

Collect concrete examples of how the skill will be used. For an image-editor skill:

- "What functionality should the skill support?"
- "Can you give examples of how it would be used?"
- "What would a user say that should trigger this skill?"

Don't overwhelm the user — start with key questions, follow up as needed.

### Step 2: Planning Reusable Contents

For each example, identify what scripts, references, and assets would be useful:

| Example | Need | Solution |
|---------|------|----------|
| "Rotate this PDF" | Same code rewritten each time | `scripts/rotate_pdf.py` |
| "Build a todo app" | Same boilerplate each time | `assets/hello-world/` template |
| "How many users logged in?" | Table schemas rediscovered | `references/schema.md` |

### Step 3: Initialize the Skill

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

The script creates the skill directory, a SKILL.md template with frontmatter placeholders, and
example `scripts/`, `references/`, and `assets/` directories. Customize or delete as needed.

### Step 4: Edit the Skill

#### Implement Bundled Resources

Start with the reusable resources identified in Step 2. Test scripts by running them — at least
a representative sample if there are many similar ones.

#### Write SKILL.md

Use imperative/infinitive form. The description in frontmatter is the trigger — put all
"when to use" information there, not in the body.

Only include information beneficial and non-obvious to the agent. Consider what procedural
knowledge, domain-specific details, or reusable assets another instance would need.

For design patterns, consult:
- **Multi-step processes**: [references/workflows.md](references/workflows.md)
- **Output formats or quality standards**: [references/output-patterns.md](references/output-patterns.md)

Delete any example files and directories not needed.

### Step 5: Test the Skill

```bash
scripts/test_skill.py <path/to/skill-folder>
```

Checks performed:
1. **Structure**: frontmatter, naming, required fields, description quality
2. **Content**: TODO markers, uncustomized templates, body length
3. **Cross-references**: files referenced in SKILL.md exist, no orphan files detected
4. **Scripts**: Python syntax (`py_compile`), Bash syntax (`bash -n`), shebangs, executable permissions

Fix all errors before using the skill.

### Step 6: Iterate

After real usage, identify struggles or inefficiencies and update SKILL.md or bundled resources.

---

## Harness-Specific Notes

### Pi
- Skills in `~/.pi/agent/skills/` or `~/.agents/skills/` are auto-discovered
- Use `/skill:name` to invoke a skill explicitly
- Supports `metadata`, `allowed-tools`, and `disable-model-invocation` in frontmatter
- No packaging step needed — skills are used directly from their directory

### Claude Code
- Skills in `~/.claude/skills/` are auto-discovered
- Use `package_skill.py` to create distributable `.skill` files (zip archives)
- Frontmatter: only `name` and `description` are read; `compatibility` is rarely needed

### Codex
- Skills in `~/.codex/skills/` are auto-discovered
- Supports `metadata` in frontmatter (e.g., `short-description`)
- System skills live under `.system/` prefix
