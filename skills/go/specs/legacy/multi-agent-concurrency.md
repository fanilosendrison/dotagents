# Multi-Agent Concurrency — Sessions parallèles sur le même repo

Ce document explique comment N sessions d'agents peuvent travailler simultanément
sur le même repository, les mêmes fichiers, sans conflit ni coordination humaine.
Il décrit le problème, la solution, et pourquoi personne ne le fait encore.

---

## Le problème

Deux agents (ou plus) modifient le même fichier en même temps :

```
Session A : edit src/auth.ts ligne 10
Session B : edit src/auth.ts ligne 42

→ Conflit ? Pas si les lignes sont différentes et que les branches sont isolées.
→ Corruption ? Oui si les deux écrivent dans le même working directory.
```

Le verrouillage traditionnel est « une session à la fois par repo ». C'est ce que
font les humains et ce que font les agents aujourd'hui. Ça ne scale pas.

---

## La solution en 4 couches

```
┌── Couche 1 : Isolement Git ──────────────────────────────┐
│                                                          │
│  work/<run-id> pour chaque /go                           │
│  Chaque session a sa propre branche, son propre worktree. │
│  Aucun partage de working directory.                      │
│                                                          │
│  Session A → work/abc123                                 │
│  Session B → work/def456                                 │
│  Session C → work/ghi789                                 │
│                                                          │
│  Zéro friction locale. Chaque agent voit SON diff.        │
└──────────────────────────────────────────────────────────┘

┌── Couche 2 : Pipeline par session ───────────────────────┐
│                                                          │
│  Chaque /go exécute son propre pipeline.                 │
│  Les phases standalone sont enveloppées par Turnlock.     │
│  Les pipelines sont indépendants, parallélisables.        │
│  Aucune attente inter-sessions.                           │
└──────────────────────────────────────────────────────────┘

┌── Couche 3 : Branches PR namespacées ─────────────────────┐
│                                                          │
│  pr/<run-id>/<slug>                                      │
│  Les branches PR sont préfixées par run-id.               │
│  Deux sessions ne peuvent pas créer la même branche.      │
│  Le push est sans danger.                                 │
└──────────────────────────────────────────────────────────┘

┌── Couche 4 : CI rebase loop ─────────────────────────────┐
│                                                          │
│  Au merge dans main, si une PR précédente a modifié       │
│  les mêmes fichiers, la PR suivante rebase automatiquement.│
│                                                          │
│  Conflit simple (lignes différentes) → rebase auto.       │
│  Conflit complexe (mêmes lignes) → DELEGATE(agent)       │
│    → l'agent adapte la PR en attente à main               │
│    → ne touche JAMAIS la PR déjà mergée                   │
│  → Re-run conduct → lint → typecheck → tests → review    │
│  → MERGEABLE ou FAIL + HumanGate                          │
└──────────────────────────────────────────────────────────┘
```

---

## Pourquoi ça marche

### Isolement local

Chaque `work/<run-id>` est un Git worktree ou une branche distincte. Les agents
ne partagent jamais de working directory. Pas de corruption, pas de merge
accidentel, pas de dirty state partagé.

### Déterministe par session

Chaque pipeline a une orchestration Turnlock indépendante avec son propre
`state.json`. Les phases restent des fonctions standalone conformes à
`phase-contract.md`, puis sont enveloppées par cette orchestration. Les sessions
ne communiquent pas entre elles. Le pipeline ne dépend pas de l'état d'une autre
session — il ne dépend que du `state.json` de sa propre run et des
`PhaseOutput` de ses propres phases.

### Merge = bottleneck unique, mais automatisé

Le seul point de sérialisation est le merge dans `main`. Une PR à la fois. Mais
au lieu de bloquer les sessions en attente, le CI rebase automatiquement. La PR
#43 qui attend derrière la PR #42 se rebase sur le nouveau `main` post-merge,
résout les conflits, re-run les checks, et est prête à merger.

### Aucune décision humaine par défaut

Le rebase est automatique pour les conflits simples (lignes disjointes). Pour les
conflits complexes (mêmes lignes), un agent dédié propose une résolution. L'humain
n'est sollicité qu'en dernier recours.

---

## Cas pratiques

### Scénario 1 : Fichiers différents

```
Session A → modifie src/auth.ts
Session B → modifie src/api.ts

→ Aucun conflit possible. Merge A puis B, zéro rebase nécessaire.
```

### Scénario 2 : Même fichier, lignes différentes

```
Session A → modifie src/auth.ts ligne 10-20
Session B → modifie src/auth.ts ligne 50-60

→ PR A merge dans main → OK
→ PR B merge → git détecte que main a avancé
  → rebase auto (pas de conflit, lignes disjointes)
  → re-run checks → merge
```

### Scénario 3 : Même fichier, mêmes lignes

```
Session A → modifie src/auth.ts ligne 30-35 (ajoute un check de validation)
Session B → modifie src/auth.ts ligne 30-35 (change le type de retour)

→ PR A merge → OK
→ PR B merge → CONFLIT
  → git rebase main → conflit sur src/auth.ts:30-35
  → DELEGATE(agent "conflict-resolver", Sonnet)
    → L'agent lit les deux versions
    → Il adapte la PR B pour intégrer le check de A avec le nouveau type de B
  → Re-run conduct → lint → typecheck → tests → review
  → MERGEABLE
```

### Scénario 4 : Conflit non résoluble automatiquement

```
Session A → refactor complet de src/auth.ts (200 lignes changées)
Session B → refactor complet de src/auth.ts (200 lignes changées)

→ PR A merge → OK
→ PR B merge → CONFLIT massif
  → DELEGATE(conflict-resolver) → échec
  → HumanGate : "PR #43 has unresolvable conflicts. Review manually."
```

---

## Ce que ça débloque

### Parallélisme massif

```
/gobatch "auth", "pagination", "refacto", "tests", "docs", "ci"
  → 6 sessions Pi simultanées
  → 6 PRs ouvertes
  → CI les merge une par une
  → Résultat : tout mergeé, zéro coordination manuelle
```

### Plus besoin d'ordonnancer les tâches

Avant : « je fais la refacto d'abord, puis la feature, puis les tests, sinon
conflit ». Maintenant : tout en parallèle, le CI trie.

### Choix du modèle d'implémentation décorrélé de la concurrence

Les sessions peuvent utiliser des modèles différents (Haiku pour la doc, Sonnet
pour l'auth). Les pipelines sont indépendants — pas de contention sur le modèle.

---

## Pourquoi personne ne le fait (encore)

| Ingrédient | Pourquoi c'est rare |
|------------|-------------------|
| `work/<run-id>` namespacé | Git le permet depuis toujours, mais personne n'automatise la création de branches isolées par session. Les agents écrivent dans la branche courante. |
| Orchestration Turnlock par session | Sans Turnlock, le pipeline est dans la tête de l'agent ou dans un script ad-hoc. Pas de `state.json` portable ni de `PhaseOutput` chaînable. |
| CI rebase loop agentique | GitHub a « Update branch » mais pas de résolution de conflit intelligente. Les humains rebasent manuellement. |
| Agent conduct check | Sans check de traces hors diff, deux sessions peuvent se fuiter des secrets, des fichiers temporaires, des ports debug. Personne ne vérifie ça aujourd'hui. |
| Branches PR namespacées | Trivial techniquement, mais personne n'a de convention de nommage appliquée par le pipeline. Les humains nomment leurs branches librement. |

Aucun de ces ingrédients n'est techniquement difficile seul. C'est l'assemblage
qui est inédit.

---

## Limites

- **Merge séquentiel** : `main` ne peut absorber qu'une PR à la fois. Si 10 PRs
  sont prêtes, elles mergeront en série. Le parallélisme est dans la création,
  pas dans le merge.
- **Conflits sémantiques** : le rebase résout les conflits Git (texte), pas les
  conflits de design (deux PRs qui implémentent la même feature différemment).
  Le pipeline ne peut pas décider quelle approche est la bonne — c'est une gate
  humaine.
- **Coût des re-runs** : chaque rebase invalide les checks précédents. Si 5 PRs
  se succèdent, la 5ème aura été re-checkée 5 fois. Le coût est proportionnel
  à la profondeur de la file d'attente.

---

## Références

- `software-design-workflow.md` — architecture générale du pipeline `/go`
- `go-pipeline-contract.md` — contrat central, phases, artefacts JSON
- `commit-push-pr-workflow.md` — découpage Git, branches, stacked PRs
- `ideal-review.md` — les 13 dimensions de la review
- `agent-conduct.md` — règles de conduite de l'agent
