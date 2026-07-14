# Startup task `repo-discovery-draft`

`repo-discovery-draft` inspecte le dépôt source en lecture seule pendant que `workspace-setup` crée le worktree physique privé. 

Cette bootstrap task produit un brouillon non autoritatif. Elle accélère le démarrage du run en pré-analysant le dépôt, sans pour autant définir elle-même la configuration définitive des checks.

---

## 1. Objectif

Produire un `RepositoryDiscoveryDraft` contenant :
- Les fichiers inspectés et leurs hashes.
- Le gestionnaire de paquets candidat.
- Les fichiers de verrouillage (lockfiles) candidats.
- Les commandes de vérification mécanique candidates.
- Les capacités détectées pour le fournisseur Git (provider).

---

## 2. Position dans le workflow

`repo-discovery-draft` s'exécute en parallèle avec `run-capture` et `workspace-setup` au sein de la phase Turnlock `run-init`.

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
```

Elle ne dépend pas de la tâche `workspace-setup` ou de la création physique du worktree, car elle lit uniquement le dépôt source d'origine. Ses résultats sont ensuite consommés et vérifiés par `project-discovery-finalize`.

---

## 3. Inputs

- `runId` (identifiant unique Crockford base32 ULID).
- Répertoire ou chemin d'accès vers le dépôt source.
- `artefactRoot` (répertoire réservé aux preuves).
- `WorkflowPolicy.discovery` (règles de découverte).
- `projectRoot` (optionnel, sous-périmètre de projet issu de `RepoCapture`).

---

## 4. Outputs

Artefact métier écrit sous `artefactRoot/startup/repo-discovery-draft/repository-discovery-draft.json` :

```ts
type RepositoryDiscoveryDraft = {
  schema: "go.repository-discovery-draft.v1";
  id: string;
  runId: string;
  sourceRepo: string;
  inspectedAt: string;
  inspectedFiles: InspectedFileRef[];
  candidatePackageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
  candidateLockfiles: string[];
  candidateCommands: CandidateMechanicalCommand[];
  providerCapabilities: ProviderCapabilities;
};
```

Cette tâche produit également un `WorkflowExecutionRecord` d'audit.

---

## 5. Pipeline

Les étapes du pipeline s'enchaînent dans l'ordre suivant :

1. **Chargement de la configuration :** Analyser le répertoire de départ et le paramètre optionnel `projectRoot`.
2. **Scan en lecture seule :** Parcourir le répertoire pour identifier les fichiers de configuration de projet pertinents (manifestes, lockfiles, configs de tooling).
3. **Calcul des empreintes :** Calculer le hash SHA256 (`sha256:<lowercase-hex>`) de chaque fichier inspecté.
4. **Analyse des technologies :** Identifier le package manager candidat et extraire les scripts ou configurations disponibles.
5. **Génération de l'artefact :** Rédiger et enregistrer le fichier JSON `repository-discovery-draft.json`.
6. **Persistance de l'audit :** Produire et enregistrer le `WorkflowExecutionRecord` associé.

---

## 6. Règles & Invariants

### 6.1 Lecture seule absolue
La tâche ne doit apporter aucune modification au dépôt source. Elle ne doit pas installer de dépendances, ni générer de fichiers locaux, ni exécuter de tests.

### 6.2 Déduction de projet (projectRoot)
Si un `projectRoot` est spécifié (sous-dossier de monorepo), la détection du gestionnaire de paquets et l'inspection des fichiers doivent prioritairement cibler ce sous-dossier et ses configurations parentes directes (ex: `package.json` de l'application et lockfile parent à la racine du monorepo).

### 6.3 Statut non-autoritatif
Le brouillon produit n'est pas définitif. Il n'acquiert de valeur décisionnelle que lorsque `project-discovery-finalize` a prouvé que les fichiers inspectés correspondent exactement aux fichiers présents dans le worktree isolé privé du run.

---

## 7. Opérations internes typiques

- `inspect-source-manifests`
- `inspect-source-lockfiles`
- `inspect-source-package-scripts`
- `inspect-source-provider-capabilities`
- `hash-inspected-files`
- `write-repository-discovery-draft`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Comportement / Action corrective |
|---|---|---|---|
| 5.2 | Répertoire du dépôt source introuvable | `errored` | Arrêt de la tâche |
| 5.2 | Fichiers manifestes ou configurations de base illisibles | `failed` | Arrêt de la tâche |
| 5.4 | Commande candidate détectée impossible à sérialiser en argv | `failed` | Ignorer la commande ou échec selon la policy |
| 5.5 | Fichier d'évidence écrit hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.5 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Non-goals

- Définir définitivement la configuration des checks (matrice finale).
- Résoudre ou modifier l'état physique du dépôt ou du worktree.
- Installer ou mettre à jour des outils locaux.
- Lancer ou exécuter des gates mécaniques complexes.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
