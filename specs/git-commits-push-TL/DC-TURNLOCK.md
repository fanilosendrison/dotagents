---
id: DC-TURNLOCK
type: dependency-contract
version: "1.0.0"
dependency_version: "workspace:*"
scope: turnlock
status: active
consumers: [claude-code]
referenced_by: [NIB-S-GIT-COMMITS-PUSH, NIB-M-PI-WRAPPER]
superseded_by: []
---

# 📄 Dependency Contract — turnlock

*VegaCorp — July 2026*

## 0. Identity
- **Component**: `turnlock`
- **Version**: Workspace internal module / CLI Orchestrator
- **Source**: Internal monorepo (`~/Developper/Projects/VegaCorp/turnlock`)
- **Role**: Master orchestrator and state provider. Il exécute les skills, fournit le répertoire de run (`runDir`) pour stocker les états sérialisés, et expose une librairie (protocol.ts) pour le formatage des messages de délégation.

## 1. Interface

```typescript
// Extraits de la librairie Turnlock consommés par la skill

// 1. Génération du bloc de protocole (stdout)
export interface DelegateFields {
  readonly runId: string;
  readonly orchestrator: string;
  readonly manifest: string;
  readonly kind: "skill" | "agent" | "agent-batch";
  readonly resumeCmd: string;
}

export function writeProtocolBlock(action: "DELEGATE", fields: DelegateFields): string;
export function writeProtocolBlock(action: "DONE", fields: DoneFields): string;
export function writeProtocolBlock(action: "ERROR", fields: ErrorFields): string;

// 2. Variables d'environnement fournies par l'orchestrateur au processus
// process.env.TURNLOCK_RUN_ID
// process.env.TURNLOCK_RUN_DIR
```

## 2. Behavioral contract

- **Preconditions**:
  - Le système s'attend à être exécuté *par* le binaire Turnlock (ou similairement).
  - En conséquence, les variables d'environnement `TURNLOCK_RUN_ID` et `TURNLOCK_RUN_DIR` doivent être définies lors de l'exécution par l'orchestrateur.
- **Postconditions**:
  - Les interactions (Delegation, Succès, Erreur) s'effectuent exclusivement en écrivant un bloc de protocole Turnlock généré via `writeProtocolBlock` sur la sortie standard (`stdout`).
  - L'état asynchrone (FSM) doit être écrit dans le dossier défini par `TURNLOCK_RUN_DIR`.

## 3. Error semantics

- Les erreurs critiques non gérées (Exceptions) ne doivent pas crasher silencieusement. Elles doivent idéalement être attrapées au niveau supérieur et retournées sous forme de `writeProtocolBlock("ERROR", ...)` sur stdout avant de `process.exit(1)`.
- Si le script `turnlock-skill.ts` crash violemment (exit code != 0 sans output Turnlock), l'orchestrateur Turnlock le considérera comme une erreur système fatale (ABORTED).

## 4. Integration patterns

**Pattern de Délégation (Phase 3) :**
```typescript
import { writeProtocolBlock } from "turnlock/protocol"; // ou le path interne correspondant

// ... construction du manifest
const manifestPath = path.join(process.env.TURNLOCK_RUN_DIR, "delegations", "commit-jobs-0.json");
await writeJsonFile(manifestPath, manifest);

const protocolBlock = writeProtocolBlock("DELEGATE", {
  runId: process.env.TURNLOCK_RUN_ID,
  orchestrator: "git-commits-push-TL",
  manifest: manifestPath,
  kind: "agent",
  resumeCmd: `bun run turnlock-skill.ts --resume` // Exécuté par le wrapper Pi
});

console.log(protocolBlock);
process.exit(0);
```

## 5. Consumer constraints
- **Silence stdout** : La skill ne doit RIEN écrire sur `stdout` qui ne soit pas un bloc Turnlock valide ou un texte de rapport terminal (Phase 5). Tout autre logging doit se faire sur `stderr` (qui n'est pas intercepté par la machine à états de Turnlock).
- **Paths dynamiques** : Ne jamais hardcoder un chemin `.turnlock/runs/...`. Toujours utiliser `process.env.TURNLOCK_RUN_DIR` injecté par l'orchestrateur parent.

## 6. Known limitations
- La librairie est liée structurellement au monorepo VegaCorp, il faut s'assurer que le path de résolution TypeScript pointe correctement vers le sous-projet Turnlock (`workspace:*` ou alias de path).
