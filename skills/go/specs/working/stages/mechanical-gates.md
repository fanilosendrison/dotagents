# Stage `mechanical-gates`

`mechanical-gates` exécute les checks déterministes requis pour le repo.

---

## 1. Objectif

Vérifier mécaniquement le dernier `ChangeSnapshot` avant review sémantique ou
packaging.

---

## 2. Inputs

- dernier `ChangeSnapshot`
- `ProjectDiscovery` finalise
- `WorkSession`
- `WorkflowPolicy.gates`

---

## 3. Outputs

- `CheckRun[]`
- `StageOutput`
- evidence files par commande exécutée

---

## 4. Ordre recommandé

L'ordre exact vient de `ProjectDiscovery`, mais l'ordre par défaut est :

```text
format-check
lint
typecheck
tests
build
security
generated-drift
api-compat
```

Les checks rapides et structurels précèdent les checks coûteux.

`mechanical-gates` consomme uniquement `ProjectDiscovery` produit par
`project-discovery-finalize`, qui a deja scanne le worktree prive.

---

## 5. Règles

- Chaque check produit un `CheckRun`.
- Les commandes sont des argv, pas des chaînes shell concaténées.
- Les sorties longues vont en evidence files.
- Les formats standards disponibles doivent etre conserves comme evidence :
  JUnit XML ou TAP pour tests, LCOV ou Cobertura pour coverage, SARIF pour
  diagnostics lint, security ou static analysis.
- Un check requis failed bloque le stage.
- Un check optionnel failed produit finding ou warning selon
  `WorkflowPolicy.gates.allowOptionalGateFailure`.
- Toute correction déléguée retourne à `change-snapshot`.

`CheckRun` est l'enveloppe workflow du resultat. Il ne remplace pas les formats
standard emis par les outils. Voir
[`external-primitives.md`](../standards/external-primitives.md).

---

## 6. Délégation de correction

`mechanical-gates` peut déléguer une correction si un check échoue.

Cette délégation ne rend pas le check vert. Après correction :

```text
delegate-fix
-> change-snapshot
-> conduct-settled
-> mechanical-gates
```

---

## 7. Operations internes typiques

```text
load-gate-matrix
run-next-check
persist-check-run
decide-fix-or-continue
delegate-fix-if-authorized
persist-stage-output
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
