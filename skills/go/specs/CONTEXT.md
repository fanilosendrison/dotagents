# `/go` Pipeline — Specs

## Briefs (NIB-compliant, pour agents)

Ces documents suivent la méthodologie NIB (NX-CONCEPT → NIB-S → NIB-M). Ce sont les sources de vérité pour l'implémentation.

| Document | Contenu |
|----------|---------|
| [`briefs/phase-harness/`](./briefs/phase-harness/) | Harness standalone pour l'exécution d'une phase (NX-CONCEPT + NIB-S + 7 NIB-M) |

## Working (docs de conception, futurs briefs)

Ces documents sont en cours de formalisation. Ils seront promus en briefs quand ils atteindront le niveau de détail requis.

### Pipeline (architecture)

| Document | Contenu |
|----------|---------|
| [`working/pipeline/go-pipeline-contract.md`](./working/pipeline/go-pipeline-contract.md) | Contrat central : invariants, sévérités, phases, règles de terminaison |
| [`working/pipeline/software-design-workflow.md`](./working/pipeline/software-design-workflow.md) | Philosophie : pipeline déterministe + agent non-déterministe |
| [`working/pipeline/multi-agent-concurrency.md`](./working/pipeline/multi-agent-concurrency.md) | Sessions parallèles sur le même repo |

### Phases

| Document | Phase |
|----------|-------|
| [`working/phases/workspace-setup.md`](./working/phases/workspace-setup.md) | `workspace-setup` |
| [`working/phases/agent-conduct-check.md`](./working/phases/agent-conduct-check.md) | `agent-conduct-check` |
| [`working/phases/commit-push-pr.md`](./working/phases/commit-push-pr.md) | `commit-push-pr` |
| [`working/phases/pr-ci-review.md`](./working/phases/pr-ci-review.md) | `pr-ci-review` |

### Review

| Document | Contenu |
|----------|---------|
| [`working/review/ideal-review.md`](./working/review/ideal-review.md) | Les 13 dimensions non-négociables d'une review |

### Artefacts

| Document | Contenu |
|----------|---------|
| [`working/artifacts/pipeline-artifacts.md`](./working/artifacts/pipeline-artifacts.md) | Types JSON partagés : `PipelineState`, `CheckRun`, `ReviewFinding`, etc. |

## Legacy

| Document | Contenu |
|----------|---------|
| [`legacy/`](./legacy/) | Versions précédentes — conservées pour vérifier qu'aucune information n'a été perdue |
