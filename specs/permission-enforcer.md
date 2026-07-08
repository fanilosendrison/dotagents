# Spec: Explicit Permission Enforcer (`/go`)

## 1. Contexte & Objectif
Le **Permission Enforcer** est un garde-fou garantissant qu'un agent ne peut utiliser ses outils de modification de code sans une autorisation explicite de l'utilisateur pour le cycle en cours. Cette autorisation se matérialise par la présence de la commande `/go` dans le prompt de l'utilisateur.

## 2. Arborescence Cible
```
~/.agents/
├── agent-enforcers/
│   └── permission-enforcer/
│       └── src/
│           └── core/
│               ├── state.ts      # Gestion I/O du fichier d'état
│               └── checker.ts    # Logique de détermination des outils bloquants
│       └── .state/               # Dossier caché généré dynamiquement
│           └── config.json       # Fichier contenant l'autorisation booléenne
└── skills/
    └── go/
        └── SKILL.md              # Skill d'injection contextuelle
```

### Hooks par environnement
* **Claude / Codex**
  * `~/.claude/hooks/user-prompt-submit.ts`
  * `~/.claude/hooks/permission-enforcer.ts`
  * `~/.codex/hooks/user-prompt-submit.ts`
  * `~/.codex/hooks/permission-enforcer.ts`
* **Pi**
  * `~/.pi/agent/extensions/permission-enforcer.ts`
* **Antigravity**
  * `~/.gravity/wrappers/permission-enforcer/user-prompt.ts`
  * `~/.gravity/wrappers/permission-enforcer/pre-tool.ts`

## 3. Comportement (Mécanique Stateless)

### Phase 1 : Le Débloqueur (`user-prompt-submit` / `pi.on("user_prompt")` / `antigravity user-prompt`)
- À chaque soumission d'un prompt utilisateur, le texte est analysé.
- Si le pattern Regex `^\s*/go\b` (ou simplement `/go`) est détecté :
  - L'état bascule sur `true`.
- Sinon :
  - L'état bascule sur `false` (Reset automatique).

### Phase 2 : Le Bloqueur (`pre-tool-use` / `pi.on("tool_call")` / `antigravity pre-tool`)
- Lorsqu'un outil est invoqué, le hook vérifie le nom de l'outil.
- **Outils ciblés (Modificateurs) :** 
  - *Codex / Pi / Antigravity :* `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `apply_patch`.
  - *Claude Code :* `Write`, `Edit`, `Replace`, `NotebookEdit`.
  - *OpenCode :* `write`, `edit`.
- **Exception explicite :** `run_command`, `Bash`, `bash`, `Glob`, `LS`, `View`, `read`, `Grep`, `NotebookRead`.
- Si l'outil est ciblé et que l'état lu est `false`, la requête est bloquée avec l'erreur : 
  `❌ Permission denied. You cannot implement code without explicit permission. Ask the user to type '/go' to authorize implementation.`
- Si l'outil est ciblé et que l'état est `true`, la requête passe (`exitAllow`).

### Phase 3 : Injection Sémantique (Le Skill)
Le skill `/go` ne gère aucune logique système. Il ne contient que du markdown destiné à l'agent : 
*"The user has explicitly authorized you to implement changes in this turn. You are cleared to use code editing tools."*

## 4. Contrats I/O & Schémas JSON

### Fichier d'état (`config.json`)
**Localisation :** `~/.agents/agent-enforcers/permission-enforcer/.state/config.json`
**Schéma :**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "allowed": {
      "type": "boolean",
      "description": "True if /go was present in the last user prompt"
    }
  },
  "required": ["allowed"]
}
```

## 5. Pseudo-Code (Logique Core)

### `state.ts`
```typescript
function updatePermissionState(promptText: string): void {
    const isAllowed = /\/go(\s|$)/.test(promptText);
    writeFileSync(STATE_FILE_PATH, JSON.stringify({ allowed: isAllowed }));
}

function isPermissionGranted(): boolean {
    if (!existsSync(STATE_FILE_PATH)) return false;
    const data = JSON.parse(readFileSync(STATE_FILE_PATH));
    return data.allowed === true;
}
```

### `checker.ts`
```typescript
const RESTRICTED_TOOLS = ["write_to_file", "replace_file_content", "multi_replace_file_content", "apply_patch", "Write", "Edit"];

function shouldBlockTool(toolName: string): boolean {
    if (!RESTRICTED_TOOLS.includes(toolName)) {
        return false;
    }
    return !isPermissionGranted();
}
```
