# Post-Write Linter

**Core Rule:** Runs Biome (`biome check --write`) on modified `.ts`, `.tsx`, `.js`, `.jsx`, and `.json` files to enforce formatting and catch syntax errors immediately after a tool writes to disk.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Modified File Paths (`Write`, `Edit`, `apply_patch`) | Reactive (After Action) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | Syntax error in `index.ts` | Biome check fails, returns error output and blocks tool completion. |
| ❌ **Blocked** | Unused imports in `app.tsx` | Biome linter rule violation. |
| ✅ **Allowed** | Correctly formatted `script.js` | Biome succeeds (or auto-fixes it successfully). |
| ✅ **Allowed** | Writing to `README.md` | Non-JS/TS/JSON files are skipped. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message containing the Biome linter/formatter output. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the Biome error message to identify the syntax error or linter violation.
3. **Change approach**: Use the `Edit` tool to fix the reported errors in the file, then your next action will be allowed.