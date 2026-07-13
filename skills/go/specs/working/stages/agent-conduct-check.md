# Stage `conduct-settled`

`conduct-settled` vérifie les traces laissées après une délégation qui a pu
modifier le filesystem ou l'environnement de travail.

---

## 1. Objectif

Empêcher qu'un diff techniquement correct soit accepté alors que le processus de
création a laissé des traces dangereuses.

Ce stage est une gate de sécurité du processus agentique.

---

## 2. Position dans le workflow

`conduct-settled` s'exécute après :

- `implementation`
- toute correction issue de `mechanical-gates`
- toute `review-remediation` appliquée
- toute résolution de conflit en PR

Ce stage précède les gates mécaniques principales.

---

## 3. Responsabilités

- Détecter les secrets dans la staging area.
- Détecter les fichiers `.env` ou configs sensibles non ignorés.
- Détecter les fichiers temporaires déclarés mais non nettoyés.
- Détecter les permissions dangereuses dans le worktree.
- Détecter les processus debug persistants si observables.
- Vérifier que l'état Git n'a pas de staging ambigu.
- Produire des findings `agent-conduct` si nécessaire.

---

## 4. Limite importante

Ce stage détecte après coup. Elle ne remplace pas les enforcers qui
empêchent en amont les commandes dangereuses, secrets en ligne de commande, ou
mutations interdites.

Le modèle cible est donc :

```text
enforcement runtime
  -> empêche les actions interdites

conduct-settled
  -> vérifie les résidus après délégation
```

---

## 5. Outputs

Artefact métier typé `conduct-evidence` :

```ts
type AgentConductEvidence = {
  schema: "go.agent-conduct-evidence.v1";
  checks: AgentConductCheck[];
  reviewFindingsArtifactId?: string;
};
```

```ts
type AgentConductCheck = {
  id: string;
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
};
```

Si le stage produit des findings, ils sont écrits dans un
`ReviewFindingsArtifact` séparé avec `stage: "conduct-settled"` et
`dimension: "agent-conduct"`.

---

## 6. Règles

### 6.1 Secrets

Aucun secret ne doit apparaître dans :

- fichiers versionnés ;
- staging area ;
- fichiers non suivis non ignorés ;
- logs ou evidence files ;
- messages de commit planifiés.

### 6.2 Fichiers temporaires

Les fichiers temporaires déclarés par une délégation doivent être nettoyés ou
référencés explicitement comme evidence.

### 6.3 Permissions

Les permissions world-writable ou exécutables inattendues produisent un finding
bloquant sauf justification.

### 6.4 Debug persistants

Un processus debug laissé ouvert est bloquant.

---

## 7. Operations internes typiques

```text
load-last-snapshot
run-secret-scan
inspect-temporary-files
inspect-permissions
inspect-git-staging
write-conduct-evidence
persist-stage-output
decide-transition
```

---

## 8. Failure behavior

Un risque durable ou une fuite potentielle produit `failed` avec au moins un
`StageError` bloquant synthétique et, si le risque doit être traité dans la
boucle de remediation, un `ReviewFinding` `Critical` dans un
`ReviewFindingsArtifact`.

`StageOutput.errors` ne porte jamais le payload complet du finding. Il porte le
diagnostic d'exécution ou le résumé bloquant nécessaire au statut de stage.

Un échec d'inspection produit `errored`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
