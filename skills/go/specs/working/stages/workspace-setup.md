# Stage `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit s'exécuter
avant toute délégation agentique qui modifie le code.

---

## 1. Objectif

Créer un worktree Git physique privé, enregistrer le point de départ, et
produire un `WorkSession`.

Ce stage ne produit aucun code applicatif.

---

## 2. Inputs

- `runId`
- repository source
- demande utilisateur déjà capturée par `intake`
- policy dirty state
- éventuelle branche cible demandée

---

## 3. Outputs

Evidence JSON principale :

```ts
type WorkspaceSetupEvidence = {
  workSession: WorkSession;
  sourceStatusBeforeSetup: string;
  createdDirectories: string[];
};
```

Le stage produit aussi un `StageOutput` canonique via le stage harness.

---

## 4. Responsabilités

- Résoudre `repositoryRoot`.
- Détecter `baseBranch`.
- Détecter `baseHeadSha`.
- Détecter `defaultTargetBranch`.
- Lire le dirty state initial.
- Refuser un dirty state non adopté.
- Créer la branche `work/<run-id>`.
- Créer un worktree physique privé associé à cette branche.
- Créer un artefact root privé hors du worktree.
- Persister `WorkSession`.

---

## 5. Invariants

### 5.1 Worktree physique obligatoire

Le run ne travaille pas dans le checkout source. Une simple branche ne suffit
pas.

### 5.2 Artefacts hors worktree

Les artefacts du harness et du pipeline ne doivent pas rendre le worktree dirty.

### 5.3 Base figée

`baseHeadSha` est le commit de référence pour tout diff produit par le run.

### 5.4 No direct main work

L'agent n'implémente pas directement sur `main` ou la branche cible par défaut.

---

## 6. Phases Turnlock typiques

```text
resolve-repository
validate-dirty-state-policy
record-base-ref
create-work-branch
create-physical-worktree
create-artefact-root
write-work-session-evidence
persist-stage-output
```

---

## 7. Failure modes

- Repository introuvable : `errored`.
- Dirty state non adopté : `failed`.
- Branche `work/<run-id>` déjà existante : `errored`.
- Worktree cible déjà existant : `errored`.
- Création du worktree impossible : `errored`.

---

## 8. Non-goals

- Implémenter la demande utilisateur.
- Publier une branche.
- Créer une PR.
- Découper le diff.

---

VegaCorp - `/go` Pipeline - "Reliability precedes intelligence."
