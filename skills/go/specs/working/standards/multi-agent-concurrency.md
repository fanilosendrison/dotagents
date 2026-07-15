# Concurrence multi-agent dans `/go`

> **Terminologie :** Dans ce document, « worktree » désigne le répertoire
> de travail isolé du run (le principe d'isolation physique), pas la commande
> `git worktree add` (le mécanisme). Les principes d'isolation, de branches
> namespacées, et de merge séquentiel s'appliquent à toute stratégie de
> workspace (worktree Git ou clone sandbox). Voir
> [ADR-go-workspace-agnostic-terminology.md](../../adr/ADR-go-workspace-agnostic-terminology.md).

Ce document décrit comment plusieurs runs `/go` peuvent travailler sur le même
repository sans partager de working directory.

---

## 1. Principe

Chaque run possède :

- un `runId` stable ;
- un worktree Git physique privé ;
- une branche `work/<runId>` ;
- un `artefactDir` privé ;
- un `WorkflowState` privé ;
- des branches PR namespacées.

Le partage se fait uniquement au niveau du repository Git et du provider distant,
jamais au niveau du working directory.

---

## 2. Pourquoi une branche ne suffit pas

Une branche Git isole l'historique, mais pas le filesystem.

Un checkout unique partage :

- fichiers non suivis ;
- fichiers ignorés ;
- artefacts de build ;
- index Git courant ;
- watchers et processus locaux ;
- modifications d'éditeur ;
- lockfiles temporaires.

Le stage harness calcule `trackedWorktreeHash` et `worktreeClean` en supposant
que le `workDir` est exclusif pendant le stage. Si deux runs partagent le même
checkout, cette hypothèse est fausse.

---

## 3. Layout recommandé

```text
<repo>/
  .git/
  ...

<go-run-root>/runs/
  <runId-a>/
    worktree/
    artefactRoot/
  <runId-b>/
    worktree/
    artefactRoot/
```

Les chemins exacts peuvent évoluer, mais les invariants restent :

- workspace hors du checkout principal ou clairement isolé ;
- artefacts hors du workspace ;
- un run ne lit pas ou n'écrit pas dans le workspace d'un autre run.

---

## 4. Branches

Branches réservées :

```text
work/<runId>
pr/<runId>/<slug>
review-bot/<runId>/<slug>
```

`work/<runId>` est la branche brute locale du run.

`pr/<runId>/<slug>` est une branche de PR publiée.

`review-bot/<runId>/<slug>` est réservée aux corrections post-PR si elles sont
autorisées par `WorkflowPolicy.delegation`.

Toute branche créée par `/go` hors de ces patterns doit être rejetée.

---

## 5. Merge comme point de sérialisation

Plusieurs runs peuvent produire des PRs en parallèle. Le merge dans la branche
cible reste séquentiel.

Après chaque merge :

- les PRs dépendantes ou concurrentes observent le nouvel état distant ;
- les PRs qui ont drifté repassent par `pr-ci-review` ;
- les conflits simples peuvent être résolus par délégation agentique ;
- les conflits non résolus ouvrent une HumanGate.

---

## 6. Rebase loop

```text
PR en attente
  -> base branch avance
  -> detect drift
  -> attempt rebase
  -> if clean: pr-ci-review
  -> if conflict: delegate conflict resolver
  -> if unresolved: HumanGate
```

La résolution de conflit ne modifie jamais une PR déjà mergée. Elle adapte
uniquement la PR en attente.

---

## 7. Nettoyage

Le nettoyage doit être conservateur.

Supprimer `work/<runId>` seulement si :

- les branches PR nécessaires existent ;
- la preuve de reconstruction du diff final est persistée ;
- aucun rollback ou handoff humain ne dépend du diff brut ;
- le run est clos ou explicitement abandonné.

Supprimer `pr/<runId>/<slug>` seulement après merge, fermeture explicite, ou
abandon documenté.

---

## 8. Limites

La concurrence multi-agent ne résout pas les conflits sémantiques. Elle fournit
un cadre pour les détecter, les déléguer, les prouver, ou les escalader.

Le coût des rechecks augmente avec le nombre de PRs en attente. C'est le prix du
merge séquentiel sur une branche cible partagée.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
