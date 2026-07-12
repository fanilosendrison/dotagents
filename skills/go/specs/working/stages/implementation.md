# Stage `implementation`

`implementation` est le stage qui délègue la création du changement à un agent.
Elle peut recevoir un prompt simple ou un ensemble complet de specs NIB.

---

## 1. Nature du stage

`implementation` est un stage valide, mais pas un check mécanique.

Son contour est déterministe :

- valider les inputs ;
- préparer les artefacts ;
- déléguer ;
- collecter ;
- snapshotter ;
- valider ;
- persister.

Son coeur est non déterministe : l'agent raisonne, édite, teste, itère.

---

## 2. Inputs

- `RequestedChange`
- `WorkSession`
- specs applicables (`NIB-S`, `NIB-M`, `NIB-T`, DC, ADR)
- project discovery
- contraintes d'autorisation

---

## 3. Outputs

Evidence JSON :

```ts
type ImplementationEvidence = {
  requestedChangeRef: string;
  consumedSpecRefs: string[];
  changedFiles: ChangedFile[];
  summary: string;
  exploratoryChecks: string[];
};
```

Les checks exploratoires lancés par l'agent ne sont pas autoritaires. Les gates
officielles s'exécutent après `change-snapshot`.

---

## 4. Règles

- L'agent travaille uniquement dans le worktree du run.
- L'agent ne publie pas de commit.
- L'agent ne push pas.
- L'agent ne modifie pas les artefacts d'autres runs.
- L'agent peut lancer des commandes exploratoires, mais leur succès ne remplace
  pas `mechanical-gates`.
- Si le stage consomme des NIB, il doit respecter RED/GREEN quand applicable.

---

## 5. Phases Turnlock typiques

```text
validate-implementation-inputs
prepare-implementation-artefacts
delegate-implementation-agent
collect-agent-result
collect-change-snapshot
validate-implementation-evidence
persist-stage-output
```

---

## 6. Failure modes

- Agent bloqué : `failed` ou HumanGate selon policy.
- Output agentique invalide : `errored`.
- Mutation hors worktree : `failed`.
- Specs contradictoires : HumanGate ou `failed`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
