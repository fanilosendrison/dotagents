# `/go` Pipeline - Specs

Ce dossier contient les specs du pipeline `/go`.

Les documents actifs distinguent maintenant :

- **stage** : étape métier du workflow ;
- **phase Turnlock** : unité atomique, persistée et reprenable ;
- **délégation** : travail agentique non déterministe encadré ;
- **stage harness** : contrat `StageInput -> StageOutput` ;
- **artefact métier typé** : payload JSON durable validé avant projection dans
  `PipelineState`.

Voir [`working/pipeline/canonical-vocabulary.md`](./working/pipeline/canonical-vocabulary.md).

---

## Briefs NIB

Ces documents sont normatifs pour construction RED/GREEN.

- [`briefs/stage-harness/`](./briefs/stage-harness/) - Harness standalone pour
  exécuter un stage et produire un `StageOutput` canonique.

---

## ADR actifs

- [`ARD-go-stage-harness-v1-non-goals.md`](./ard/ARD-go-stage-harness-v1-non-goals.md)
  - Non-goals v1 du stage harness.
- [`ARD-go-stages-vs-turnlock-phases.md`](./ard/ARD-go-stages-vs-turnlock-phases.md)
  - Séparation stage, phase Turnlock, délégation, stage harness.
- [`ARD-go-physical-worktree-isolation.md`](./ard/ARD-go-physical-worktree-isolation.md)
  - Worktree Git physique privé par run `/go`.
- [`ARD-go-review-before-packaging-with-package-verify.md`](./ard/ARD-go-review-before-packaging-with-package-verify.md)
  - Review globale avant packaging, avec vérification obligatoire du split.
- [`ARD-go-stage-output-envelope-and-typed-business-artifacts.md`](./ard/ARD-go-stage-output-envelope-and-typed-business-artifacts.md)
  - `StageOutput` comme enveloppe d'exécution, payloads riches en artefacts
    métier typés.

---

## Working actifs

Ces documents sont les specs de conception en cours. Ils seront promus en NIB
quand leur niveau de détail sera suffisant pour construction.

### Pipeline

- [`canonical-vocabulary.md`](./working/pipeline/canonical-vocabulary.md)
  - Vocabulaire canonique.
- [`go-pipeline-contract.md`](./working/pipeline/go-pipeline-contract.md)
  - Contrat central du pipeline.
- [`software-design-workflow.md`](./working/pipeline/software-design-workflow.md)
  - Cycle complet `/go`.
- [`multi-agent-concurrency.md`](./working/pipeline/multi-agent-concurrency.md)
  - Concurrence multi-run et worktrees physiques.

### Artefacts

- [`pipeline-artifacts.md`](./working/artifacts/pipeline-artifacts.md)
  - Types JSON partagés du pipeline, dont artefacts métier typés.

### Stages

- [`workspace-setup.md`](./working/stages/workspace-setup.md)
  - Création du worktree physique et `WorkSession`.
- [`project-discovery.md`](./working/stages/project-discovery.md)
  - Détection des commandes et capacités du repo.
- [`implementation.md`](./working/stages/implementation.md)
  - Délégation agentique d'implémentation.
- [`agent-conduct-check.md`](./working/stages/agent-conduct-check.md)
  - Gate `conduct-settled`.
- [`mechanical-gates.md`](./working/stages/mechanical-gates.md)
  - Format, lint, typecheck, tests, build, scans.
- [`review-remediation.md`](./working/stages/review-remediation.md)
  - HumanGate, remediation, dismiss, defer, abort.
- [`package-and-publish.md`](./working/stages/package-and-publish.md)
  - `package-plan`, `package-verify`, branches, commits, PRs.
- [`pr-ci-review.md`](./working/stages/pr-ci-review.md)
  - Gate CI autoritative.

### Review

- [`ideal-review.md`](./working/review/ideal-review.md)
  - Dimensions, sévérités, preuves, boucle de remediation.

---

## Legacy

- [`legacy/`](./legacy/) - Anciens documents historiques.
- [`legacy/working-pre-semantic-turnlock-split/`](./legacy/working-pre-semantic-turnlock-split/)
  - Ancienne génération des fichiers `working/`, archivée avant adoption du
    vocabulaire stage / phase Turnlock.

---

VegaCorp - `/go` Pipeline - "Reliability precedes intelligence."
