# Startup task `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit s'exécuter
avant toute délégation agentique qui modifie le code.

---

## 1. Objectif

Créer un worktree Git physique privé, enregistrer le point de départ, et
produire un `WorkSession`.

Cette startup task ne produit aucun code applicatif.

---

## 2. Inputs

- `runId`
- `RepositoryLaunchContext` stocke par `run-init`
- repository source
- policy dirty state
- éventuelle branche cible demandée
- `artefactRoot` reserve par `run-init`
- `worktreeRoot` reserve par `run-init`

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

La task produit aussi un `StageOutput` canonique si elle passe par le stage
harness.

---

## 4. Responsabilités

- Résoudre `repositoryRoot`.
- Vérifier que `canonicalRepositoryRoot` correspond a la racine Git reelle.
- Vérifier que `projectRoot`, s'il existe, est sous la racine Git.
- Détecter `baseBranch`.
- Détecter `baseHeadSha`.
- Détecter `defaultTargetBranch` et le comparer au hint parent.
- Lire le dirty state initial.
- Refuser un dirty state non adopté.
- Créer la branche `work/<run-id>`.
- Vérifier que le chemin `worktreeRoot` reserve est utilisable.
- Créer le worktree physique privé associé à cette branche.
- Créer le sous-dossier `workspace-setup/` sous l'`artefactRoot`.
- Persister `WorkSession`.

---

## 5. Invariants

### 5.1 Worktree physique obligatoire

Le run ne travaille pas dans le checkout source. Une simple branche ne suffit
pas.

### 5.2 Artefacts hors worktree

Les artefacts du harness et du workflow ne doivent pas rendre le worktree dirty.

### 5.3 Base figée

`baseHeadSha` est le commit de référence pour tout diff produit par le run.

### 5.4 No direct main work

L'agent n'implémente pas directement sur `main` ou la branche cible par défaut.

### 5.5 Independance de `run-capture`

`workspace-setup` ne lit pas `RunCaptureArtifact` et ne depend pas de la
capture du prompt `/go`.

Il peut s'executer en parallele de `run-capture`, car sa responsabilite est de
figer le point de depart Git et de creer le worktree prive.

### 5.6 Frontiere d'autorite Git

`workspace-setup` produit le premier artefact autoritatif pour les preuves Git :
`WorkSession`.

Les startup tasks de discovery qui ont lu le checkout source avant la creation du
worktree doivent etre finalises contre ce `WorkSession` avant de produire un
`ProjectDiscovery` autoritatif.

---

## 6. Phases Turnlock typiques

```text
resolve-repository
verify-launch-context-against-git
validate-dirty-state-policy
record-base-ref
resolve-default-target-branch
create-work-branch
validate-reserved-worktree-path
create-physical-worktree
create-workspace-setup-artefact-dir
write-work-session-evidence
persist-stage-output
```

---

## 7. Failure modes

- Repository introuvable : `errored`.
- `RepositoryLaunchContext` absent ou invalide : `errored`.
- Racine Git reelle differente de `canonicalRepositoryRoot` : `failed`.
- `projectRoot` hors repo : `failed`.
- Hint de branche cible incompatible avec l'etat Git et non corrigeable :
  `failed`.
- Dirty state non adopté : `failed`.
- Branche `work/<run-id>` déjà existante : `errored`.
- Worktree cible déjà occupé ou non contenu dans l'espace reserve : `errored`.
- Création du worktree impossible : `errored`.
- Sous-dossier d'artefacts `workspace-setup/` déjà occupé : `errored`.

---

## 8. Non-goals

- Implémenter la demande utilisateur.
- Publier une branche.
- Créer une PR.
- Découper le diff.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
