# `/go` Workflow - Specs

Ce dossier contient les specs du workflow `/go`.

Les documents actifs distinguent maintenant :

- **stage** : étape métier du workflow ;
- **startup task** : travail d'amorcage du run, hors stages métier ;
- **phase Turnlock** : unité atomique, persistée et reprenable ;
- **délégation** : travail agentique non déterministe encadré ;
- **stage harness** : contrat `StageInput -> StageOutput` ;
- **artefact métier typé** : payload JSON durable validé avant projection dans
  `WorkflowState`.

Voir [`working/workflow/canonical-vocabulary.md`](./working/workflow/canonical-vocabulary.md).

---

## Briefs NIB

Ces documents sont normatifs pour construction RED/GREEN.

- [`briefs/stage-harness/`](./briefs/stage-harness/) - Harness standalone pour
  exécuter un stage et produire un `StageOutput` canonique.

---

## ADR actifs

- [`ADR-go-stage-harness-v1-non-goals.md`](./adr/ADR-go-stage-harness-v1-non-goals.md)
  - Non-goals v1 du stage harness.
- [`ADR-go-stages-vs-turnlock-phases.md`](./adr/ADR-go-stages-vs-turnlock-phases.md)
  - Séparation stage, phase Turnlock, délégation, stage harness.
- [`ADR-go-physical-worktree-isolation.md`](./adr/ADR-go-physical-worktree-isolation.md)
  - Worktree Git physique privé par run `/go`.
- [`ADR-go-review-before-packaging-with-package-verify.md`](./adr/ADR-go-review-before-packaging-with-package-verify.md)
  - Review globale avant packaging, avec vérification obligatoire du split.
- [`ADR-go-stage-output-envelope-and-typed-business-artifacts.md`](./adr/ADR-go-stage-output-envelope-and-typed-business-artifacts.md)
  - `StageOutput` comme enveloppe d'exécution, payloads riches en artefacts
    métier typés.

---

## Working actifs

Ces documents sont les specs de conception en cours. Ils seront promus en NIB
quand leur niveau de détail sera suffisant pour construction.

### Workflow

- [`canonical-vocabulary.md`](./working/workflow/canonical-vocabulary.md)
  - Vocabulaire canonique.
- [`canonical-hashing.md`](./working/workflow/canonical-hashing.md)
  - Profil RFC 8785 / JCS pour les hashes JSON metier.
- [`external-primitives.md`](./working/workflow/external-primitives.md)
  - Standards, formats et outils a reutiliser au lieu de primitives maison.
- [`go-workflow-contract.md`](./working/workflow/go-workflow-contract.md)
  - Contrat central du workflow.
- [`software-design-workflow.md`](./working/workflow/software-design-workflow.md)
  - Cycle complet `/go`.
- [`multi-agent-concurrency.md`](./working/workflow/multi-agent-concurrency.md)
  - Concurrence multi-run et worktrees physiques.

### Startup

- [`repo-capture.md`](./working/startup/repo-capture.md)
  - Resolution parent process du repo cible avant `run-init`.
- [`run-init.md`](./working/startup/run-init.md)
  - Startup du run, startup branches, joins et projection fail-closed.
- [`run-capture.md`](./working/startup/run-capture.md)
  - Capture mecanique du prompt `/go`, de l'extrait de session et des hashes.
- [`workspace-setup.md`](./working/startup/workspace-setup.md)
  - Creation du worktree physique et `WorkSession`.
- [`repo-discovery-draft.md`](./working/startup/repo-discovery-draft.md)
  - Discovery repo non autoritative depuis le checkout source.
- [`project-discovery-finalize.md`](./working/startup/project-discovery-finalize.md)
  - Finalisation de la discovery repo contre le worktree prive.

### Artefacts

- [`workflow-artifacts.md`](./working/artifacts/workflow-artifacts.md)
  - Types JSON partagés du workflow, dont artefacts métier typés.

### Stages

- [`implementation.md`](./working/stages/implementation.md)
  - Délégation agentique d'implémentation.
- [`agent-conduct-check.md`](./working/stages/agent-conduct-check.md)
  - Gate `conduct-settled`.
- [`mechanical-gates.md`](./working/stages/mechanical-gates.md)
  - Format, lint, typecheck, tests, build, scans.
- [`review-remediation.md`](./working/stages/review-remediation.md)
  - HumanGate, remediation, dismiss, defer, abort.

### Packaging

- [`package-and-publish.md`](./working/packaging/package-and-publish.md)
  - `package-plan`, `package-verify`, branches, commits, PRs.

### Review

- [`ideal-review.md`](./working/review/ideal-review.md)
  - Dimensions, sévérités, preuves, boucle de remediation.
- [`pr-ci-review.md`](./working/review/pr-ci-review.md)
  - Gate CI autoritative sur la PR publiee.

---

## Legacy

- [`legacy/`](./legacy/) - Anciens documents historiques.
- [`legacy/working-pre-semantic-turnlock-split/`](./legacy/working-pre-semantic-turnlock-split/)
  - Ancienne génération des fichiers `working/`, archivée avant adoption du
    vocabulaire stage / phase Turnlock.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
