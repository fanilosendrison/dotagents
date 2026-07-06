---
name: antigravity-context
description: >-
  Loads the Antigravity harness directives and architecture
  (~/.gravity/ / dotgravity). Use ONLY when the request explicitly
  mentions Antigravity, ~/.gravity/, .gravity or dotgravity (the repo).
  Valid triggers: the user cites Antigravity by name, cites
  ~/.gravity/, .gravity or dotgravity, reports a path-guard redirect
  specifically to ~/.gravity/, asks to modify the Antigravity harness,
  invokes a harness-related skill (e.g. /document-wrapper), or works on
  extensions/docs under ~/.gravity/.
---

# Antigravity Context

Load the harness entry point to understand its architecture, rules, and locate its components.

```bash
read /Users/famillesendrison/.gravity/CONTEXT.md
```

Once loaded, follow the file's directives (writing rules, navigation to docs/wrappers/specs/tests).

## Use cases (Antigravity only)

| When the user says... | Then... |
|---|---|
| "my commit was rejected **in dotgravity**" / "**Antigravity** blocked my commit" | Identify the enforcer via the hooks → wrappers → enforcers architecture |
| "add a hook **in .gravity**" / "modify the **Antigravity** wrapper X" | Navigate to `git-hooks/` or `wrappers/<name>/` |
| "the path-guard redirects to **~/.gravity/**" | Apply the rule: write through `~/.gravity/`, never into `dotgravity/` |
| "commit **dotgravity**" | Use the commit command indicated in the file |
| "explain the **Antigravity** architecture" | Load the file and navigate to the indicated docs/specs |
| "modify the **Antigravity** harness" / "add an extension **in .gravity**" | Load the file then follow harness conventions |
| invokes `/document-wrapper` or another harness-related skill | Load the file to access harness configuration |
| works on wrappers/docs under **".gravity/"** / **"~/.gravity/"** | Load the file to navigate to specs and docs |
