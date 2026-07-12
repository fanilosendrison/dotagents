---
id: ARD-GO-STAGE-HARNESS-V1-NON-GOALS
type: ard
version: "1.0.0"
scope: go-stage-harness
status: active
supersedes: []
superseded_by: []
---

# ARD — Non-goals de la v1 du stage harness

## Contexte

Le [NIB-S du stage harness](../briefs/stage-harness/NIB-S-go-stage-harness.md)
(§12) liste 8 non-goals explicites que l'agent implémentant ne doit PAS ajouter
en v1. Cet ARD documente la raison de chaque exclusion et la trajectoire prévue.

La philosophie directrice est celle de l'IFE : *"Reliability precedes
intelligence."* La v1 valide le noyau minimal — un pipeline M1→M7 fiable et
vérifiable — avant toute généralisation. Chaque non-goal est soit une couche
supérieure (Turnlock, chaining), soit une variante d'interface (CLI), soit un
edge case de robustesse (timeout, fsync, sparse checkout) qui diluerait le focus
de la v1.

---

## Décision 1 : Pas de Turnlock FSM

**Nature** : Turnlock est la couche de résilience (state machine, retry,
resume). Le harness est conçu comme **Turnlock-free** — le stage est une
fonction asynchrone pure (`StageInput → StageDraftOutput`) qui ne connaît ni
Turnlock ni les state machines.

**Raison** : Séparation architecturale. Turnlock viendra comme un *wrapper
mécanique* autour de `runStage`, sans modifier l'implémentation des stages. Si
le harness intégrait Turnlock en v1, il deviendrait couplé à un composant qui
lui est orthogonal.

**Trajectoire** : v2 — adaptateur Turnlock qui wrappe `runStage` sans toucher au
harness.

---

## Décision 2 : Pas d'adaptateur CLI

**Nature** : L'API canonique est la function API (`Stage → runStage →
StageOutput`). Un adaptateur CLI (subprocess, stdin/argv → stdout) est une
interface alternative, pas une partie du harness.

**Raison** : Le CLI est un consommateur du harness. L'ajouter en v1 mélangerait
deux responsabilités (exécution de stage vs interface de lancement) et
complexifierait le contrat fonctionnel. De plus, la capture stdout/stderr n'est
pas garantie pour les stages in-process — le CLI est le moment où cette capture
devient pertinente.

**Trajectoire** : v2 — thin wrapper qui lit `StageInput` depuis stdin/argv,
invoque `runStage`, et écrit `StageDraftOutput` sur stdout.

---

## Décision 3 : Pas de chaînage de stages

**Nature** : Le harness exécute **un stage unique**. Le chaînage (output d'une
stage → input de la suivante, `previousStageOutputs`, `attemptNumber`) n'existe
pas.

**Raison** : Le chaînage est une responsabilité d'orchestration (le pipeline
`/go`), pas du harness. Le harness doit rester une brique pure : un stage, un
run, un `output.json`. Le pipeline assemble les briques.

**Trajectoire** : v2 — le pipeline `/go` passe `previousStageOutputs` et
`attemptNumber` dans `StageInput.config` ou dans un type enrichi, sans changer
le harness.

---

## Décision 4 : Pas de gestion du timeout

**Nature** : Aucun `timeoutMs` dans `StageInput`, aucun `AbortSignal`. Le
harness attend indéfiniment que le stage retourne ou throw.

**Raison** : Le timeout est un mécanisme de robustesse opérationnelle qui
touche M3 (invocation). L'ajouter avant d'avoir un pipeline stable introduirait
de la complexité — que faire d'un stage interrompue ? Le `StageOutput` est-il
valide ? L'`artefactDir` est-il dans un état cohérent ? — sans bénéfice immédiat
pour valider le flux nominal.

**Trajectoire** : v2 — `timeoutMs` dans `StageInput` et `AbortSignal` pour
l'annulation coopérative. Un stage timeouté → `errored`.

---

## Décision 5 : Pas de garantie `fsync`

**Nature** : M7 écrit `output.json` atomiquement (tmp + rename) mais ne fait
pas `fsync` sur le fichier ni sur le répertoire parent. Un crash OS/électrique
peut théoriquement perdre l'output malgré un `runStage` réussi.

**Raison** : `fsync` est une garantie de durabilité physique, distincte de la
résilience logique (Turnlock). Sur les filesystems modernes avec `rename`
atomique, le risque est faible. L'ajouter demande de spécifier précisément les
appels (`fsync` fichier + `fsync` répertoire) et les sémantiques attendues par
plateforme — une complexité disproportionnée pour une v1.

**Relation avec Turnlock** : Turnlock peut atténuer le problème (rejouer une
stage dont l'output a été perdu), mais ce n'est pas équivalent — rejouer une
stage réussie peut avoir des effets de bord. La garantie `fsync` reste
souhaitable en complément, pas en remplacement.

**Trajectoire** : v2 — spécification précise des appels `fsync` dans
`NIB-M-GO-STAGE-HARNESS-PERSISTENCE` pour une durabilité Turnlock-grade.

---

## Décision 6 : Pas de hash des fichiers untracked/ignored

**Nature** : `trackedWorktreeHash` ne couvre que les fichiers trackés (via
`git ls-files`). Les fichiers untracked et `.gitignore`-d sont exclus.

**Raison** : L'invariant §6.11 est explicite. Hasher les untracked/ignored
nécessiterait de parcourir tout le worktree, de gérer les `.gitignore`, et de
décider quoi faire des fichiers générés (build artifacts, `node_modules`).
Scope trop large pour une v1, et `worktreeClean` capture déjà la présence de
fichiers non trackés via `git status --porcelain`.

**Trajectoire** : v2 potentielle — option `includeUntracked` dans
`StageInput.config`, mais probablement pas nécessaire.

---

## Décision 7 : Pas de support sparse checkout, skip-worktree, assume-unchanged

**Nature** : Ces trois features Git modifient la relation entre l'index et le
working tree, cassant les invariants simples du harness.

| Feature | Effet | Impact harness |
|---------|-------|---------------|
| **Sparse checkout** | Certains fichiers trackés sont absents du disque | `trackedWorktreeHash` ne peut pas les lire |
| **Skip-worktree** | Git ignore les modifications locales de fichiers spécifiques | `worktreeClean` peut dire "clean" alors que le disque a changé |
| **Assume-unchanged** | Git promet de ne pas vérifier certains fichiers | Même problème que skip-worktree |

**Raison** : Le harness repose sur l'équivalence *ce que Git voit = ce qui est
sur le disque*. Ces trois features cassent cette équivalence. Les gérer
correctement demanderait de détecter quels fichiers sont concernés, d'adapter
le calcul du `trackedWorktreeHash` et la sémantique de `worktreeClean`, et de
décider quoi faire des fichiers manquants. C'est un nid à bugs pour une v1. Le
preflight (M1) bloque donc : si l'un de ces bits est détecté, le stage ne
démarre pas.

**Trajectoire** : v2 — support progressif, en commençant par skip-worktree
(hasher le fichier sur disque malgré le bit) et en laissant sparse checkout pour
plus tard.

---

## Décision 8 : Pas de capture stdout/stderr garantie pour les stages in-process

**Nature** : Pour les stages exécutés comme fonctions asynchrones
(in-process), la capture de stdout/stderr n'est pas garantie. `stdout.txt` et
`stderr.txt` sont optionnels dans `artefactDir`.

**Raison** : Capturer les streams globaux du processus pendant qu'une fonction
async s'exécute est fragile (concurrence avec d'autres opérations, bibliothèques
qui écrivent sur stdout). Les stages doivent écrire leur diagnostic dans
`evidence/`. La capture stdout/stderr sera pertinente et fiable uniquement avec
l'adaptateur CLI subprocess.

**Trajectoire** : v2 — quand l'adaptateur CLI existe, le harness capture
stdout/stderr du subprocess dans `stdout.txt` et `stderr.txt`.
