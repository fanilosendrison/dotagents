# Workspace Setup — Phase canonique du pipeline `/go`

Phase déterministe avant toute implémentation. Elle fige le point de départ du
run : repo, branche courante, `HEAD`, état dirty, branche cible par défaut, et
branche de travail privée.

---

## Responsabilités

- Détecter `repositoryRoot`, `baseBranch`, `baseHeadSha`, et `defaultTargetBranch`.
- Refuser un worktree dirty sauf adoption explicite dans le run.
- Créer `work/<run-id>` depuis `baseHeadSha`.
- Checkout `work/<run-id>`.
- Persister `WorkSession` dans `state.json`.

Cette phase ne produit aucun code applicatif. Elle crée seulement le terrain
contrôlé sur lequel l'agent pourra travailler.

---

## `WorkSession`

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

## Règles

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

## Diff d'entrée pour `commit-push-pr`

```text
diff = work/<run-id> - baseHeadSha
```

La phase `commit-push-pr` transforme ce diff brut en branches de PR propres.
Voir [`commit-push-pr.md`](./commit-push-pr.md).
