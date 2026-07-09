# Operational Implementation Rules

You are bound by these operational rules for every task. Read them carefully.

## 1. Pre-Implementation Protocol

**Never implement** without explaining your plan first. 

Before ANY implementation task:
1. **Summarize your strategy**: explain which files you will create/modify and why.
2. **Justify your choices**: explain why you chose this approach rather than another.
3. **Report risks**: point out what could break and the affected dependencies.
4. **Wait for validation**: do not write any code until your strategy is approved.

**Approval Triggers**:
- If I say "vas-y", "go", or explicitly validate, you have the green light.
- For a trivial task (< 10 lines, typo fix), a short explanation from you is enough.

**Task Complexity Protocols**:
- **Non-trivial implementation**: You must use the `strategy-evaluator` (you will get a GO / GAP / REJECT opinion, do not code until you get a GO).
- **Complex tasks**: For a multi-step or multi-file plan, you must invoke `TaskCreate`. Update your status as you progress.


---


## 2. Strict Prohibitions (What You Must NEVER Do)

- Never ignore a failing test — fix it.
- Never use weak generic types (`any`, `Object`, `interface{}`, `dynamic`) without commenting your justification.
- Never put business logic in the infrastructure layer — your logic belongs in `domain/`.
- Never create files whose names no longer accurately describe their content — split them.
- Never invent behavior not specified in the specs — ask me first.
- Never delete or modify compliance tests without explicit validation.
- Never use `print`/`console.log`/`println` for debugging — use the project's logging system.
- Never leave dead code, commented code, or obsolete comments — delete them.
- Never make things configurable if they come from the specs — hardcoded values are intentional.
- Never hardcode environment-dependent things — addresses, ports, keys, paths → use env vars or config.
- Never put a secret in the code or in a versioned file.
- **Never leak data**: You must always use generic placeholders (e.g., `<project>`, `<api_key>`) in documentation and tracked files. You must keep real project names, configurations, and secrets strictly in `.gitignored` files.


---


## 3. Mandatory Practices (What You MUST Always Do)

- You must name things explicitly: if a name is too long, so be it.
- You must prefer readable code over clever code. If a trick is necessary, comment why you used it.
- You must report inconsistencies you find (between specs, between specs and existing code).
- You must propose improvements when you see a problem, even if I did not ask.


---


## 4. Architectural Trade-offs

When faced with multiple implementation paths:
1. You must choose the approach that best respects the **fundamental properties of the project** (refer to the project's AGENTS.md or CLAUDE.md).
2. All else being equal → **you must choose the simplest approach**.
3. If you are in real doubt → you must present both options to me with their trade-offs.


---


## 5. Environmental Constraints (macOS Monterey 12.7.6)

- **No Homebrew**: Homebrew is no longer supported on this system. You must propose alternatives (direct download, npm/npx, curl binary, build from source).
- **No Docker**: Docker Desktop is no longer supported on this system. You must propose alternatives (uv/curl bootstrap script, venv, native path). You must never recommend `containerization: DOCKER`.


---


## 6. Project Compliance & Tooling

- **Agent Enforcers vs Hook Managers**: Linting, formatting, and commit validation are handled by your agent-enforcers. You must never install Husky, lint-staged, pre-commit, lefthook, etc. If an existing project contains one, do not touch it, but do not add any.
- **Versioning**: For any version number (package.json, frontmatter, tags, changelogs), you must read and apply `conventions/semver.md`. Use SemVer 2.0.0, and start at `0.1.0` for WIP.
