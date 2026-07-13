# Startup branch `run-capture`

`run-capture` fige les preuves minimales du moment ou l'utilisateur lance
`/go`. Il ne comprend pas la demande et ne produit pas d'analyse d'intention.

Cette branche existe pour la tracabilite, la reproductibilite de la review, et la
preuve que les reviews ulterieures ont travaille sur le meme contexte gele.

---

## 1. Objectif

Produire un `RunCaptureArtifact` mecanique contenant :

- une reference stable vers la session source ;
- un extrait minimal et gele de la session ;
- le prompt exact associe au `/go` ;
- les hashes de contenu du prompt et de l'extrait ;
- les references des fichiers d'evidence ecrits sous l'`artefactRoot` du run.

`run-capture` ne resout pas les specs, ne deduit pas les contraintes, ne cree
pas de criteres d'acceptation, et ne decide pas si la demande est faisable.

---

## 2. Position dans le workflow

`run-capture` est lance a l'interieur de la phase Turnlock `run-init`, en
parallele des autres startup tasks :

```text
run-init
├─ run-capture
├─ repo-discovery-draft
└─ workspace-setup
```

Il ne bloque pas `workspace-setup`, `repo-discovery-draft` ou
`project-discovery-finalize`. Pour v1, il bloque toutefois la sortie finale de
`run-init` : la delegation `implementation` ne doit pas etre emise tant que
`RunCaptureArtifact` n'est pas terminal, schema-valide et hash-verifie.

Il reste aussi bloquant aux stages de review :

```text
implementation delegation requires RunCaptureArtifact
pre-package-review requires RunCaptureArtifact
pr-ci-review requires RunCaptureArtifact
```

Si le `RunCaptureArtifact` est absent, invalide, ou si ses hashes ne
correspondent pas aux fichiers d'evidence, la review echoue fermee.

---

## 3. Inputs

- `runId` fourni par Turnlock et stocke par `run-init` ;
- `artefactRoot` cree ou reserve pour le run ;
- `sessionRef` fourni par le parent process ou le harness appelant ;
- prompt exact associe au `/go` ;
- extrait minimal de session selectionne par le parent process ;
- horodatage de capture fourni par l'horloge du workflow.

`run-capture` ne lit pas le worktree et ne depend pas de `WorkSession`.

---

## 4. Outputs

Artefact metier principal :

```ts
type RunCaptureArtifact = {
  schema: "go.run-capture.v1";
  id: string;
  runId: string;
  sessionRef: string;
  sessionExcerptRef: string;
  promptAtGoRef: string;
  promptHash: string;
  excerptHash: string;
  capturedAt: string;
};
```

Evidence typiques :

- `prompt-at-go.txt` ;
- `session-excerpt.md` ;
- `run-capture.json` ;
- event d'audit indiquant les hashes calcules.

Les champs `promptAtGoRef` et `sessionExcerptRef` pointent vers des fichiers
sous l'`artefactRoot`. Les hashes sont des hashes de contenu :
`sha256:<lowercase-hex>` calcule sur les octets exacts des fichiers ecrits,
apres normalisation explicite du format d'ecriture.

Ces hashes ne sont pas des hashes JSON JCS. Ils prouvent l'identite des preuves
textuelles gelees. Les hashes de payloads JSON metier sont definis separement
par le profil JCS dans
[`canonical-hashing.md`](../standards/canonical-hashing.md).

---

## 5. Responsabilites

- Ecrire le prompt `/go` exact dans un fichier d'evidence.
- Ecrire l'extrait minimal de session dans un fichier d'evidence.
- Calculer les hashes de contenu du prompt et de l'extrait.
- Produire un `RunCaptureArtifact` valide.
- Produire un `WorkflowExecutionRecord` durable. Si cette branche est executee
  via le stage harness, ce record reference aussi le `StageOutput` canonique.

---

## 6. Non-responsabilites

`run-capture` ne doit jamais :

- resumer la demande ;
- extraire des contraintes ;
- produire des criteres d'acceptation ;
- lister des specs applicables ;
- relire tout l'historique de session si un extrait minimal est fourni ;
- modifier le repo cible ;
- modifier le worktree prive ;
- bloquer `workspace-setup`, `repo-discovery-draft` ou
  `project-discovery-finalize`.

Ces operations appartiennent soit au parent process qui fournit le contexte,
soit aux stages de review qui analysent le diff reel.

---

## 7. Regles de minimisation

Le `sessionExcerptRef` doit contenir uniquement ce qui est necessaire pour que
la review puisse comprendre l'intention utilisateur :

- messages utilisateur pertinents avant `/go` ;
- clarifications acceptees ;
- contraintes explicites ;
- refus explicites ;
- contexte de decision indispensable.

Il ne doit pas copier toute la session par defaut. La session complete reste
referencable via `sessionRef`, mais le run doit rester reviewable avec
`sessionExcerptRef` si la session source devient indisponible.

---

## 8. Regles de parallelisme

`run-capture` peut s'executer en parallele avec les startup tasks qui ne
consomment pas ses sorties. Pour v1, `run-init` doit tout de meme joindre
`run-capture` avant de deleguer `implementation`.

Les startup branches ne doivent pas ecrire directement dans `WorkflowState`.
Chaque branche produit son artefact dans son propre espace d'evidence et un
`WorkflowExecutionRecord`. `run-init` projette ensuite les artefacts valides
dans le `WorkflowState` donne a Turnlock avec la delegation `implementation`.

---

## 9. Operations internes typiques

```text
resolve-run-capture-inputs
write-prompt-evidence
write-session-excerpt-evidence
hash-capture-evidence
write-run-capture-artifact
persist-execution-record
```

---

## 10. Failure modes

- `sessionRef` absent : `failed`.
- Prompt `/go` absent : `failed`.
- Extrait de session absent ou vide sans justification : `failed`.
- Hash mismatch apres ecriture : `errored`.
- Evidence hors `artefactRoot` : `errored`.
- Artefact JSON invalide : `errored`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
