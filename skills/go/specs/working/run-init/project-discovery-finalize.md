# Startup task `project-discovery-finalize`

`project-discovery-finalize` détermine les commandes de gates mécaniques du
projet. Elle suit deux chemins :

1. **Chemin déclaratif** : si un `STACK_EVAL.yaml` est présent à la racine
   du worktree, elle lit les décisions de stack directement.
2. **Chemin heuristique** : sinon, elle scanne le worktree par écosystème
   avec un registre exhaustif de signaux de détection.

Cette tâche n'est pas un join et ne consomme aucun brouillon intermédiaire.
Elle opère directement depuis le workspace isolé.

---

## 1. Objectif

Produire une matrice de gates mécaniques adaptée au dépôt, validée contre le
workspace privé et isolé du run.

Le résultat durable est l'artefact `ProjectDiscovery`.

---

## 2. Position dans le workflow

`project-discovery-finalize` s'exécute séquentiellement après
`workspace-setup` et avant la délégation `implementation`.

```text
            repo-capture
          ┌──────┴──────┐
          ▼             ▼
     run-capture    dirty-state
          │             │
          │             ▼
          │        workspace-setup
          │             │
          │             ▼
          │   project-discovery-finalize
          │             │
          └──────┬──────┘
                 ▼
        delegate implementation
```

Elle s'exécute de manière bloquante : la délégation `implementation` ne peut
pas être émise tant que `project-discovery-finalize` n'a pas validé et publié
la matrice de checks définitive.

---

## 3. Inputs

- `WorkSession` (générée par `workspace-setup`).
- `workspaceRoot` (chemin physique résolu du workspace isolé).
- `artefactRoot` (répertoire réservé aux preuves).
- `WorkflowPolicy.discovery` (règles de découverte).
- `WorkflowPolicy.gates` (règles des gates mécaniques).
- `projectRoot` (optionnel, sous-périmètre de projet issu de `WorkSession`).

---

## 4. Outputs

Artefact métier écrit sous
`artefactRoot/startup/project-discovery-finalize/project-discovery.json` :

```ts
type ProjectDiscovery = {
  schema: "go.project-discovery.v1";
  id: string;
  runId: string;
  source: "stack-eval" | "ecosystem-scan";
  stackEvalRef?: string;
  finalizedAgainstWorkspaceRoot: string;
  inspectedFiles: InspectedFileRef[];
  packageManager?: PackageManager;
  lockfiles: string[];
  checkCommands: MechanicalCheckDefinition[];
  testCommands: MechanicalCheckDefinition[];
  buildCommands: MechanicalCheckDefinition[];
  providerCapabilities: ProviderCapabilities;
};

type PackageManager =
  | "bun"
  | "npm"
  | "pnpm"
  | "yarn"
  | "cargo"
  | "go"
  | "uv"
  | "pip"
  | "poetry"
  | "make"
  | "just"
  | "maven"
  | "gradle"
  | "dotnet"
  | "bundler"
  | "composer"
  | "mix"
  | "deno"
  | "unknown";
```

Fichiers de preuves (dans le sous-dossier `project-discovery-finalize/`)
contenant les manifestes détectés, la copie du `STACK_EVAL.yaml` s'il est
utilisé, les commandes candidates rejetées et résultats de discovery. Cette
tâche produit également un `WorkflowExecutionRecord` d'audit.

---

## 5. Pipeline

### 5.1 Vérification des prérequis
S'assurer que la `WorkSession` et le répertoire physique du workspace privé
`workspaceRoot` sont bien présents et accessibles. Déterminer le répertoire
de travail effectif : `workspaceRoot` ou `workspaceRoot/projectRoot` si un
sous-périmètre est spécifié.

### 5.2 Chemin déclaratif : `STACK_EVAL.yaml`

1. Vérifier l'existence de `STACK_EVAL.yaml` à la racine du worktree.
2. Si présent, le parser. Extraire :
   - `decisions.language`, `decisions.language_version`
   - `decisions.runtime`, `decisions.runtime_version`
   - `decisions.package_manager`
   - `decisions.linter`
   - `decisions.test_runner`
   - `decisions.type_checker`
   - `decisions.ci`
3. Construire les commandes de check à partir de ces champs (voir registre
   §9 pour la correspondance décision → commande).
4. Valider que les fichiers de configuration attendus pour ces décisions
   sont présents dans le worktree (ex: si `linter: biome`, vérifier que
   `biome.json` existe).
5. Hasher chaque fichier de configuration inspecté.
6. Définir `source: "stack-eval"` et `stackEvalRef` pointant vers la copie
   du fichier dans les preuves.
7. Aller directement à §5.4 (pas de scan heuristique).

### 5.3 Chemin heuristique : scan par écosystème

Si `STACK_EVAL.yaml` est absent, scanner le worktree selon le registre
exhaustif du §9.

**Stratégie d'I/O optimale :** un seul `readdir` au lieu d'un `existsSync`
par signal. La racine du worktree contient typiquement moins de 100 entrées ;
un appel `readdir` coûte ~1 ms. En comparaison, 60 `existsSync` individuels
coûtent ~60 ms. L'approche est donc :

```text
1. entries = fs.readdir(worktreeRoot)  → 1 appel I/O
2. set     = new Set(entries)           → 0 appel I/O
3. pour chaque ecosysteme dans le registre :
     si set.has(lockfile) ou set.has(manifeste) → ecosysteme detecte
```

Le match est fait en mémoire contre le registre du §9. Aucun appel
`existsSync`, `statSync` ou `accessSync` n'est utilisé pour la détection
des écosystèmes. Les fichiers de configuration de tooling (`.eslintrc.*`,
`biome.json`, etc.) sont vérifiés de la même manière si l'écosystème parent
est détecté.

Pour chaque écosystème détecté, dans l'ordre de priorité défini :

1. Détecter les signaux de présence (lockfiles, manifestes).
2. Si un écosystème est détecté, identifier :
   - Le package manager.
   - Les lockfiles associés.
   - Les fichiers de configuration de tooling pertinents.
   - Les commandes de check, test et build candidates.
3. Si plusieurs écosystèmes sont détectés (projet multi-langage), les
   traiter tous.
4. Hasher chaque fichier inspecté.
5. Définir `source: "ecosystem-scan"`.

### 5.4 Filtrage et construction de la matrice
1. Filtrer les commandes selon `WorkflowPolicy.gates.requiredKinds`.
2. Si un type de gate requis n'est pas détectable, et que
   `WorkflowPolicy.discovery.noReliableGateBehavior` vaut `"human-gate"`,
   ouvrir une HumanGate. Sinon, échouer avec `failed`.
3. Préférer les scripts déclarés par le projet (ex: `scripts` dans
   `package.json`) aux conventions génériques.

### 5.5 Persistance
1. Écrire le `ProjectDiscovery` validé contre son schéma.
2. Copier `STACK_EVAL.yaml` dans les preuves si utilisé.
3. Persister le `WorkflowExecutionRecord` d'audit.

---

## 6. Règles & Invariants

### 6.1 Non-modification du dépôt
La tâche ne doit en aucun cas modifier le code du dépôt ou écrire dans le
workspace privé. Les fichiers d'évidences ou de rapports doivent être écrits
exclusivement dans `artefactRoot`.

### 6.2 Chemin déclaratif prioritaire
Si `STACK_EVAL.yaml` est présent et valide, il est **toujours** utilisé.
Aucun scan heuristique n'est effectué en parallèle. Les décisions du
`STACK_EVAL.yaml` font autorité — la tâche vérifie seulement que les
fichiers de configuration attendus existent, pas que les décisions sont
correctes.

### 6.3 Déterminisme écosystème
Pour le chemin heuristique, l'ordre de priorité des écosystèmes est fixe et
documenté au §9. Le comportement doit être déterministe pour un worktree
donné.

### 6.4 Priorité aux scripts locaux
Dans le chemin heuristique, les scripts et configurations déclarés par le
projet (ex: `scripts` dans `package.json`, `[scripts]` dans `Cargo.toml`)
sont préférés aux conventions génériques du harness.

### 6.5 Outils et resolveurs officiels
Pour analyser les dépendances et structures du projet, la tâche doit
privilégier les commandes et APIs officielles des gestionnaires de paquets
(ex: `cargo metadata`, `go list -json`) et rejeter les parseurs "maison" de
fichiers de verrouillage.

### 6.6 Checkpoints et comportement au retry

La tache ecrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/project-discovery-finalize/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte JCS de `{ runId, artefactRoot, workspaceRoot,
  projectRoot }`, les inputs directs non couverts par les hashes
  partages. `projectRoot` est optionnel et normalise a `null` si absent.
- `repoCaptureHash` : **pertinent**. Le contexte du depot cible
  (`canonicalRepositoryRoot`, `projectRoot`) est verifie
  indirectement via la `WorkSession` produite par `workspace-setup`.
- `workflowPolicyHash` : **pertinent**. La tache consomme
  `WorkflowPolicy.discovery` et `WorkflowPolicy.gates` pour decider
  du filtrage des gates et du comportement en cas d'absence de gates
  fiables.
- `captureContextHash` : fixe a la valeur sentinelle deterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zeros). Cette tache ne consomme pas le `CaptureContext`.

**Comportement au retry :**
- Checkpoint terminal present et tous les hashes pertinents identiques
  (`inputHash`, `repoCaptureHash`, `workflowPolicyHash`) → adoption
  directe du `ProjectDiscovery` precedent.
- Checkpoint absent → execution complete.
- `inputHash`, `repoCaptureHash` ou `workflowPolicyHash` different
  (mismatch) → echec ferme (`failed`). Les inputs de la tache ont
  change entre deux executions du meme `runId`.
- Checkpoint terminal `failed` ou `errored` → echec ferme (pas de
  re-execution automatique sans intervention).

---

## 7. Opérations internes typiques

- `load-work-session`
- `check-stack-eval-exists` → si oui, branche déclarative
- `parse-stack-eval` → extraire décisions
- `validate-stack-eval-against-workspace` → vérifier fichiers de config
- `scan-ecosystem-signals` → détection par lockfile/manifeste
- `resolve-package-manager`
- `resolve-tooling-configs` → `.eslintrc.*`, `biome.json`, etc.
- `extract-candidate-commands`
- `build-mechanical-gate-matrix`
- `write-discovery-evidence`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Action corrective |
|---|---|---|---|
| 5.1 | `WorkSession` absent ou illisible | `errored` | Arrêt de la tâche |
| 5.1 | Répertoire physique `workspaceRoot` introuvable | `errored` | Arrêt de la tâche |
| 5.2 | `STACK_EVAL.yaml` présent mais invalide (YAML malformé, schéma inconnu) | `failed` | Arrêt — ne pas fallback sur heuristique |
| 5.2 | Décision dans `STACK_EVAL.yaml` non reconnue (package manager inconnu) | `failed` | Arrêt |
| 5.2 | Fichier de config attendu par `STACK_EVAL.yaml` absent du worktree | `failed` | Arrêt — incohérence entre déclaration et réalité |
| 5.3 | Aucun écosystème détectable (aucun signal) | `failed` | Arrêt — projet non reconnu |
| 5.4 | Type de gate requis par la policy non détectable | `failed` ou HumanGate | Selon `noReliableGateBehavior` |
| 5.5 | Commande candidate impossible à exprimer en argv | `failed` | Arrêt |
| 5.5 | Fichiers d'évidence écrits hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.5 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Registre des écosystèmes

### 9.0 `STACK_EVAL.yaml` — correspondance décision → commande

| Champ `decisions` | Gate | Commande |
|---|---|---|
| `linter: biome` | lint | `npx biome check` |
| `linter: eslint` | lint | `npx eslint .` |
| `linter: ruff` | lint | `uv run ruff check` ou `ruff check` |
| `test_runner: "bun:test"` | test | `bun test` |
| `test_runner: jest` | test | `npx jest` |
| `test_runner: vitest` | test | `npx vitest` |
| `test_runner: pytest` | test | `uv run pytest` ou `pytest` |
| `test_runner: "cargo test"` | test | `cargo test` |
| `type_checker: tsc` | typecheck | `npx tsc --noEmit` |
| `type_checker: mypy` | typecheck | `uv run mypy` ou `mypy` |
| `package_manager` | build | Déduit : `bun run build`, `npm run build`, `cargo build`, etc. |

### 9.1 JavaScript / TypeScript

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `bun.lockb` | bun | `package.json`, `tsconfig.json` | `bun test`, `bun run lint`, `bun run typecheck`, `bun run build` |
| `bunfig.toml` | bun | idem | idem |
| `package-lock.json` | npm | `package.json`, `tsconfig.json` | `npm test`, `npm run lint`, `npm run build` |
| `pnpm-lock.yaml` | pnpm | `package.json`, `tsconfig.json` | `pnpm test`, `pnpm run lint`, `pnpm run build` |
| `yarn.lock` | yarn | `package.json`, `tsconfig.json` | `yarn test`, `yarn lint`, `yarn build` |
| `deno.json` / `deno.jsonc` | deno | `deno.json` | `deno test`, `deno lint`, `deno check` |

Tooling additionnel détectable (quel que soit le package manager) :

| Signal | Signification |
|---|---|
| `biome.json` | Linter + formateur Biome |
| `.eslintrc.*`, `eslint.config.*` | ESLint |
| `prettier.config.*`, `.prettierrc.*` | Prettier |
| `tsconfig.json` | TypeScript |
| `vitest.config.*` | Vitest |
| `jest.config.*` | Jest |
| `playwright.config.*` | Playwright (E2E) |
| `.oxlintrc.*` | oxlint |

### 9.2 Rust

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `Cargo.toml` | cargo | `Cargo.toml`, `Cargo.lock` | `cargo test`, `cargo clippy`, `cargo fmt --check`, `cargo build` |
| `Cargo.lock` | cargo | idem | idem |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `clippy.toml` | Configuration Clippy |
| `rustfmt.toml` | Configuration rustfmt |
| `rust-toolchain.toml` | Version toolchain déclarée |

### 9.3 Go

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `go.mod` | go | `go.mod`, `go.sum` | `go test ./...`, `go vet ./...`, `go build ./...` |
| `go.sum` | go | idem | idem |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `.golangci.yml` | golangci-lint |
| `Taskfile.yml` / `Taskfile.yaml` | Task runner |

### 9.4 Python

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `uv.lock` | uv | `pyproject.toml` | `uv run pytest`, `uv run ruff check`, `uv run mypy` |
| `poetry.lock` | poetry | `pyproject.toml` | `poetry run pytest`, `poetry run ruff check` |
| `Pipfile.lock` | pipenv | `Pipfile` | `pipenv run pytest` |
| `requirements.txt` | pip | `setup.py` ou `pyproject.toml` | `pytest`, `ruff check` |
| `pyproject.toml` (sans lock) | pip/uv | `pyproject.toml` | `pytest`, `ruff check` |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `ruff.toml` | Ruff (linter) |
| `mypy.ini`, `.mypy.ini`, `pyproject.toml [tool.mypy]` | mypy |
| `pytest.ini`, `pyproject.toml [tool.pytest]` | pytest |
| `tox.ini` | tox |

### 9.5 C / C++

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `CMakeLists.txt` | cmake | `CMakeLists.txt` | `cmake --build build`, `ctest --test-dir build` |
| `Makefile` | make | `Makefile` | `make test`, `make check`, `make build` |
| `meson.build` | meson | `meson.build` | `meson test -C build`, `meson compile -C build` |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `.clang-format` | clang-format |
| `.clang-tidy` | clang-tidy |
| `compile_commands.json` | Base de données de compilation |

### 9.6 Java / Kotlin

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `pom.xml` | maven | `pom.xml` | `mvn test`, `mvn verify` |
| `build.gradle` / `build.gradle.kts` | gradle | `build.gradle(.kts)`, `settings.gradle(.kts)` | `gradle test`, `gradle check` |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `checkstyle.xml` | Checkstyle |
| `spotbugs.xml` | SpotBugs |
| `pmd.xml` | PMD |

### 9.7 .NET

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `*.csproj` | dotnet | `*.csproj`, `*.sln` | `dotnet test`, `dotnet build` |
| `*.fsproj` | dotnet | idem | idem |
| `packages.lock.json` | dotnet | idem | idem |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `.editorconfig` | Configuration de style |
| `Directory.Build.props` | Configuration de build |

### 9.8 Ruby

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `Gemfile` | bundler | `Gemfile`, `Gemfile.lock` | `bundle exec rspec`, `bundle exec rubocop` |
| `Gemfile.lock` | bundler | idem | idem |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `.rubocop.yml` | RuboCop |
| `.rspec` | RSpec |

### 9.9 PHP

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `composer.json` | composer | `composer.json`, `composer.lock` | `composer test`, `vendor/bin/phpunit`, `vendor/bin/phpstan analyse` |
| `composer.lock` | composer | idem | idem |

Tooling additionnel :

| Signal | Signification |
|---|---|
| `phpstan.neon` | PHPStan |
| `phpunit.xml` | PHPUnit |
| `.php-cs-fixer.php` | PHP CS Fixer |
| `psalm.xml` | Psalm |

### 9.10 Elixir

| Signal | Package manager | Fichiers de config | Commandes standard |
|---|---|---|---|
| `mix.exs` | mix | `mix.exs`, `mix.lock` | `mix test`, `mix credo`, `mix compile` |
| `mix.lock` | mix | idem | idem |

### 9.11 Task runners génériques

| Signal | Runner | Commandes standard |
|---|---|---|
| `Makefile` | make | `make test`, `make lint`, `make build` |
| `justfile` | just | `just test`, `just lint`, `just build` |
| `Taskfile.yml` / `Taskfile.yaml` | task | `task test`, `task lint`, `task build` |

Les task runners génériques sont détectés **en complément** d'un écosystème
spécifique, pas à la place. Si un `Makefile` est présent à côté d'un
`Cargo.toml`, les deux sont inspectés ; les commandes `make test` et
`cargo test` sont toutes deux candidates, et le filtrage (§5.4) décide.

---

## 10. Non-goals

- Installer ou mettre à jour des compilateurs, linters ou runtimes locaux.
- Exécuter la suite de tests ou les scripts de formatage (les commandes sont
  uniquement recensées, pas lancées).
- Valider la PR, le remote ou publier du code.
- Générer ou maintenir le fichier `STACK_EVAL.yaml` (responsabilité du skill
  `/stack-evaluator`).

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
