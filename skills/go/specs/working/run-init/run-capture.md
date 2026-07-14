# Startup task `run-capture`

`run-capture` fige les preuves minimales du moment où l'utilisateur lance `/go`. Il ne comprend pas la demande et ne produit pas d'analyse d'intention.

Cette bootstrap task existe pour la traçabilité, la reproductibilité de la review, et la preuve que les reviews ultérieures ont travaillé sur le même contexte gelé.

---

## 1. Objectif

Produire un `RunCaptureArtifact` mécanique contenant :
- Une référence stable vers la session source.
- Un extrait minimal et gelé de la session.
- Le prompt exact associé au `/go`.
- Les hashes de contenu du prompt et de l'extrait.
- Les références des fichiers d'evidence écrits sous l'`artefactRoot` du run.

`run-capture` ne résout pas les specs, ne déduit pas les contraintes, ne crée pas de critères d'acceptation, et ne décide pas si la demande est faisable.

---

## 2. Position dans le workflow

`run-capture` s'exécute en parallèle avec `workspace-setup` et `repo-discovery-draft` au sein de la phase Turnlock `run-init`.

```text
run-init
│
├─ prerequisite-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       ↓
├─ dirty-state-capture (séquentiel, host-side only)
│       │
│       ├─ run-capture (parallèle) ─────────────────┐
│       ├─ workspace-setup (parallèle)              │
│       └─ repo-discovery-draft (parallèle)         │
│                  │                                │
│                  └──────────┬─────────────────────┘
│                             ↓                     │
│                 project-discovery-finalize        │
│                             │                     │
│                             ↓                     │
│                 join run-capture ◄────────────────┘
```

Bien qu'elle s'exécute en parallèle, la délégation `implementation` ne peut pas être émise tant que `RunCaptureArtifact` n'est pas terminal, schéma-valide et hash-vérifié.

---

## 3. Inputs

- `runId` (identifiant unique fourni par Turnlock et stocké par `run-init`).
- `artefactRoot` (répertoire réservé pour le run).
- `sessionRef` (fourni par le parent process ou le harness appelant).
- Prompt exact associé au `/go`.
- Extrait minimal de session sélectionné par le parent process.
- Horodatage de capture fourni par l'horloge du run.

`run-capture` ne lit pas le worktree et ne dépend pas de `WorkSession`.

---

## 4. Outputs

Artefact métier écrit sous `artefactRoot/startup/run-capture/run-capture.json` :

```ts
type RunCaptureArtifact = {
  schema: "go.run-capture.v1";
  id: string;
  runId: string;
  sessionRef: string;
  sessionExcerptRef: string;
  promptAtGoRef: string;
  promptHash: string;
  excerptHash: string;
  capturedAt: string;
};
```

Fichiers d'évidence écrits sous `artefactRoot/startup/run-capture/` :
- `prompt-at-go.txt` : le prompt exact.
- `session-excerpt.md` : l'extrait gelé de la session.

---

## 5. Pipeline

Les étapes s'enchaînent dans l'ordre suivant :

1. **Résolution des entrées :** Charger les données de session et le prompt depuis le `CaptureContext`.
2. **Écriture des évidences :** 
   - Écrire le prompt exact dans `prompt-at-go.txt`.
   - Écrire l'extrait de session dans `session-excerpt.md`.
3. **Calcul des empreintes :** Calculer le hash de contenu SHA256 (`sha256:<lowercase-hex>`) sur les octets exacts de chaque fichier d'évidence écrit.
4. **Génération de l'artefact :** Produire et persister le fichier JSON `run-capture.json` contenant les métadonnées et hashes.
5. **Persistance de l'audit :** Produire et enregistrer le `WorkflowExecutionRecord` associé à la tâche.

---

## 6. Règles & Invariants

### 6.1 Minimisation de l'extrait
Le fichier `session-excerpt.md` doit contenir uniquement les éléments indispensables pour comprendre l'intention de l'utilisateur :
- Les messages pertinents précédant l'appel `/go`.
- Les clarifications ou contraintes explicites acceptées.
Il ne doit pas dupliquer l'intégralité de la session par défaut.

### 6.2 Isolation du parallélisme
`run-capture` ne modifie jamais le `WorkflowState` directement. Son résultat est écrit de manière isolée sous son sous-dossier d'artefacts. Il ne doit pas lire ou écrire dans le worktree privé ou perturber les autres tâches de démarrage.

### 6.3 Hachage de contenu textuel
Les hashes dans `RunCaptureArtifact` sont calculés sur les octets bruts des fichiers textes normalisés. Ils diffèrent des hashes structurels JSON JCS utilisés pour les artefacts du workflow.

### 6.4 Checkpoints et comportement au retry

La tache ecrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/run-capture/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte JCS de `{ runId, artefactRoot }`, les
  inputs directs de la tache qui ne sont pas couverts par les hashes
  partages.
- `repoCaptureHash` : fixe a la valeur sentinelle deterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zeros). Conformement au §6.2, cette tache ne lit pas le worktree
  et ne depend pas du `RepoCapture`.
- `workflowPolicyHash` : fixe a la valeur sentinelle. Cette tache ne
  consomme aucune policy.
- `captureContextHash` : **pertinent**. La tache consomme le
  `CaptureContext` (`sessionRef`, `promptAtGo`, `sessionExcerpt`) ;
  toute modification du contexte de capture entre deux executions du
  meme `runId` constitue une corruption de l'environnement.

**Comportement au retry :**
- Checkpoint terminal present et tous les hashes pertinents identiques
  (`inputHash`, `captureContextHash`) → adoption directe du
  `RunCaptureArtifact` precedent.
- Checkpoint absent → re-execution complete de la tache de capture.
- `inputHash` ou `captureContextHash` different (mismatch) → echec
  ferme (`failed`). Les inputs de la tache ont change entre deux
  executions du meme `runId`.
- Checkpoint terminal `failed` ou `errored` → echec ferme (pas de
  re-execution automatique sans intervention).

---

## 7. Opérations internes typiques

- `resolve-run-capture-inputs`
- `write-prompt-evidence`
- `write-session-excerpt-evidence`
- `hash-capture-evidence`
- `write-run-capture-artifact`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Comportement / Action corrective |
|---|---|---|---|
| 5.1 | `sessionRef` absent ou vide | `failed` | Arrêt de la tâche |
| 5.1 | Prompt `/go` manquant | `failed` | Arrêt de la tâche |
| 5.1 | Extrait de session manquant ou vide sans justification | `failed` | Arrêt de la tâche |
| 5.3 | Échec du calcul ou incohérence des hashes après écriture | `errored` | Arrêt |
| 5.4 | Chemin de fichier d'évidence en dehors d'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.4 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Non-goals

- Résumer la demande utilisateur ou en déduire des contraintes.
- Créer des critères d'acceptation ou des plans de test.
- Modifier le dépôt source ou le worktree privé.
- Bloquer le lancement de `workspace-setup` ou `repo-discovery-draft`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
