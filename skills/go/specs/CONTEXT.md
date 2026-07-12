# `/go` Pipeline — Specs

## Briefs (NIB-compliant, pour agents)

Ces documents suivent la méthodologie NIB (NX-CONCEPT → NIB-S → NIB-M). Ce sont
les sources de vérité pour l'implémentation.

- [`briefs/phase-harness/`](./briefs/phase-harness/) - Harness standalone pour
  l'execution d'une phase: NX-CONCEPT + NIB-S + 7 NIB-M + NIB-T + DC.

## ARD (Architecture Decision Records)

Décisions d'architecture documentées avec leur contexte, leur raison et leur
trajectoire.

- [ARD phase-harness non-goals][ard-phase-harness-non-goals] - pourquoi les 8
  non-goals du section 12 du NIB-S sont hors scope v1.

## Working (docs de conception, futurs briefs)

Ces documents sont en cours de formalisation. Ils seront promus en briefs quand
ils atteindront le niveau de détail requis.

### Pipeline (architecture)

- [Pipeline contract][pipeline-contract] - contrat central: invariants,
  severites, phases, regles de terminaison.
- [Software design workflow][software-design-workflow] - philosophie: pipeline
  deterministe + agent non-deterministe.
- [Multi-agent concurrency][multi-agent-concurrency] - sessions paralleles sur
  le meme repo.

### Phases

- [`working/phases/workspace-setup.md`](./working/phases/workspace-setup.md) -
  `workspace-setup`.
- [Agent conduct check][agent-conduct-check] - `agent-conduct-check`.
- [`working/phases/commit-push-pr.md`](./working/phases/commit-push-pr.md) -
  `commit-push-pr`.
- [`working/phases/pr-ci-review.md`](./working/phases/pr-ci-review.md) -
  `pr-ci-review`.

### Review

- [`working/review/ideal-review.md`](./working/review/ideal-review.md) - les 13
  dimensions non-negociables d'une review.

### Artefacts

- [Pipeline artifacts][pipeline-artifacts] - types JSON partages:
  `PipelineState`, `CheckRun`, `ReviewFinding`, etc.

## Legacy

- [`legacy/`](./legacy/) - Versions precedentes conservees pour verifier
  qu'aucune information n'a ete perdue.

[agent-conduct-check]: ./working/phases/agent-conduct-check.md
[ard-phase-harness-non-goals]: ./ard/ARD-go-phase-harness-v1-non-goals.md
[multi-agent-concurrency]: ./working/pipeline/multi-agent-concurrency.md
[pipeline-artifacts]: ./working/artifacts/pipeline-artifacts.md
[pipeline-contract]: ./working/pipeline/go-pipeline-contract.md
[software-design-workflow]: ./working/pipeline/software-design-workflow.md
