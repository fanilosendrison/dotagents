# Pont Turnlock ↔ `/go` — Spécification de Conception

Ce document spécifie comment l'orchestrateur `/go` **consomme** le runtime
Turnlock. Il fait le pont entre l'API publique Turnlock v0.8.0 et les contrats
métier `/go` décrits dans les specs de conception (`run-init.md`,
`go-workflow-contract.md`, `workflow-artifacts.md`).

---

## 1. Liaison npm

### 1.1 Package identity

| Propriété          | Valeur                                              |
|--------------------|-----------------------------------------------------|
| Nom du package     | `turnlock`                                          |
| Version contrainte | `^0.8.0` (semver minor-compatible)                  |
| Module type        | ESM (`"type": "module"`)                            |
| Engine constraint  | `node >= 22` (copié de Turnlock)                    |
| Runtime            | Bun (primary), Node.js ≥ 22 (secondary)            |

### 1.2 Mode de liaison en développement

Turnlock vit dans un repo séparé (`VegaCorp/turnlock`). En développement local,
on utilise une liaison fichier relative dans le package.json :

```json
{
  "dependencies": {
    "turnlock": "file:../../../VegaCorp/turnlock",
    "zod": "4.4.3"
  }
}
```

> [!WARNING]
> **Build préalable requis** : Le point d'entrée de Turnlock est
> `"main": "./dist/index.js"`. Avant d'exécuter `bun install` ou de lancer
> `/go`, il faut impérativement builder Turnlock en exécutant :
>
> ```bash
> cd ../../../VegaCorp/turnlock && bun run build
> ```

### 1.3 Future : CI et packaging

Le lien `file:` est acceptable pour le développement local Phase 1. Avant
release, il devra être remplacé par :

- Un package npm publié (`"turnlock": "^0.8.0"`), ou
- Un lien conditionnel (npm `link:` en dev, npm registry en CI), ou
- Un vendor bundle si Turnlock n'est pas publié publiquement.

---

## 2. Compatibilité de Version Zod (Zod 3 ↔ Zod 4)

### 2.1 Conflit de Types TypeScript

Turnlock v0.8.0 utilise `zod: "^3.22.0"`, tandis que `/go` utilise
`zod: "4.4.3"`. TypeScript rejette l'affectation directe de schémas Zod v4 aux
paramètres typés avec le `ZodSchema` de Zod v3 en raison d'un discriminant de
version interne (`_zod.version.minor` incompatible).

### 2.2 Résolution : Option C.2 (Casting avec `as any`)

- **Runtime** : Compatible pour la surface utilisée par Turnlock (`safeParse`
  et `error.issues`). Ces deux API sont stables entre Zod v3 et v4. Le reste
  de l'API Zod n'est pas consommé par le runtime Turnlock.
- **TypeScript** : Pour compiler sans erreur, tous les schémas Zod v4 passés à
  Turnlock (comme `stateSchema` ou les schémas passés à `consumePendingResult`)
  doivent être castés avec `as any` ou `as unknown as ZodSchema<any>`.
  Idéalement, aligner les versions Zod entre `/go` et Turnlock éliminerait
  ces casts ; en attendant, un adaptateur de validation explicite est une
  alternative plus propre que `as any`.

Exemple :

```ts
const config: OrchestratorConfig<object> = {
  // ...
  stateSchema: runtimeStateSchema as any,
};
```

---

## 3. `OrchestratorConfig` et Stratégie de Typage du State

### 3.1 Choix de Typage : Option B (Pragmatique)

Turnlock attend un type `State` unique pour toutes ses phases. Pour gérer la
transition de schéma `BootstrapState` → `WorkflowState` de manière simple et
propre, nous choisissons l'**Option B** :

- L'orchestrateur est configuré avec un type d'état générique `object` :
  `OrchestratorConfig<object>`.
- Le typage fort et la validation structurelle sont garantis par `stateSchema`
  (Zod discriminated union).
- Les phases effectuent un transtypage (cast) interne pour manipuler le schéma
  adéquat.

> [!IMPORTANT]
> **GO_ENTRY_PATH** : Dans l'environnement de développement avec gateways
> symlink (`~/.agents/`), `import.meta.dirname` résout vers le chemin
> physique `dotagents/`. Le harness parent (wrapper Antigravity) doit
> fournir le chemin logique via la variable d'environnement
> `GO_ENTRY_PATH`. L'absence de cette variable en mode harness est une
> erreur de configuration Phase 1.

```ts
import { runOrchestrator, definePhase } from "turnlock";
import type { OrchestratorConfig, Phase } from "turnlock";
import { runtimeStateSchema } from "./schemas/runtime-state.js";
import { runInitPhase } from "./phases/run-init.js";
import { implementationSettlementStub } from "./phases/implementation-settlement.js";
import { dummyPhase } from "./phases/dummy-phase.js";

// Chemin logique fourni par le harness parent (obligatoire sous gateway).
function resolveGoEntryPath(): string {
  if (process.env.GO_ENTRY_PATH) return process.env.GO_ENTRY_PATH;
  // Fallback pour les tests hors gateway uniquement
  if (process.argv[1]) return process.argv[1];
  throw new Error(
    "GO_ENTRY_PATH: missing env var (required under gateway harness)"
  );
}
const GO_ENTRY_PATH = resolveGoEntryPath();

const config: OrchestratorConfig<object> = {
  name: "go",
  initial: "run-init",
  phases: {
    "run-init": runInitPhase as Phase<object, any, any>,
    "implementation-settlement": implementationSettlementStub as Phase<object, any, any>,
    "dummy-phase": dummyPhase as Phase<object, any, any>,
  },
  // initialState : doit être resume-aware (cf. §4).
  // En mode fresh, construit le vrai BootstrapState depuis les args.
  // En mode resume, produit un dummy valide (Turnlock lit le state depuis
  // le disque ; le dummy n'est jamais consommé).
  initialState: buildInitialState(),
  stateSchema: runtimeStateSchema as any, // Cast Zod 4 -> Zod 3
  resumeCommand: (runId) =>
    `bun run ${GO_ENTRY_PATH} --run-id ${runId} --resume`,
  runDirRoot: resolveGoRunRoot(),  // e.g. ~/.go-runs
  logging: {
    enabled: true,
    persistEventLog: true,
  },
};

/**
 * Construit l'état initial en fonction du mode d'exécution.
 *
 * - Mode fresh (pas de `--resume`) : construit le BootstrapState à
 *   partir des arguments du parent process.
 * - Mode resume (`--resume`) : retourne un BootstrapState dummy valide
 *   selon bootstrapStateSchema. Turnlock ne consomme jamais cet objet
 *   en mode resume — il lit le state depuis le StateFile sur disque.
 */
function buildInitialState(): object {
  const isResume = process.argv.includes("--resume");
  if (isResume) {
    // Turnlock valide initialState contre stateSchema même en mode resume.
    // On fournit un BootstrapState syntaxiquement valide mais sémantiquement
    // vide — Turnlock le remplace par le state lu sur disque avant dispatch.
    return {
      schema: "go.bootstrap-state.v1",
      invocationDirectory: process.cwd(),
      policy: buildDefaultWorkflowPolicy(),
      captureContext: {
        schema: "go.capture-context.v1",
        sessionRef: "",
        promptAtGo: "",
      },
    };
  }
  return buildBootstrapState(/* from parent process args */);
}

await runOrchestrator(config);
```

### 3.2 Schéma Zod du State (`runtimeStateSchema`)

```ts
import { z } from "zod";

const bootstrapStateSchema = z.object({
  schema: z.literal("go.bootstrap-state.v1"),
  invocationDirectory: z.string().min(1),
  policy: workflowPolicySchema,
  captureContext: captureContextSchema,
});

const workflowStateSchema = z.object({
  schema: z.literal("go.workflow-state.v1"),
  runId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  runInit: runInitRecordSchema,
  policy: workflowPolicySchema,
  repository: repositoryContextSchema,
  currentStage: z.string().nullable(),
  bootstrapTasks: z.array(bootstrapTaskRecordSchema),
  snapshots: z.array(z.unknown()),
  executionRecords: z.array(z.unknown()),
  businessArtifacts: z.array(z.unknown()),
  checks: z.array(z.unknown()),
  findings: z.array(z.unknown()),
  humanGates: z.array(z.unknown()),
  remediations: z.array(z.unknown()),
  branches: z.array(z.unknown()),
  commits: z.array(z.unknown()),
  pullRequests: z.array(z.unknown()),
  mergeTracking: z.array(z.unknown()),
}).passthrough(); // Phase 1 : accepte les champs supplémentaires non listés
                  // (runCapture, workSession, projectDiscovery, etc.).
                  // À remplacer par .strict() quand le contrat se stabilise.

// Union discriminée validée par Turnlock à chaque transaction
export const runtimeStateSchema = z.discriminatedUnion("schema", [
  bootstrapStateSchema,
  workflowStateSchema,
]);
```

> [!IMPORTANT]
> **Validation initiale** : Turnlock valide `initialState` par
> `stateSchema.safeParse` dès le lancement de `runOrchestrator`. L'objet
> produit par `buildBootstrapState` doit donc obligatoirement être conforme au
> schéma `bootstrapStateSchema`.

---

## 4. Définition des Phases

### 4.1 Phase `run-init`

La phase effectue un cast de l'état d'entrée pour s'assurer qu'il s'agit du
`BootstrapState` :

```ts
export const runInitPhase = definePhase<object>(
  async (rawState, io): Promise<PhaseResult<object>> => {
    // 1. Validation de type à l'entrée de la phase
    const validation = bootstrapStateSchema.safeParse(rawState);
    if (!validation.success) {
      return io.fail(new Error("run-init expects BootstrapState structure"));
    }
    const state = validation.data;

    // 2. Exécution du pipeline
    const workflowState = await executeBootstrapPipeline({
      invocationDirectory: state.invocationDirectory,
      policy: state.policy,
      captureContext: state.captureContext,
      runId: io.runId,
      runDir: io.runDir,
      logger: io.logger,
      clock: io.clock,
      signal: io.signal,
      refreshLock: () => io.refreshLock(),
    });

    // 3. Délégation de l'implémentation
    return io.delegate(
      {
        kind: "prompt",
        label: "implementation",
        prompt: buildImplementationPrompt(workflowState),
      },
      "implementation-settlement",
      workflowState, // transitionne vers WorkflowState
    );
  }
);
```

### 4.2 Phase `implementation-settlement` (Stub Phase 1)

> [!WARNING]
> **Échafaudage temporaire** : cette phase est un stub Phase 1 uniquement.
> En Phase 2, `implementation-settlement` transitionnera vers
> `change-snapshot` conformément au
> [workflow contract](../contracts/go-workflow-contract.md).
> Le `dummy-phase` sera supprimé.

Pour tester la boucle complète de délégation en Phase 1, cette phase sert de
point de reprise :

```ts
export const implementationSettlementStub = definePhase<object>(
  async (state, io): Promise<PhaseResult<object>> => {
    // consumePendingResult DOIT impérativement être appelé en premier
    // (sinon Turnlock rejette la transition)
    const result = io.consumePendingResult(implementationResultSchema as any);

    io.logger.emit({
      eventType: "phase_start",
      runId: io.runId,
      phase: "implementation-settlement",
      attemptCount: 1,
      timestamp: io.clock.nowWallIso(),
    });

    // Transitionne vers dummy-phase en transmettant l'état tel quel.
    // NOTE : En Phase 2, cette transition enrichira réellement le
    // WorkflowState (snapshots, business artifacts).
    return io.transition("dummy-phase", state);
  }
);
```

---

## 5. Modèle d'Exécution Asynchrone de `run-init`

Les bootstrap tasks s'exécutent in-process. La séquence asynchrone est découpée
en deux branches asymétriques exécutées en parallèle pour respecter les
dépendances de données.

### 5.1 Contrat de cancellation

Le contrat `run-init` §1.3 exige : *"si une branche échoue, run-init annule
les branches encore actives, attend leur terminaison contrôlée ou leur timeout
court, puis échoue"*. L'implémentation ci-dessous utilise :

- Un `AbortController` partagé entre les deux branches.
- Un wrapper `abortOnReject` qui déclenche l'annulation au premier échec.
- `Promise.allSettled` qui attend la terminaison des deux branches (même
  après annulation).

```ts
async function executeBootstrapPipeline(
  ctx: BootstrapContext
): Promise<WorkflowState> {
  const ac = new AbortController();

  // Propagation de l'annulation Turnlock vers le contrôleur enfant
  const onTurnlockAbort = () => ac.abort(ctx.signal.reason);
  ctx.signal.addEventListener("abort", onTurnlockAbort, { once: true });

  // Wrapper : au premier rejet, annule le contrôleur partagé
  const abortOnReject = async <T>(promise: Promise<T>): Promise<T> => {
    try {
      return await promise;
    } catch (err) {
      ac.abort(err);
      throw err;
    }
  };

  try {
    // 1. Séquentiel : pré-requis obligatoires pour identifier le dépôt
    const prereqResult = await runPrerequisiteValidation(ctx, ac.signal);
    const repoCapture = await runRepoCapture(ctx, ac.signal);

    // 2. Parallélisation avec cancellation au premier échec
    const runCapturePromise = abortOnReject(
      runRunCapture(ctx, repoCapture, ac.signal)
    );

    const runGitChain = async () => {
      const dirty = await runDirtyStateCapture(ctx, repoCapture, ac.signal);
      const workspace = await runWorkspaceSetup(
        ctx, repoCapture, dirty, ac.signal
      );
      const discovery = await runProjectDiscovery(
        ctx, workspace, ac.signal
      );
      return { dirty, workspace, discovery };
    };
    const gitChainPromise = abortOnReject(runGitChain());

    // allSettled attend la terminaison des deux branches même après abort
    const [runCaptureSettled, gitChainSettled] = await Promise.allSettled([
      runCapturePromise,
      gitChainPromise,
    ]);

    // Propagation des erreurs après terminaison des deux branches
    if (runCaptureSettled.status === "rejected") {
      throw runCaptureSettled.reason;
    }
    if (gitChainSettled.status === "rejected") {
      throw gitChainSettled.reason;
    }

    // 3. Join, validation finale et projection
    return projectWorkflowState(ctx, {
      prereqResult,
      repoCapture,
      runCaptureResult: runCaptureSettled.value,
      ...gitChainSettled.value,
    });
  } finally {
    ctx.signal.removeEventListener("abort", onTurnlockAbort);
  }
}
```

---

## 6. Extension Git CLI : `DC-GIT-CLI-BOOTSTRAP.md`

Les bootstrap tasks ont des besoins Git plus larges que le stage-harness. Pour
ne pas altérer le contrat stable `DC-GIT-CLI.md` déjà approuvé, nous créons un
contrat étendu `DC-GIT-CLI-BOOTSTRAP.md` dans `specs/briefs/orchestrator/`.

### 6.1 Commandes Git supplémentaires contractualisées

1. **`git worktree add/remove/prune/repair/lock/list`** : Gestion du cycle de
   vie du worktree isolé.
2. **`git init`** : Initialisation en cas de dépôt local temporaire.
3. **`git remote add/set-url`** : Configuration des remotes en cas d'absence.
4. **`git push -u origin`** : Publication de branches initiales ou de
   correctifs.
5. **`git apply --check/--binary`** : Replay du dirty state patch.
6. **`git submodule update --init --recursive`** : Récupération des submodules.
7. **`git lfs pull`** : Récupération des fichiers LFS.
8. **`git symbolic-ref`** : Résolution du pointeur HEAD symbolique.
9. **`git config --get init.defaultBranch`** : Découverte du nom par défaut
   des branches.
10. **`git branch -f`** : Forçage ou déplacement de pointeurs locaux.
11. **`git merge-base --is-ancestor`** : Vérification des parentés de commits.
12. **`git read-tree`** (avec variable d'env `GIT_INDEX_FILE`) : Isolation
    d'index pour capture de patch.
13. **`git diff --cached --binary --full-index`** : Génération de patch binaire
    propre.
14. **`git hash-object`** : Hachage rapide de blobs de dirty state.
15. **`git check-ignore`** : Filtrage des fichiers lors de la discovery de
    projet.
16. **`git -c core.hooksPath=/dev/null`** : Contournement des hooks locaux pour
    éviter les blocages.
17. **`git -c core.quotePath=false status --porcelain`** : Status porcelain
    UTF-8 propre.
18. **`git ls-files -v`** : Détection des fichiers avec flags skip-worktree.

---

## 7. Gestion du Lock et des Signaux

### 7.1 Refresh du Lock et opérations Git asynchrones

Le lease de lock par défaut de Turnlock est de 30 minutes. Les opérations Git
longues (clone, LFS pull, submodule update) peuvent le dépasser.

**Règle impérative** : les opérations Git bloquantes doivent utiliser
`Bun.spawn()` asynchrone (jamais `spawnSync`/`execSync`). Un `setInterval`
rafraîchit le lock pendant l'exécution, et l'annulation tue le sous-processus :

```ts
const refreshInterval = setInterval(
  () => ctx.refreshLock(),
  25 * 60 * 1000  // 25 minutes
);

try {
  const proc = Bun.spawn(["git", ...args], {
    cwd: workDir,
    // Jamais hériter stdout enfant : stdout est réservé au protocole
    // Turnlock. Capturer ou rediriger vers stderr / fichiers d'evidence.
    stdout: "pipe",
    stderr: "pipe",
  });

  // Propager l'annulation au sous-processus
  const onAbort = () => { proc.kill(); };
  ctx.signal.addEventListener("abort", onAbort, { once: true });

  try {
    // Drainer stdout/stderr en parallèle pour éviter le blocage du
    // sous-processus sur un pipe plein.
    const [exitCode, _stdout, _stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    if (exitCode !== 0) {
      throw new Error(
        `Git command failed with exit code ${exitCode}: ${_stderr}`
      );
    }
  } finally {
    ctx.signal.removeEventListener("abort", onAbort);
  }
} finally {
  clearInterval(refreshInterval);
}
```

**Contrat stdout** : `stdout` enfant ne doit jamais être hérité (`"inherit"`)
car `process.stdout` est réservé au protocole `@@TURNLOCK@@`. Les sorties
standard des commandes Git doivent être capturées (`"pipe"`) et redirigées
vers `stderr`, les fichiers d'evidence, ou les logs.

### 7.2 Signaux

Turnlock gérant la capture de `SIGINT`/`SIGTERM` à haut niveau, l'annulation se
propage via `ctx.signal` (un `AbortSignal`). Les bootstrap tasks interceptent
l'événement `abort` et s'efforcent d'écrire un `task-record.json` avec le
statut `"cancelled"` avant de s'arrêter.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
