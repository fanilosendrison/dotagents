# Commit / Push / PR Workflow — Branches dédiées, PRs microscopiques, Stacked PRs

Ce document définit la phase `commit-push-pr` du pipeline `/go`. Elle ne lance
pas la première review : elle reçoit un diff déjà passé par `agent-conduct-check`,
`lint`, `typecheck`, `tests`, et `pre-pr-review`, puis le découpe en branches et
PRs. La phase `pr-ci-review` rejoue ensuite les gates côté CI sur le diff
réellement poussé.

Ce workflow remplace le modèle linéaire actuel (un diff → des commits sur la
branche courante → push) par un processus basé sur un snapshot de départ, une
branche de travail privée, l'analyse sémantique du diff, la création de branches
de PR dédiées, et les PRs empilées.

---

## Pourquoi ce workflow

L'état de l'art chez les équipes performantes (Google, Meta, Netflix) repose
sur trois piliers :

1. **PRs microscopiques** (< 400 lignes) : 40% de défauts en moins, approbation
   3× plus rapide qu'une PR monolithique.
2. **Branches éphémères** (< 1 jour) : merge plusieurs fois par jour sur `main`,
   jamais de branche de vie longue.
3. **Stacked PRs** : pour les changements complexes, une chaîne de PRs où
   chacune cible la branche de la précédente. Permet de continuer à coder sur
   la PR 2 pendant que la PR 1 est en revue.

Le pipeline `/go` automatise ce workflow. L'agent d'implémentation produit un
diff brut. Le pipeline le découpe sémantiquement, crée les branches, applique
les changements de manière isolée, et ouvre les PRs correspondantes.

---

## Avant l'implémentation : `workspace-setup`

La phase `commit-push-pr` ne décide pas rétroactivement d'où vient le diff. Le
point de départ est enregistré par la phase canonique `workspace-setup`, avant
que l'agent ne modifie le filesystem.

`workspace-setup` crée d'abord un `WorkSession` :

```ts
type WorkSession = {
  runId: string;
  repoRoot: string;
  baseBranch: string;
  baseHeadSha: string;
  baseRemote?: string;
  defaultTargetBranch: string;
  initialDirtyState: "clean" | "dirty-adopted";
  workBranch: `work/${string}`;
};
```

Règles :

- Par défaut, `/go` démarre uniquement depuis un worktree clean.
- Si le repo est dirty, les changements existants doivent être explicitement
  adoptés dans le run ou le pipeline s'arrête.
- L'agent ne travaille pas directement sur `main`.
- Le pipeline crée `work/<run-id>` depuis `baseHeadSha`.
- L'implémentation complète se fait sur `work/<run-id>`.
- `work/<run-id>` est une branche privée de staging : elle contient le diff brut
  complet, pas une PR reviewable.
- `work/<run-id>` n'est pas pushée par défaut. Elle peut l'être seulement pour
  recovery, debug, inspection humaine du diff brut, ou handoff explicite.

Le diff d'entrée de `commit-push-pr` est donc :

```text
diff = work/<run-id> - baseHeadSha
```

La phase `commit-push-pr` transforme ce diff brut en branches de PR propres :

```text
work/<run-id>
  diff complet de l'agent
        │
        ├── pr/<run-id>/package-a  → PR
        ├── pr/<run-id>/package-b  → PR
        └── pr/<run-id>/package-c  → PR
```

---

## Préconditions d'entrée

Le wrapper Turnlock de `commit-push-pr` refuse de démarrer si l'une de ces
conditions manque :

- Le `runId` Turnlock est présent et stable.
- `baseBranch`, `baseHeadSha`, `defaultTargetBranch`, et `workBranch` sont
  enregistrés dans `state.json`.
- Le checkout courant est `work/<run-id>`, ou le pipeline sait le recréer depuis
  `baseHeadSha`.
- Le dernier `PhaseOutput` validant l'état d'entrée est disponible :
  `trackedWorktreeHash` est non-null et `worktreeClean` vaut `true`.
- Le diff brut de packaging est capturé avec `originalDiffHash`. Ce hash sert à
  prouver le découpage/reconstruction du diff ; il ne remplace pas
  `trackedWorktreeHash` pour les gates mécaniques.
- `agent-conduct-check`, `lint`, `typecheck`, et `tests` sont passés sur le même
  `trackedWorktreeHash`.
- `pre-pr-review` ne contient aucun finding `Bloquant` ouvert ni `Majeur` avec
  `blocksPipeline: true`.
- Toute décision humaine utilisée pour dismiss, defer, ou appliquer une
  remediation est présente dans `state.json`.
- Le workspace ne contient pas de fichier non suivi oublié, de lockfile non
  aligné, ou de modification hors périmètre du run.

Ces préconditions empêchent la phase Git de devenir une machine à publier un
état local ambigu.

---

## Sécurité des branches

L'agent ne peut pas écrire n'importe où. Les règles suivantes sont non-négociables :

| Règle | Détail |
|-------|--------|
| **No direct main work** | L'agent n'implémente jamais directement sur `main` par défaut. Le travail brut se fait sur `work/<run-id>`. |
| **Work branch privée** | `work/<run-id>` reste locale par défaut. Elle n'est pas une branche de PR. |
| **Branch naming convention** | L'agent ne crée que des branches `pr/<run-id>/<slug>` ou `review-bot/<run-id>/<slug>`. Tout nom hors de ce pattern est rejeté par le pipeline. |
| **Branch protection** | `main` est protégée côté GitHub. Aucun push direct, même par le bot. |
| **Pas de force-push** | Le bot ne force-push jamais, sauf sur une branche `pr/*` dont il est le seul auteur et qui n'a pas encore de PR ouverte. |
| **Pas d'écrasement** | Avant de créer une branche, vérifier qu'elle n'existe pas déjà. Si elle existe et a une PR ouverte → erreur. |

---

## Interaction avec `git-commits-push-enforcer`

La phase `commit-push-pr` est la seule phase `/go` autorisée à produire des
commits, des objets de commit, ou des pushes. Elle doit donc coopérer avec le
`git-commits-push-enforcer` au lieu de le contourner.

Règles :

- Les commandes Git de lecture ou d'inspection (`rev-parse`, `status`, `diff`,
  `ls-files`, `cat-file`, `sparse-checkout list`, etc.) restent des commandes
  Git ordinaires. Elles ne portent pas d'intention de commit/push et ne doivent
  pas être routées par le mécanisme de confiance.
- Les mutations bloquées par l'enforcer (`git commit`, `git commit-tree`,
  `git push`) ne doivent jamais être lancées comme commandes Bash brutes par
  l'agent ou par le harness.
- En v1, `commit-push-pr` doit déléguer ces mutations au même chemin de
  confiance que `/git-commits-push` : helper Git interne qui émet un token court,
  one-shot, passé au subprocess Git avec le marqueur de source attendu.
- Si ce helper de confiance n'est pas disponible, la phase échoue fermée :
  aucun commit, aucun push, aucune PR.
- `BYPASS_GIT_ENFORCER=1` est interdit. Ce bypass est trop large et ne fait pas
  partie du contrat `/go`.

Ce contrat évite que `/go` apprenne un second chemin de publication concurrent
avec `/git-commits-push`. Les deux workflows peuvent évoluer séparément, mais
les opérations Git finales passent par le même modèle de capacité contrôlée.

Extension v2 possible : généraliser le trust-store en un broker de mutations Git
capable d'émettre des tokens scopés par issuer (`git-commits-push`,
`go/commit-push-pr`), repository, commande autorisée, et `runId`.

---

## Le workflow en 5 étapes

### Étape 1 — Analyse sémantique du diff brut

L'agent reçoit le diff global entre `baseHeadSha` et `work/<run-id>`. Il ne
touche pas à Git. Il analyse le contenu et produit un plan de découpage.

**Input** : diff brut (`git diff <baseHeadSha>...work/<run-id>`)

**Output** : liste de paquets logiques

```
Paquet A : refacto — extraction des helpers (src/utils/*)
  → Indépendant

Paquet B : nouvelle API — endpoints /auth/* (src/api/auth/*)
  → Dépend de A (utilise les helpers extraits)

Paquet C : correctif doc — typo README (README.md)
  → Indépendant
```

**Délégation** : `DELEGATE(agent "commit-planner", Sonnet)`

### Invariants du plan de découpage

Le plan de découpage est un artefact JSON validé par schéma. Il doit prouver que
le découpage ne perd rien :

- Chaque fichier modifié, supprimé, renommé, généré, binaire, ou nouveau fichier
  déjà adopté dans l'index est assigné à au moins un paquet. Un fichier non suivi
  au démarrage de `commit-push-pr` est une précondition invalide, pas une entrée
  de packaging.
- Si deux paquets touchent le même fichier, le chevauchement est explicite et
  justifié.
- Chaque paquet déclare ses dépendances et sa base (`defaultTargetBranch` ou une
  branche de la stack).
- Les paquets marqués `inseparable` expliquent pourquoi un split serait faux ou
  dangereux.
- En réappliquant les paquets dans l'ordre topologique, le hash reconstruit doit
  être identique à `originalDiffHash`.

Si la reconstruction ne matche pas, le pipeline échoue fermé : pas de commit,
pas de push, pas de PR.

### Étape 2 — Création des branches

Pour chaque paquet, l'agent crée une branche de PR dédiée. Ces branches partent
de `baseHeadSha` ou d'une branche de PR précédente, jamais de `work/<run-id>`.
La stratégie dépend des dépendances entre paquets.

**Paquets indépendants** : branche depuis `baseHeadSha`

```bash
git checkout <baseHeadSha>
git checkout -b pr/<run-id>/refacto-utils
git checkout <baseHeadSha>
git checkout -b pr/<run-id>/fix-typo
```

**Paquets dépendants** : branches empilées (stacked)

```bash
# Paquet A (base)
git checkout <baseHeadSha>
git checkout -b pr/<run-id>/refacto-utils

# Paquet B (dépend de A)
git checkout pr/<run-id>/refacto-utils
git checkout -b pr/<run-id>/nouvelle-api
```

**Paquets insécables** : un seul paquet logique, une seule branche, mais des
commits atomiques à l'intérieur pour la revue (ex: Commit 1 = modèle, Commit 2
= implémentation, Commit 3 = tests).

### Étape 3 — Application des changements

Maintenant seulement, l'agent applique les modifications du paquet sur la
branche de PR correspondante. Pas de cherry-pick depuis `work/<run-id>` et pas
de reset destructif : le code est appliqué directement là où il doit aller à
partir des artefacts du plan.

Pour chaque branche :

1. Checkout de la branche
2. Application du diff du paquet (via `git apply` ou écriture directe)
3. Commit(s) atomique(s) avec message formaté (conventional commits), via le
   helper Git de confiance décrit plus haut.

**Délégation** : `DELEGATE(agent "commit-formatter", Haiku)` — génère les
messages de commit pour chaque commit atomique.

### Étape 4 — Push et ouverture des PRs

```bash
# Push uniquement les branches de PR, via le helper Git de confiance
trustedGitMutation("push", ["origin", "pr/<run-id>/*"])

# PRs indépendantes → cible defaultTargetBranch
gh pr create --base <defaultTargetBranch> --head pr/<run-id>/refacto-utils
gh pr create --base <defaultTargetBranch> --head pr/<run-id>/fix-typo

# PR empilée → cible la branche de la PR précédente
gh pr create --base pr/<run-id>/refacto-utils --head pr/<run-id>/nouvelle-api
```

`work/<run-id>` n'est pas pushée dans ce flux normal. Les reviewers voient les
branches `pr/<run-id>/<slug>`, pas la branche brute de travail.

Chaque PR contient :

- Description auto-générée (ce qui a été fait, pourquoi)
- Liste des paquets inclus, dépendances, et hash du diff reconstruit
- Résumé des fixes automatiques appliqués par le pipeline
- Résumé des findings `pre-pr-review` corrigés, dismissés, ou différés
- Liste des gates humaines déclenchées (si vide → "Ready to merge")
- Référence au `runId` Turnlock et aux artefacts JSON de review pour traçabilité

### Étape 5 — Déclenchement de la PR CI Review

L'ouverture des PRs déclenche le worker CI qui reprend l'orchestration Turnlock
pour la phase `pr-ci-review`. Cette phase reste conforme à [`phase-harness/NIB-S-go-phase-harness.md`](./phase-harness/NIB-S-go-phase-harness.md) :
elle produit un `PhaseOutput` canonique après avoir rejoué les gates mécaniques
et la review structurée sur le diff réellement poussé, pas sur le workspace
local. Voir `ideal-review.md` et `go-pipeline-contract.md`.

---

## Stacked PRs : le détail

### Quand les utiliser

| Situation | Stratégie |
|-----------|-----------|
| Paquet B dépend de A (compile pas sans) | Stacked : B cible A |
| Paquet B et A sont indépendants | Branches séparées depuis `defaultTargetBranch` |
| Paquet B dépend de A mais A est trivial (1 commit) | Grouper dans une seule PR avec commits atomiques |

### Visualisation

```
main
  │
  ├── work/<id> (privée, locale par défaut)
  │     │
  │     └── diff brut complet de l'agent
  │
  ├── pr/<id>/refacto-utils (Paquet A)
  │     │
  │     ├── commit 1 : extraire les helpers
  │     ├── commit 2 : tests des helpers
  │     │
  │     └── PR #42 : base=main, head=pr/<id>/refacto-utils
  │           │
  │           ├── pr/<id>/nouvelle-api (Paquet B)
  │           │     │
  │           │     ├── commit 1 : modèle auth
  │           │     ├── commit 2 : implémentation endpoints
  │           │     ├── commit 3 : tests
  │           │     │
  │           │     └── PR #43 : base=pr/<id>/refacto-utils, head=pr/<id>/nouvelle-api
  │           │
  │           ▼
  │        Merge PR #42 dans main
  │           │
  │           ▼ PR #43 est relue : retarget/rebase si nécessaire
  │
  ├── pr/<id>/fix-typo (Paquet C)
  │     │
  │     ├── commit 1 : typo README
  │     │
  │     └── PR #44 : base=main, head=pr/<id>/fix-typo
```

### Que faire quand la PR de base est mergée

Quand `pr/<id>/refacto-utils` est mergée dans `defaultTargetBranch` :

1. Le pipeline relit l'état réel de la PR #43 via l'API GitHub.
2. Si GitHub a retargeté la base vers `defaultTargetBranch`, le pipeline
   enregistre ce nouvel état dans `state.json`.
3. Si la base pointe encore vers la branche mergée, le pipeline retargete ou
   rebase explicitement selon la policy du dépôt.
4. La PR #43 repasse par `pr-ci-review` avant d'être considérée mergeable.

Le pipeline ne dépend donc pas d'une hypothèse implicite sur le comportement du
provider Git : il observe l'état réel, le persiste, puis agit.

---

## Après acceptation des PRs

Une PR acceptée merge toujours dans sa base déclarée :

- PR indépendante : `pr/<run-id>/<slug>` → `defaultTargetBranch` (`main` par
  défaut).
- PR empilée : `pr/<run-id>/package-b` → `pr/<run-id>/package-a`, puis retarget
  ou rebase après merge de `package-a`.

Une PR ne merge jamais dans `work/<run-id>`. La branche `work/<run-id>` est le
matériau brut, pas la destination d'intégration.

Après chaque merge :

1. Le pipeline enregistre le statut réel de la PR (`merged`, `closed`,
   `rejected`, ou `needs-rebase`).
2. Il enregistre le commit de merge, squash, ou rebase obtenu côté provider.
3. Il met à jour les PRs dépendantes.
4. Toute PR dont la base a changé repasse par `pr-ci-review`.
5. Quand toutes les PRs du run sont merged ou explicitement abandonnées, le run
   peut être clôturé.

Cleanup par défaut :

- Supprimer `work/<run-id>` seulement quand les branches de PR sont créées, leur
  preuve de reconstruction est enregistrée, et le run n'a plus besoin du diff
  brut pour recovery.
- Supprimer une branche `pr/<run-id>/<slug>` seulement après merge ou abandon
  explicite.
- Conserver `work/<run-id>` si une PR est rejetée, si le split échoue, ou si un
  humain demande une inspection du diff brut.

---

## Règles de nommage des branches

```
work/<run-id>
pr/<run-id>/<slug>
review-bot/<run-id>/<slug>
```

- `<run-id>` : ULID de la run Turnlock (identique pour tout le pipeline d'un `/go`)
- `<slug>` : kebab-case court décrivant le paquet (ex: `refacto-utils`, `nouvelle-api`, `fix-typo`)

`work/<run-id>` est réservé à l'implémentation brute locale. Les branches
`pr/<run-id>/<slug>` sont les seules branches pushées et utilisées pour ouvrir
des PRs en mode normal. Toute branche créée par le pipeline hors de ces patterns
est rejetée.

---

## Règles pour les messages de commit

Conventional Commits, format standard :

```
<type>(<scope>): <description>

[body]

[footer]
```

Types : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`.

Le message est généré par l'agent `commit-formatter` (Haiku) et validé par le
pipeline avant push.

---

## Intégration avec Turnlock

La phase commit/push/PR reste une fonction standalone conforme à
[`phase-harness/NIB-S-go-phase-harness.md`](./phase-harness/NIB-S-go-phase-harness.md). Dans le pipeline complet, elle est enveloppée par une FSM
Turnlock dans la FSM maîtresse `/go` :

```
Super FSM /go
  │
  ├── phase:workspace-setup
  │     ├── record baseBranch + baseHeadSha
  │     └── create work/<run-id>
  │
  ├── phase:implementation
  │     └── agent works on work/<run-id>
  │
  ├── phase:agent-conduct-check → lint → typecheck → tests
  ├── phase:pre-pr-review
  │
  ├── phase:commit-push-pr  ← cette FSM
  │     ├── step:analyze-work-diff → DELEGATE(commit-planner)
  │     ├── step:validate-package-plan
  │     ├── step:create-pr-branches-from-base
  │     ├── step:apply-changes → DELEGATE(commit-formatter)
  │     ├── step:push-pr-branches-and-create-prs
  │     └── step:trigger-pr-ci-review
  │
  ├── phase:pr-ci-review  (exécutée en CI)
  ├── post-merge tracking
  │     ├── record merged PRs
  │     ├── update dependent PRs
  │     └── cleanup work/pr branches when safe
  │
  └── ...
```

Le `state.json` du wrapper commit-push-pr contient le plan de découpage, la
preuve de reconstruction du diff, le `WorkSession` produit par `workspace-setup`,
les branches de PR créées, les commits, les URLs des PRs ouvertes, les statuts de
merge, et les références vers les `PhaseOutput`/artefacts de review. En cas
d'interruption, la reprise lit `state.json` et sait exactement où elle en est.

---

## Références

- `ideal-review.md` — les 13 dimensions utilisées par `pre-pr-review` et `pr-ci-review`
- `software-design-workflow.md` — le pipeline `/go` complet
- [`agent-conduct-check.md`](./agent-conduct-check.md) — règles de conduite de l'agent pendant l'implémentation
- [`go-pipeline-contract.md`](./go-pipeline-contract.md) — contrat des phases, sévérités, artefacts JSON, et gates
