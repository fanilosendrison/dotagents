# Primitives externes du workflow `/go`

Ce document fixe une regle transversale : `/go` ne doit pas reinventer une
primitive quand un format, un protocole, une CLI ou une bibliotheque maintenue
existe deja et couvre correctement le besoin.

`/go` peut definir ses artefacts metier, ses policies et ses transitions. Il ne
doit pas definir des variantes maison de standards etablis.

---

## 1. Regle generale

Pour chaque besoin technique, l'ordre de preference est :

1. utiliser l'outil ou le protocole autoritaire du domaine ;
2. utiliser une bibliotheque maintenue qui implemente le standard ;
3. ecrire un adaptateur mince vers cette primitive ;
4. definir une primitive `/go` seulement si le besoin est propre au workflow.

Une primitive `/go` specifique doit expliquer :

- pourquoi une primitive existante ne suffit pas ;
- quelle surface elle couvre exactement ;
- quels cas sont explicitement exclus ;
- quels tests prouvent sa stabilite.

---

## 2. Categories normatives

### Hashes JSON metier

Primitive externe :

- RFC 8785 / JSON Canonicalization Scheme (JCS).

Role de `/go` :

- valider le schema metier ;
- normaliser le domaine avant JCS ;
- prefixer le digest avec l'algorithme declare.

`/go` ne doit pas definir une canonicalisation JSON maison. Voir
[`canonical-hashing.md`](./canonical-hashing.md).

### Git, diffs, patchs et branches

Primitives externes :

- object ids, commit ids, tree ids et refs Git ;
- `git diff --binary --full-index` pour produire un patch complet ;
- `git apply --check` et `git apply` pour valider et appliquer un patch ;
- `git patch-id --stable` quand l'identite logique d'un patch suffit ;
- `git merge-tree` pour verifier une mergeability locale quand applicable ;
- `git range-diff` pour comparer deux series de commits.

Role de `/go` :

- choisir quel diff ou paquet doit etre verifie ;
- stocker les refs, hashes et preuves ;
- echouer ferme quand Git ne peut pas prouver l'etat attendu.

`/go` ne doit pas parser ou appliquer un diff avec un parseur maison quand Git
peut le faire.

### Checks, tests, coverage et diagnostics statiques

Primitives externes :

- JUnit XML ou TAP pour les resultats de tests quand disponibles ;
- LCOV ou Cobertura pour la coverage quand disponibles ;
- SARIF pour lint, security, static analysis et diagnostics code-level quand
  l'outil sait l'emettre ;
- les codes de sortie et stdout/stderr bruts comme fallback d'evidence.

Role de `/go` :

- envelopper chaque execution dans un `CheckRun` ;
- stocker les sorties longues en evidence files ;
- convertir les diagnostics utiles en findings seulement apres validation.

`/go` ne doit pas inventer un format universel de diagnostics quand un outil
emet deja un format standard.

### Discovery projet

Primitives externes :

- manifestes projet lus avec un parser adapte au format ;
- CLIs officielles quand elles existent, par exemple `cargo metadata`,
  `go list -json`, commandes du package manager ou scripts declares ;
- lockfiles comme preuves de presence et de hash, sauf si un outil officiel les
  interprete.

Role de `/go` :

- detecter quels fichiers et commandes sont pertinents ;
- hasher les fichiers inspectes ;
- finaliser la matrice de gates contre le worktree prive.

`/go` ne doit pas reimplementer un resolver de dependances, un parser de
lockfile complexe ou un systeme de workspace quand l'outil du langage sait deja
le decrire.

### Provider Git, PR et CI

Primitives externes :

- API provider pour PRs, diffs, commits, checks et statuses ;
- diff provider reel expose par l'API ;
- identifiants provider pour runs CI et checks.

Role de `/go` :

- comparer l'etat provider aux artefacts approuves ;
- projeter les resultats dans `PullRequestRecord`, `CheckRun` et findings ;
- detecter drift, retarget, conflict, checks manquants ou checks failed.

`/go` ne doit pas scraper l'UI provider ni deviner l'etat CI depuis du texte
libre si une API structuree existe.

### Runtime, locks, retries et reprise

Primitive externe :

- Turnlock.

Role de `/go` :

- fournir le payload metier stocke dans `WorkflowState` ;
- declarer les startup tasks, stages, artefacts et transitions attendues ;
- respecter les decisions de lock, retry, resume et atomic write de Turnlock.

`/go` ne doit pas definir son propre runtime de lock, journal, retry ou
persistance atomique.

### Schemas runtime

Primitive externe actuelle :

- Zod pour le stage harness.

Role de `/go` :

- definir les schemas metier ;
- valider les inputs et outputs aux frontieres ;
- garder les refinements qui dependent du contexte dans les modules qui ont ce
  contexte.

Si un artefact devient une interface publique hors TypeScript, `/go` doit
considerer JSON Schema ou un format public equivalent au lieu de supposer que
Zod est le contrat inter-langage.

### Logs, traces et evenements

Primitive externe :

- Turnlock events pour l'historique du run ;
- OpenTelemetry seulement si un besoin de traces distribuees apparait.

Role de `/go` :

- ecrire des evidence refs et artefacts metier ;
- relier les artefacts aux execution records ;
- eviter les phrases libres comme source d'autorite.

`/go` ne doit pas creer un second systeme de tracing parallele au runtime.

---

## 3. Primitives `/go` justifiees

Les primitives suivantes sont specifiques a `/go` et restent justifiees :

- `WorkflowState` : payload metier du workflow stocke par Turnlock ;
- `StageOutput` : enveloppe d'execution du stage harness ;
- `WorkflowExecutionRecord` : enveloppe d'audit d'une workflow unit ;
- `ReviewFinding` : decision de review consommable par le workflow ;
- `RunCaptureArtifact` : preuve mecanique du moment `/go` ;
- `ProjectDiscovery` : normalisation des signaux projet apres verification ;
- `trackedWorktreeHash` : empreinte deterministe du worktree tracke reel.

Ces primitives ne remplacent pas les formats externes. Elles les referencent,
les enveloppent ou les projettent dans le vocabulaire metier `/go`.

---

## 4. Checklist de conception

Avant d'ajouter une nouvelle primitive `/go`, verifier :

- Est-ce un artefact metier ou un format technique deja standardise ?
- Un outil du domaine peut-il produire ou verifier cette information ?
- Un format standard peut-il etre stocke comme evidence file ?
- La primitive `/go` ajoute-t-elle une decision de workflow, ou seulement une
  serialization differente ?
- Le workflow peut-il garder un adaptateur mince au lieu d'une
  reimplementation ?

Si la reponse montre seulement une preference de confort, la primitive ne doit
pas etre ajoutee.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
