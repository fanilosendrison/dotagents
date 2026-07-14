# Startup task `project-discovery-finalize`

`project-discovery-finalize` produit le `ProjectDiscovery` autoritatif du run. Il ne se contente pas de lire des manifestes : il prouve que les commandes de gates retenues correspondent au worktree physique privé qui sera modifié et vérifié.

Cette bootstrap task agit comme un join synchronisant la tâche `workspace-setup` (qui produit `WorkSession`) et la tâche `repo-discovery-draft` (qui pré-analyse le dépôt source).

---

## 1. Objectif

Produire une matrice de gates mécaniques adaptée au dépôt, validée directement contre le worktree privé et isolé du run. 

Le résultat durable de cette validation est l'artefact `ProjectDiscovery`.

---

## 2. Position dans le workflow

`project-discovery-finalize` est le bootstrap join de la phase `run-init`. Elle s'exécute immédiatement après la complétion de `workspace-setup` et `repo-discovery-draft`.

```text
run-init
│
├─ provider-config-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       │
│       ├─ run-capture (parallèle)
│       ├─ workspace-setup (parallèle) ──┐
│       └─ repo-discovery-draft (parallèle)
│                  │                      │
│                  └──────────┬───────────┘
│                             ↓
│                 project-discovery-finalize
│                             │
│                             ↓
│                 delegate implementation
```

Elle s'exécute de manière bloquante : la délégation de l'étape `implementation` ne peut pas être émise tant que `project-discovery-finalize` n'a pas validé et publié la matrice de checks définitive.

---

## 3. Inputs

- `WorkSession` (générée par `workspace-setup`).
- `worktreeRoot` (chemin physique résolu du worktree isolé).
- `artefactRoot` (répertoire réservé aux preuves).
- `WorkflowPolicy.discovery` (règles de découverte).
- `WorkflowPolicy.gates` (règles des gates mécaniques).
- `RepositoryDiscoveryDraft` (optionnel, produit par `repo-discovery-draft`).
- `projectRoot` (optionnel, sous-périmètre de projet issu de `WorkSession`).

---

## 4. Outputs

Artefact métier écrit sous `artefactRoot/startup/project-discovery-finalize/project-discovery.json` :

```ts
type ProjectDiscovery = {
  source: "draft-finalized" | "worktree-rerun";
  finalizedFromDraftId?: string;
  finalizedAgainstWorktreeRoot: string;
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

Fichiers de preuves (dans le sous-dossier `project-discovery-finalize/`) contenant les manifestes détectés, commandes candidates rejetées et résultats de discovery. Cette tâche produit également un `WorkflowExecutionRecord` d'audit.

---

## 5. Pipeline

Le pipeline de finalisation exécute les opérations suivantes :

### 5.1 Vérification des prérequis
S'assurer que la `WorkSession` et le répertoire physique du worktree privé `worktreeRoot` sont bien présents et accessibles.

### 5.2 Comparaison et finalisation du draft
Si un `RepositoryDiscoveryDraft` est fourni :
1. Pour chaque fichier du draft (`inspectedFiles`), vérifier sa présence sous `worktreeRoot`.
2. Calculer le hash SHA256 de ces fichiers dans le worktree et s'assurer qu'ils correspondent exactement à ceux du draft.
3. Valider que les commandes candidates peuvent s'exprimer avec un `workingDirectory` pointant dans le worktree.
4. Si les hashes correspondent, le draft est finalisé. `ProjectDiscovery.source` est défini à `"draft-finalized"`.

### 5.3 Redécouverte (Rerun)
Si le draft est absent, invalide, ou que les hashes ne correspondent pas :
1. Si `WorkflowPolicy.discovery.allowWorktreeRerun` est `false`, lever une erreur `failed`.
2. Si autorisé, relancer l'analyse complète (discovery) directement depuis le répertoire `worktreeRoot`.
3. Produire la matrice de commandes et définir `ProjectDiscovery.source` à `"worktree-rerun"`.

### 5.4 Filtrage et persistance
1. Filtrer et limiter les commandes de checks en fonction du sous-périmètre `projectRoot` et des obligations de la policy `WorkflowPolicy.gates`.
2. Écrire le fichier final `project-discovery.json` et persister le `WorkflowExecutionRecord`.

---

## 6. Règles & Invariants

### 6.1 Non-modification du dépôt
La finalisation ne doit en aucun cas modifier le code du dépôt ou écrire dans le worktree privé. Les fichiers d'évidences ou de rapports doivent être écrits exclusivement dans `artefactRoot`.

### 6.2 Priorité aux scripts locaux
La discovery doit préférer les scripts et configurations déclarés par le projet (ex: scripts `package.json`, tâches `cargo`, configs de linter locales) aux conventions génériques du harness.

### 6.3 Outils et resolveurs officiels
Pour analyser les dépendances et structures du projet, la tâche doit privilégier les commandes et APIs officielles des gestionnaires de paquets (ex: `cargo metadata`, `go list -json`) et rejeter les parseurs "maison" de fichiers de verrouillage.

### 6.4 Frontière de validation du draft
Un draft n'a aucune autorité. Il n'est adopté que si sa conformité physique par rapport aux fichiers du worktree est formellement prouvée par la correspondance des hashes.

### 6.5 Checkpoints et comportement au retry

La tache ecrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/project-discovery-finalize/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte JCS de `{ runId, artefactRoot, worktreeRoot,
  projectRoot }`, les inputs directs non couverts par les hashes
  partages. `projectRoot` est optionnel et normalise a `null` si absent.
- `repoCaptureHash` : **pertinent**. Le contexte du depot cible
  (`canonicalRepositoryRoot`, `projectRoot`) est verifie
  indirectement via la `WorkSession` produite par `workspace-setup`.
- `workflowPolicyHash` : **pertinent**. La tache consomme
  `WorkflowPolicy.discovery` et `WorkflowPolicy.gates` pour decider
  du comportement de rerun et du filtrage des gates.
- `captureContextHash` : fixe a la valeur sentinelle deterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zeros). Cette tache ne consomme pas le `CaptureContext`.

**Comportement au retry :**
- Checkpoint terminal present et tous les hashes pertinents identiques
  (`inputHash`, `repoCaptureHash`, `workflowPolicyHash`) → adoption
  directe du `ProjectDiscovery` precedent. La verification de
  correspondance draft↔worktree a deja ete prouvee.
- Checkpoint absent → execution complete (finalisation du draft ou
  rerun discovery depuis le worktree, cf. §5.2-5.3).
- `inputHash`, `repoCaptureHash` ou `workflowPolicyHash` different
  (mismatch) → echec ferme (`failed`). Les inputs de la tache ont
  change entre deux executions du meme `runId`.
- Checkpoint terminal `failed` ou `errored` → echec ferme (pas de
  re-execution automatique sans intervention).

**Note sur le draft :** Le `RepositoryDiscoveryDraft` est un output
intermediaire de `repo-discovery-draft`, pas un input direct de
`run-init`. Sa validite est prouvee lors de l'execution initiale par
comparaison des hashes de fichiers (§5.2). Au retry avec adoption de
checkpoint, cette verification n'est pas rejouee — le `ProjectDiscovery`
final fait foi.

---

## 7. Opérations internes typiques

- `load-work-session`
- `load-repository-discovery-draft`
- `validate-draft-file-hashes-against-worktree`
- `rerun-discovery-from-worktree-if-needed`
- `build-mechanical-gate-matrix`
- `write-discovery-evidence`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Action corrective / comportement |
|---|---|---|---|
| 5.1 | `WorkSession` absent ou illisible | `errored` | Arrêt de la tâche |
| 5.1 | Répertoire physique `worktreeRoot` introuvable | `errored` | Arrêt de la tâche |
| 5.2/5.3 | Draft incohérent (hashes différents) et rerun non autorisé | `failed` | Arrêt de la phase |
| 5.3 | Aucun check de validation fiable détecté alors que requis par la policy | `failed` | Arrêt |
| 5.4 | Commande candidate détectée impossible à exprimer sous forme d'argv | `failed` | Arrêt |
| 5.4 | Fichiers d'évidence écrits hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.4 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Non-goals

- Installer ou mettre à jour des compilateurs, linters ou runtimes locaux.
- Exécuter la suite de tests ou les scripts de formatage (les commandes sont uniquement recensées, pas lancées).
- Valider la PR, le remote ou publier du code.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
