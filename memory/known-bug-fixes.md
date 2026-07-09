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

## ImportMeta main Property Type Error in Bun Standalone Scripts

**Description:**
When writing standalone hook scripts intended to be executed by Bun, you may see IDE TypeScript errors saying:
`Property 'main' does not exist on type 'ImportMeta'.`

This happens because default TypeScript environment types do not include Bun-specific properties like `import.meta.main`.

**Generic Fix:**
For standalone hook scripts (e.g. in `~/.codex/hooks/` or `~/.pi/agent/extensions/`), do not augment global types or modify `tsconfig.json`.

The established fix is to suppress the error using `// @ts-expect-error` with a clear explanation right above the usage.

*Incorrect (Causes IDE Errors):*
```typescript
if (import.meta.main) {
	main().catch((err) => { ... });
}
```

*Correct (Works for both IDE and Bun):*
```typescript
// @ts-expect-error: Bun specific property missing from default types.
if (import.meta.main) {
	main().catch((err) => { ... });
}
```
