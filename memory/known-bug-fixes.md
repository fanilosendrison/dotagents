# Known Bugs and Fixes

## IDE Import Resolution Bug in Symlinked Gateways

**Description:**
When editing files through a symlinked gateway (e.g., `~/.codex/`, `~/.agents/`, `~/.pi/`), you will often see IDE TypeScript errors saying:
`Cannot find module '../../[project-name]/...' or its corresponding type declarations.`

This happens because:
1. The IDE's TypeScript language server resolves paths **logically** based on the symlink path (e.g., `../../` from `~/.codex/hooks` lands in `~/`).
2. The target workspace (e.g., `~/telemetry-tools` or `~/dotagents`) does not physically exist in your home directory `~/`.
3. However, tools like `bun` execute perfectly fine because they resolve the symlink to its physical path (`~/Developper/Projects/dotcodex/hooks/`) before applying the relative traversal.

**Generic Fix:**
Do **NOT** attempt to fix this by modifying `tsconfig.json` or by creating new symlinks in `~/`.

The established and robust fix is to convert the cross-workspace relative imports into **absolute physical paths**.

Whenever an import crosses the boundary of its physical repository, rewrite it to use the absolute path to `/Users/famillesendrison/Developper/Projects/...` and explicitly append `.ts` (or `.js`).

*Incorrect (Causes IDE Errors):*
```typescript
import { createEventSink } from "../../telemetry-tools/event-sink/src/index";
import { CommandValidator } from "../../dotagents/agent-enforcers/command-validator/src/core/validator";
```

*Correct (Works for both IDE and Bun):*
```typescript
import { createEventSink } from "/Users/famillesendrison/Developper/Projects/telemetry-tools/event-sink/src/index.ts";
import { CommandValidator } from "/Users/famillesendrison/Developper/Projects/dotagents/agent-enforcers/command-validator/src/core/validator.ts";
```

## Missing Global Types (Node/Bun) in Standalone Scripts

**Description:**
When writing standalone hook scripts (e.g., in `~/.codex/hooks/` or `~/.pi/agent/extensions/`), you may see IDE TypeScript errors for global execution objects like `process` or `import.meta.main`. 

Examples of errors:
- `Cannot find name 'process'.`
- `Property 'main' does not exist on type 'ImportMeta'.`

This happens because the IDE's TypeScript language server evaluates these standalone files without the full Node or Bun global type definitions loaded. However, the runtime (`bun`) executes them perfectly fine.

**Generic Fix:**
For standalone hook scripts, do **NOT** attempt to fix this by modifying `tsconfig.json` or creating global type augmentations.

The established and cleanest fix is to suppress the error using `// @ts-expect-error` with a clear explanation right above the usage.

*Incorrect (Causes IDE Errors):*
```typescript
if (import.meta.main) {
	process.exit(2);
}
```

*Correct (Works for both IDE and Bun):*
```typescript
// @ts-expect-error: Bun specific property missing from default types.
if (import.meta.main) {
	// @ts-expect-error: Missing Node global types in standalone hook script.
	process.exit(2);
}
```
