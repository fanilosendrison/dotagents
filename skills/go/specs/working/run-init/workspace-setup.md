# Startup task `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit s'exécuter
avant toute délégation agentique qui modifie le code. Elle est une bootstrap task
interne a la phase Turnlock `run-init`, pas une phase Turnlock separee.

---

## 1. Objectif

Créer un worktree Git physique privé, enregistrer le point de départ, et
produire un `WorkSession`.

Cette bootstrap task ne produit aucun code applicatif.

---

## 2. Inputs

- `runId`
- `RepoCapture` stocke par `run-init`
- repository source
- `WorkflowPolicy.dirtyState`

- `artefactRoot` reserve par `run-init`
- `worktreeRoot` reserve par `run-init`

---

## 3. Outputs

Evidence JSON principale :

```ts
type WorkspaceSetupEvidence = {
  workSession: WorkSession;
  sourceStatusBeforeSetup: string;
  dirtyStateAdoption?: DirtyStateAdoption;
  createdDirectories: string[];
};
```

La task produit aussi un `WorkflowExecutionRecord` durable. Si elle passe par le
stage harness, ce record reference le `StageOutput` canonique.

---

## 4. Responsabilités

- Résoudre `repositoryRoot`.
- Si aucun dépôt Git n'existe à `canonicalRepositoryRoot`, l'initialiser (`git init`), ajouter les fichiers existants (`git add -A`) et auto-committer cet état existant comme commit initial (plutôt qu'un commit vide). Cela permet la création de branches et de worktrees sans transformer le code existant de l'utilisateur en dirty state non géré.
- Vérifier que `canonicalRepositoryRoot` correspond a la racine Git reelle.
- Vérifier que `projectRoot`, s'il existe, est sous la racine Git.
- Détecter `baseBranch`.
- Détecter `baseHeadSha`.
- Détecter `defaultTargetBranch` et le comparer au hint parent.
- Lire le dirty state initial.
- Refuser un dirty state non adopté.
- Si `WorkflowPolicy.dirtyState.mode` autorise l'adoption, capturer le dirty
  state comme patch, hasher ce patch, puis le rejouer dans le worktree prive
  avant toute delegation agentique.
- Créer la branche `work/<runId>`.
- Vérifier que le chemin `worktreeRoot` reserve est utilisable.
- Créer le worktree physique privé associé à cette branche.
- Créer le sous-dossier `workspace-setup/` sous l'`artefactRoot`.
- Persister `WorkSession`.
- En cas de relance au retry (si `worktreeRoot` existe déjà) :
  - Valider l'intégrité physique du worktree existant (vérifier que le lien `.git` est valide, que la branche `work/<runId>` existe dans Git, et que le HEAD correspond à `baseHeadSha`).
  - Si le worktree est valide et correspond à la `WorkSession` existante, l'adopter sans modification.
  - Si le worktree ou les métadonnées Git sont corrompus ou inconsistants, nettoyer le dépôt (`git worktree remove --force` ou `git worktree prune`, suppression de la branche locale) avant de recréer la branche et le worktree depuis zéro.

---

## 5. Invariants

### 5.1 Worktree physique obligatoire

Le run ne travaille pas dans le checkout source. Une simple branche ne suffit
pas.

### 5.2 Artefacts hors worktree

Les artefacts du harness et du workflow ne doivent pas rendre le worktree dirty.

### 5.3 Base figée

`baseHeadSha` est le commit de référence pour tout diff produit par le run.

### 5.3.1 Dirty state adopte

Un dirty state adopte n'est pas une permission vague de travailler dans le
checkout source. Il devient un input du run seulement si `workspace-setup` peut
produire `DirtyStateAdoption` :

- status porcelain source capture comme evidence ;
- patch source capture hors worktree ;
- hash du patch ;
- replay du patch dans le worktree prive ;
- status du worktree apres replay capture comme evidence.

Si `WorkflowPolicy.dirtyState.adoptionRequiresWorktreeReplay` vaut `true`, le
replay dans le worktree prive est obligatoire. Si le patch ne peut pas etre
rejoue proprement, `workspace-setup` echoue ferme ou ouvre la HumanGate prevue
par `WorkflowPolicy.dirtyState.mode`.

### 5.4 No direct main work

L'agent n'implémente pas directement sur la branche par défaut.

### 5.5 Independance de `run-capture`

`workspace-setup` ne lit pas `RunCaptureArtifact` et ne depend pas de la
capture du prompt `/go`.

Il peut s'executer en parallele de `run-capture`, car sa responsabilite est de
figer le point de depart Git et de creer le worktree prive.

### 5.6 Frontiere d'autorite Git

`workspace-setup` produit le premier artefact autoritatif pour les preuves Git :
`WorkSession`.

Les bootstrap tasks de discovery qui ont lu le checkout source avant la creation du
worktree doivent etre finalises contre ce `WorkSession` avant de produire un
`ProjectDiscovery` autoritatif.

### 5.7 Resolution des symlinks

Pour toutes les opérations Git liées au worktree (notamment `git worktree add`), `workspace-setup` doit utiliser la forme résolue (`realpath`) de `worktreeRoot` (`canonicalRepositoryRoot` étant par définition déjà résolu). Ceci garantit que Git n'écrit pas de chemins contenant des symlinks dans ses pointeurs internes, évitant ainsi la corruption du worktree privé.

---

## 6. Operations internes typiques

```text
verify-canonical-repository (déjà résolu par run-init)
if-is-new-repository-initialize-git-repo
verify-repo-capture-against-git
validate-dirty-state-policy
record-base-ref
resolve-default-target-branch
if-retry-validate-existing-worktree (verify .git file link, branch existence, baseHeadSha alignment)
if-invalid-execute-prune-and-rebuild (git worktree remove/prune, delete work-branch)
create-work-branch (skip if adopting valid worktree)
validate-reserved-worktree-path
create-physical-worktree (skip if adopting valid worktree)
create-workspace-setup-artefact-dir
write-work-session-evidence
persist-execution-record
```

---

## 7. Failure modes

- Repository introuvable à l'issue de l'initialisation : `errored`.
- `RepoCapture` absent ou invalide : `errored`.
- Racine Git reelle differente de `canonicalRepositoryRoot` : `failed`.
- `projectRoot` hors repo : `failed`.

- Dirty state non adopté : `failed`.
- Dirty state adopte mais patch irrejouable dans le worktree prive : `failed`.
- Branche `work/<runId>` déjà existante sans checkpoint valide ou après échec de validation : nettoyée et recréée (au lieu d'échouer directement).
- Worktree cible déjà occupé par un dossier incomplet ou corrompu : nettoyé et recréé (au lieu d'échouer directement).
- Échec du nettoyage ou de la recréation du worktree corrompu : `errored`.
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
