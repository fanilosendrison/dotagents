# Known Bugs and Fixes

## IDE Import Resolution Bug in Symlinked Gateways

**Description:**
When editing files through a symlinked gateway (e.g., `~/.codex/`, `~/.agents/`, `~/.pi/`), you will often see IDE TypeScript errors saying:
`Cannot find module '../../[project-name]/...' or its corresponding type declarations.`

This happens because the IDE's TypeScript language server resolves relative paths based on the gateway symlink path, which points to physical repos that aren't located where the IDE thinks they are. For example, `../../` from `~/.codex/hooks` logically resolves to `~/` instead of `~/Developper/Projects/`.

**Generic Fix:**
Do **NOT** attempt to fix this by using hardcoded absolute physical paths or dynamic `require()`.

The established and cleanest fix is to preserve pure static relative ESM imports in the code, and use the `rootDirs` compiler option in the gateway's `tsconfig.json` to merge the gateway's parent directory with the physical Projects directory.

This is required because standard TypeScript intentionally ignores the `paths` compiler option for relative module imports (imports starting with `.` or `..`). The `rootDirs` option is the correct and only way to resolve relative paths across disparate directory structures.

### Runtime (jiti / Pi Extensions)

**Description:**
Pi loads TypeScript extensions via **jiti** (ESM `import()`), which — like the IDE language server — preserves symlink paths when resolving relative imports. This causes the same resolution failure at runtime:

```
~/.pi/agent/extensions/extension.ts
  → import { ... } from "../../dotagents/..."
  → jiti résout depuis le symlink : ~/.pi/dotagents/...  ❌
```

**Runtime Fix:**
`rootDirs` ne résout que les erreurs IDE. Pour le runtime, ajuster l'import relatif pour naviguer dans la structure des gateways symlink plutôt que dans la structure physique des repos :

```typescript
// Avant (runtime error avec jiti) :
import { CommandValidator } from "../../dotagents/agent-enforcers/...";

// Après (fonctionne runtime + IDE) :
import { CommandValidator } from "../../../.agents/agent-enforcers/...";
```

Le chemin `../../../.agents/` depuis `~/.pi/agent/extensions/` atteint correctement `~/.agents/` (le gateway vers `~/Developper/Projects/dotagents/`).

Les deux fixes sont complémentaires : garder `rootDirs` dans `tsconfig.json` pour l'IDE, et ajuster les imports pour le runtime.

*Incorrect (Causes Portability Issues):*
```typescript
import { createEventSink } from "/Users/famillesendrison/Developper/Projects/telemetry-tools/event-sink/src/index.ts";
```

*Correct (Clean and Portable):*
```typescript
// In the source file:
import { createEventSink } from "../../telemetry-tools/event-sink/src/index.ts";
```
```json
// In ~/.codex/tsconfig.json:
{
  "compilerOptions": {
    // Merges ~ with ~/Developper/Projects/ so that ../../ resolves correctly
    "rootDirs": ["../", "../Developper/Projects"]
  }
}
```

## Missing Global Types (Node/Bun) in Standalone Scripts

**Description:**
When writing standalone hook scripts (e.g., in `~/.codex/hooks/` or `~/.pi/agent/extensions/`), you may see IDE TypeScript errors for global execution objects like `process`, `Buffer`, or `import.meta.main`. 

This happens because the IDE's TypeScript language server evaluates these standalone files without the full Node or Bun global type definitions loaded.

**Generic Fix:**
Do **NOT** attempt to mask these errors by sprinkling `// @ts-expect-error` or `// @ts-ignore` throughout the code.

The established and robust fix is to ensure `bun-types` is installed at the root of the physical repository and explicitly included in the `tsconfig.json`. This provides true type-safety.

*Correct Implementation:*
1. Add `bun-types` to the root `package.json` (`devDependencies`) of the physical repo.
2. Add `"types": ["bun-types"]` to the `compilerOptions` of the root `tsconfig.json`.
3. If the IDE opens the project via a gateway (e.g., `~/.codex/`), ensure `node_modules` and `package.json` are symlinked from the physical repo into the gateway, and that `~/.codex/tsconfig.json` explicitly lists `"types": ["bun-types"]`.
4. **CRITICAL:** The gateway's `tsconfig.json` MUST explicitly override the `"include"` array (e.g., `"include": ["hooks/**/*.ts"]`). Because TypeScript resolves inherited `include` paths relative to the base configuration directory, relying on the physical repo's `include` will cause the IDE to treat the gateway's files as isolated scripts, dropping the global typings and causing missing type errors (e.g., `Cannot find module 'node:fs'`).
