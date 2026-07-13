# Your Directives

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute directives.

## General Guidelines
- Do not implement anything without asking the user for explicit permission first, unless they have explicitly invoked `/go` (visible as `<skill name="go">` in the formatted prompt) in their message. Before using any file-modifying tool (Write, Edit, etc.), verify that `/go` or `<skill name="go">` is present in the user's message. If neither is present, you do NOT have authorization to implement — you may only read and analyze. Never self-trigger the `/go` skill.
- When making technical decisions, do not give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- Do not reinvent a maintained format, protocol, tool, or standard when one already exists. Prefer established standards, official tools, and maintained libraries; define project-specific primitives only when they add domain or workflow semantics that existing primitives do not cover. Non-exhaustive examples of primitives to prefer when applicable:
  - Git primitives for diffs, patches, commits, refs, worktrees, and merge checks.
  - Turnlock for workflow runtime concerns such as durable state, locks, retries, resume, and orchestration, when the project uses or targets Turnlock.
  - JSON Schema, Zod, OpenAPI, or protobuf for structured contracts, depending on the project.
  - RFC standards such as JCS for canonical JSON.
  - SARIF, JUnit XML, TAP, LCOV, or Cobertura for tool reports.
  - Official provider APIs instead of scraping web UIs.
  - Official language or package-manager CLIs instead of custom dependency or lockfile parsers.
- Apply high standard to engineering excellence. If you see a test failure or test flakiness, even if it is not caused by what you are working on right now, you must still get it fixed.


---


## Your 3 Gateway Folders — CRITICAL

`~/.agents/`, `~/.pi/agent/`, `~/.codex/`and `~/.claude/skills/` act as symlink gateways to their respective git repos.
While `~/.claude/skills/` is a direct symlink, `~/.agents/`, `~/.codex/` and `~/.pi/agent/` are physical folders that *contain* symlinks to the repos.

> ⚠️ **PATH-GUARD WARNING**: You must **NEVER** write directly to the physical git repos (`~/Developper/Projects/dot*`). If you attempt to write there, the `path-guard` enforcer will intentionally intercept your action. Your command will be either **strictly blocked** or **silently redirected** to the `~/.` gateways. **This is normal and expected behavior.** Do not try to bypass or hack around this restriction; simply follow the rules and use the `~/.` gateways.

**You must edit directly** through these `~/.` paths. 
**To commit your changes**, simply run the commit orchestrator which will auto-discover modified repos:

```bash
cd ~/.agents/skills/git-commits-push && bun run start
```


---


## Folder Structure

```
~/.agents/
├── AGENTS.md                 ← You are here.
├── agent-credentials.json    ← Global API keys registry (gitignored)
├── agent-credentials.json.template ← Template for API keys
├── operational-rules/        ← Core rules and architecture standards
│   ├── implementation.md     ← How you must implement code
│   └── managing-api-keys.md  ← How you manage API keys
├── conventions/              ← Passive conventions
│   └── semver.md             ← Shows you how to number versions
├── docs/                     ← Documentation for agent enforcers
│   ├── command-validator.md          ← Enforces command and tool validation
│   ├── CONTEXT.md                    ← Index of all enforcers
│   ├── git-commits-push-enforcer.md  ← Forces you to push after you commit
│   ├── path-guard.md                ← Shows you how to operate in symlink folders
│   └── permission-enforcer.md       ← Manages authorization state (/go)
├── agent-enforcers/          ← Core logic of your enforcers
│   ├── command-validator/
│   ├── git-commits-push-enforcer/
│   ├── path-guard/
│   ├── permission-enforcer/
│   └── shared/               ← Hook protocol helpers (stdin JSON parsing, allow/deny responses)
├── specs/                    ← Future specs and workflow drafts
├── memory/                   ← Core memory and historical lessons (e.g., known-bug-fixes.md, session-locations.md)
├── archived/                 ← Old skills and retired experiments
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
    ├── antigravity-harness-context/   
    ├── codex-harness-context/
    ├── create-symlink-for-dot-folders/
    ├── document-agent-enforcement/
    ├── document-self-modif/
    ├── document-wrapper/
    ├── git-commits-push/
    ├── go/
    ├── pi-harness-context/           
    ├── session-lookup/
    ├── skill-creator/
    └── turnlock-context/
```


---


## Quick Navigation

| Want to...                                          | Go here first                                |
|-----------------------------------------------------|----------------------------------------------|
| Implement a feature?                                | `operational-rules/implementation.md`        |
| Know how you manage API keys                        | `operational-rules/managing-api-keys.md`     |
| Know how to number versions                         | `conventions/semver.md`                      |
| Know about the way you verify bash commands         | `docs/command-validator.md`                  |
| Know about code modification permission (/go)       | `docs/permission-enforcer.md`                |
| Know about how you enforce git commit and push      | `docs/git-commits-push-enforcer.md`          |
| Know how to operate in symlink folders              | `docs/path-guard.md`                         |
| See all agent enforcers                             | `docs/CONTEXT.md`                            |


---


## Transversal Skills

| Want to...                                          | Use this skill                    |
|-----------------------------------------------------|-----------------------------------|
| Safely create symlinks for dot-folders              | `/create-symlink-for-dot-folders` |
| Document an agent-enforcer script                   | `/document-agent-enforcement`     |
| Document a modification to the Pi harness           | `/document-self-modif`            |
| Know about Antigravity harness context              | `/antigravity-harness-context`    |
| Know about Codex harness context                    | `/codex-harness-context`          |
| Know about Pi harness context                       | `/pi-harness-context`             |
| Look up or search past session history               | `/session-lookup`                  |
| Document a wrapper (Antigravity)                    | `/document-wrapper`               |
| Commit changes                                      | `/git-commits-push`               |
| Create or update a new skill                        | `/skill-creator`                  |
| Start/Authorize implementation phase                | `/go`                             |
| Know about turnlock context                         | `/turnlock-context`               |


---


## Writing Rules

- You must write all output in English.
- You must format tables so separator dashes match header column widths exactly.
- You must produce no markdown lint violations.

