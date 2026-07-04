# Post-Write Linter

Automatically runs **Biome** on modified files after every `Write` or `Edit`, and blocks the result if linting fails.

## 1. Wiring — 2 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_result")` | **Pi** | `~/.pi/agent/extensions/post-write-linter.ts` |
| 2 | **Post-tool-use hook** · reads stdin JSON | **Claude + Codex** | `~/.claude/hooks/post-write-linter.ts` (Claude) / `~/.codex/hooks/post-write-linter.ts` (Codex) |

This is the **only** enforcer that acts **after** tool execution, not before.

## 2. Trigger flow

```
Write / Edit / apply_patch executed by the agent
        │
        ▼
┌──────────────────────────────────────┐
│  Gets the touched file(s)            │
│                                      │
│  Write/Edit : file_path / path       │
│  apply_patch : extracted from diff   │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  checkFile(file)                     │
│                                      │
│  1. Skip if not .ts/.tsx/.js/.jsx    │
│     or .json                         │
│  2. Runs : biome check --write       │
│  3. Parses the result                │
└──────────────┬───────────────────────┘
     Success   │  Failure (Biome errors)
     (clean)   ▼
     ✅     ┌──────────────────────────────────┐
     Passes │  Block + error message            │
            │  with Biome output                │
            └──────────────────────────────────┘
```

## 3. How it works

### The linter (`src/core/linter.ts`)

```typescript
export function checkFile(filePath: string): { success: boolean; output?: string }
```

1. **Extension filter** : only processes `.ts`, `.tsx`, `.js`, `.jsx`, `.json`
2. **Command** : `biome check --write <file>`
3. **Return value** :
   - `{ success: true }` → biome succeeded (or auto-fix succeeded)
   - `{ success: false, output: "..." }` → biome found non-auto-fixable errors

### File extraction for `apply_patch`

The file `src/core/patch-files.ts` parses the diff of a patch to extract modified files :

```typescript
export function extractTouchedFilesFromApplyPatch(
    patchCommand: string,
    cwd: string
): string[]
```

## 4. Files that get linted

| Extension | Linted? |
|-----------|---------|
| `.ts` | ✅ Yes |
| `.tsx` | ✅ Yes |
| `.js` | ✅ Yes |
| `.jsx` | ✅ Yes |
| `.json` | ✅ Yes |
| `.md` | ❌ No |
| `.css` | ❌ No |
| Any other | ❌ No |

## 5. Behavior by runtime

### Pi (Extension `tool_result`)

| Situation | Behavior |
|-----------|----------|
| `Write` valid `.ts` file | ✅ Passes |
| `Write` `.ts` file with syntax error | ❌ Block : `isError: true` + Biome output |
| `Write` `.ts` file with unused import | ❌ Block : Biome linter violation |
| `Edit` valid `.json` file (auto-fix) | ✅ Passes (Biome auto-corrects) |
| `Write` `README.md` | ✅ Passes (not linted) |

### Claude/Codex (Post-tool-use hook)

| Situation | Behavior |
|-----------|----------|
| No Biome errors | ✅ Passes (exitAllow) |
| Biome errors in a file | ❌ `postToolBlock` + Biome output |

## 6. File tree

```
post-write-linter/
├── src/
│   ├── core/
│   │   ├── linter.ts                  ← checkFile() — runs biome check --write
│   │   ├── patch-files.ts             ← extractTouchedFilesFromApplyPatch()
│   │   └── patch-files.test.ts
│   └── bin/
│       ├── post-tool-use.ts           ← Post-execution hook
│       └── post-tool-use.test.ts
```

## 7. Agent mitigation (when blocked)

1. **Read the Biome output** — it tells you the exact file, line, and violated rule
2. **Fix with `Edit`** — use the Edit tool to correct the reported issues
   - Syntax error : fix the syntax
   - Unused import : remove the import
   - Formatting : Biome auto-fix was already applied, so this is a real rule violation
3. **Retry** the original action — after fixing, the linter will pass
4. **Do not** bypass by renaming the file `.txt` or using `bash echo > file.ts`
