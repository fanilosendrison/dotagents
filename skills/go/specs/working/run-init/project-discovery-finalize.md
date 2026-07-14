# Startup task `project-discovery-finalize`

`project-discovery-finalize` scanne directement le worktree privé pour
découvrir le package manager, les lockfiles et les commandes candidates. Elle
produit le `ProjectDiscovery` autoritatif du run.

Contrairement à une version antérieure de la spec, cette tâche n'est plus un
join et ne consomme aucun brouillon intermédiaire. Elle opère directement
depuis le workspace isolé.

---

## 1. Objectif

Produire une matrice de gates mécaniques adaptée au dépôt, validée directement
contre le workspace privé et isolé du run.

Le résultat durable de cette validation est l'artefact `ProjectDiscovery`.

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
  finalizedAgainstWorkspaceRoot: string;
  inspectedFiles: InspectedFileRef[];
  packageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
  lockfiles: string[];
  checkCommands: MechanicalCheckDefinition[];
  testCommands: MechanicalCheckDefinition[];
  buildCommands: MechanicalCheckDefinition[];
  providerCapabilities: ProviderCapabilities;
};
```

Fichiers de preuves (dans le sous-dossier `project-discovery-finalize/`)
contenant les manifestes détectés, commandes candidates rejetées et résultats
de discovery. Cette tâche produit également un `WorkflowExecutionRecord`
d'audit.

---

## 5. Pipeline

### 5.1 Vérification des prérequis
S'assurer que la `WorkSession` et le répertoire physique du workspace privé
`workspaceRoot` sont bien présents et accessibles.

### 5.2 Scan du workspace
1. Parcourir le répertoire `workspaceRoot` (ou `workspaceRoot/projectRoot` si
   un sous-périmètre est spécifié) pour identifier les fichiers de
   configuration de projet pertinents : manifestes (`package.json`,
   `Cargo.toml`, `go.mod`, `pyproject.toml`), lockfiles (`yarn.lock`,
   `pnpm-lock.yaml`, `bun.lockb`, `Cargo.lock`, `go.sum`), et configs de
   tooling (`.eslintrc.*`, `tsconfig.json`, `Cargo.toml` [workspace]).
2. Calculer le hash SHA256 de chaque fichier inspecté.
3. Déduire le package manager candidat à partir des manifestes détectés.
4. Extraire les scripts et commandes déclarés (ex: `scripts` dans
   `package.json`, `[[bin]]` et `[lib]` dans `Cargo.toml`, targets dans
   `go.mod`).

### 5.3 Filtrage et construction de la matrice
1. Filtrer et limiter les commandes de checks en fonction du sous-périmètre
   `projectRoot` et des obligations de la policy `WorkflowPolicy.gates`.
2. Si `WorkflowPolicy.gates.requiredKinds` exige des types de gates qui ne
   sont pas détectables, et que
   `WorkflowPolicy.discovery.noReliableGateBehavior` vaut `"human-gate"`,
   ouvrir une HumanGate. Sinon, échouer avec `failed`.
3. Préférer les scripts et configurations déclarés par le projet aux
   conventions génériques du harness (§6.2).

### 5.4 Persistance
1. Écrire le `ProjectDiscovery` validé contre son schéma.
2. Persister le `WorkflowExecutionRecord` d'audit.

---

## 6. Règles & Invariants

### 6.1 Non-modification du dépôt
La tâche ne doit en aucun cas modifier le code du dépôt ou écrire dans le
workspace privé. Les fichiers d'évidences ou de rapports doivent être écrits
exclusivement dans `artefactRoot`.

### 6.2 Priorité aux scripts locaux
La discovery doit préférer les scripts et configurations déclarés par le
projet (ex: scripts `package.json`, tâches `cargo`, configs de linter
locales) aux conventions génériques du harness.

### 6.3 Outils et resolveurs officiels
Pour analyser les dépendances et structures du projet, la tâche doit
privilégier les commandes et APIs officielles des gestionnaires de paquets
(ex: `cargo metadata`, `go list -json`) et rejeter les parseurs "maison" de
fichiers de verrouillage.

### 6.4 Checkpoints et comportement au retry

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
- Checkpoint absent → execution complete du scan du workspace.
- `inputHash`, `repoCaptureHash` ou `workflowPolicyHash` different
  (mismatch) → echec ferme (`failed`). Les inputs de la tache ont
  change entre deux executions du meme `runId`.
- Checkpoint terminal `failed` ou `errored` → echec ferme (pas de
  re-execution automatique sans intervention).

---

## 7. Opérations internes typiques

- `load-work-session`
- `scan-workspace-manifests`
- `detect-package-manager`
- `extract-candidate-commands`
- `build-mechanical-gate-matrix`
- `write-discovery-evidence`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Action corrective / comportement |
|---|---|---|---|
| 5.1 | `WorkSession` absent ou illisible | `errored` | Arrêt de la tâche |
| 5.1 | Répertoire physique `workspaceRoot` introuvable | `errored` | Arrêt de la tâche |
| 5.3 | Aucun check de validation fiable détecté alors que requis par la policy | `failed` | Arrêt |
| 5.4 | Commande candidate détectée impossible à exprimer sous forme d'argv | `failed` | Arrêt |
| 5.4 | Fichiers d'évidence écrits hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.4 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Non-goals

- Installer ou mettre à jour des compilateurs, linters ou runtimes locaux.
- Exécuter la suite de tests ou les scripts de formatage (les commandes sont
  uniquement recensées, pas lancées).
- Valider la PR, le remote ou publier du code.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
