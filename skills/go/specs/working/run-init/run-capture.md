---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "2026-07-17"
step_id: 0
id: CDD-GO-RUN-CAPTURE
version: "1.0.0"
scope: run-init
status: extracted-archive
consumers: [agent-generator]
superseded_by: [NIB-M-GO-RUN-CAPTURE]
---

# Startup task `run-capture`

`run-capture` fige les preuves minimales du moment où l'utilisateur lance `/go`. Il ne comprend pas la demande et ne produit pas d'analyse d'intention.

Cette bootstrap task existe pour la traçabilité, la reproductibilité de la review, et la preuve que les reviews ultérieures ont travaillé sur le même contexte gelé.

---

## 1. Objectif

Produire un `RunCaptureArtifact` mécanique contenant :
- Une référence stable vers la session source.
- Le prompt exact associé au `/go`.
- Le hash de contenu du prompt.
- Les références des fichiers d'evidence écrits sous l'`artefactRoot` du run.

`run-capture` ne résout pas les specs, ne déduit pas les contraintes, ne crée pas de critères d'acceptation, et ne décide pas si la demande est faisable.

---

## 2. Position dans le workflow

`run-capture` s'exécute en parallèle avec la chaîne `dirty-state-capture` → `workspace-setup`, depuis `repo-capture`, au sein de la phase Turnlock `run-init`.

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

Bien qu'elle s'exécute en parallèle, la délégation `implementation` ne peut pas être émise tant que `RunCaptureArtifact` n'est pas terminal, schéma-valide et hash-vérifié.

---

## 3. Inputs

- `runId` (identifiant unique fourni par Turnlock et stocké par `run-init`).
- `artefactRoot` (répertoire réservé pour le run).
- `sessionRef` (fourni par le parent process ou le harness appelant).
- Prompt exact associé au `/go`.
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
  promptAtGoRef: string;
  promptHash: string;
  capturedAt: string;
};
```

Fichiers d'évidence écrits sous `artefactRoot/startup/run-capture/` :
- `prompt-at-go.txt` : le prompt exact.

`promptAtGoRef` est un chemin relatif a `artefactRoot` (ex:
`startup/run-capture/prompt-at-go.txt`). Les chemins absolus sont
interdits dans cet artefact afin de garantir la portabilite du run.

---

## 5. Pipeline

Les étapes s'enchaînent dans l'ordre suivant :

### 5.1 Résolution des entrées
Charger la référence de session et le prompt depuis le `CaptureContext`.

### 5.2 Écriture de l'évidence
Écrire le prompt exact dans `prompt-at-go.txt`.

### 5.3 Calcul de l'empreinte
Calculer le hash de contenu SHA256 (`sha256:<lowercase-hex>`) sur les octets exacts du fichier d'évidence écrit.

### 5.4 Génération de l'artefact
Construire l'objet `RunCaptureArtifact`, le valider contre son schéma, puis persister le fichier JSON `run-capture.json`. L'identifiant `id` de l'artefact est dérivé de manière déterministe à partir du `runId` (ex: `id = runId`) afin de garantir que deux exécutions de la tâche avec les mêmes inputs produisent le même `id`, assurant l'idempotence en cas de reprise après crash avant l'écriture du checkpoint.

### 5.5 Persistance de l'audit
Produire et enregistrer le `WorkflowExecutionRecord` associé à la tâche.

---

## 6. Règles & Invariants

### 6.1 Isolation du parallélisme
`run-capture` ne modifie jamais le `WorkflowState` directement. Son résultat est écrit de manière isolée sous son sous-dossier d'artefacts. Il ne doit pas lire ou écrire dans le worktree privé ou perturber les autres tâches de démarrage.

### 6.2 Hachage de contenu textuel
Le hash dans `RunCaptureArtifact` est calculé sur les octets bruts du fichier texte après normalisation. La normalisation consiste à :
- Appliquer la normalisation Unicode **NFC** (Normalization Form Canonical Composition) pour garantir la compatibilité des caractères accentués ou spéciaux indépendamment de la plateforme (ex : macOS NFD vs Linux NFC).
- Remplacer toute occurrence de `\r\n` (CRLF) par `\n` (LF).
- Garantir que le fichier se termine par exactement un saut de ligne final (`\n`). Si le prompt d'origine ne se termine pas par `\n`, un `\n` est ajouté. Les `\n` supplémentaires en fin de fichier sont supprimés.
L'encodage du fichier est UTF-8 sans BOM. Ce hash diffère des hashes structurels JSON JCS utilisés pour les artefacts du workflow.

### 6.3 Checkpoints et comportement au retry

La tache ecrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/run-capture/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte JCS de `{ runId, artefactRoot }`, les
  inputs directs de la tache qui ne sont pas couverts par les hashes
  partages.
- `repoCaptureHash` : fixe a la valeur sentinelle deterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zeros). Conformement au §6.1, cette tache ne lit pas le worktree
  et ne depend pas du `RepoCapture`.
- `workflowPolicyHash` : fixe a la valeur sentinelle. Cette tache ne
  consomme aucune policy.
- `captureContextHash` : **pertinent**. La tache consomme le
  `CaptureContext` (`sessionRef`, `promptAtGo`) ;
  toute modification du contexte de capture entre deux executions du
  meme `runId` constitue une corruption de l'environnement.

**Comportement au retry :**
- Checkpoint terminal present et tous les hashes pertinents identiques
  (`inputHash`, `captureContextHash`) → adoption du
  `RunCaptureArtifact` precedent, apres verification que les fichiers
  d'evidence (`prompt-at-go.txt`, `run-capture.json`) existent
  physiquement et que le hash de `prompt-at-go.txt` correspond a
  `promptHash`. Si un fichier est absent ou corrompu, echec ferme
  (`failed`). Cette verification est conforme a la regle du
  orchestrateur `run-init` : "checkpoint valide mais artefact metier
  manquant ou invalide : fail-closed".
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
- `hash-capture-evidence`
- `write-run-capture-artifact`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run | Comportement / Action corrective |
|---|---|---|---|
| 5.1 | `sessionRef` absent ou vide | `failed` | Arrêt de la tâche |
| 5.1 | Prompt `/go` manquant, vide, ou composé uniquement d'espaces blancs | `failed` | Arrêt de la tâche |
| 5.3 | Échec du calcul ou incohérence du hash après écriture | `errored` | Arrêt |
| 5.4 | Chemin de fichier d'évidence en dehors d'`artefactRoot` | `errored` | Arrêt de sécurité |
| 5.4 | Artefact JSON produit invalide selon son schéma | `errored` | Arrêt |

---

## 9. Non-goals

- Résumer la demande utilisateur ou en déduire des contraintes.
- Créer des critères d'acceptation ou des plans de test.
- Modifier le dépôt source ou le worktree privé.
- Bloquer le lancement de `workspace-setup`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
