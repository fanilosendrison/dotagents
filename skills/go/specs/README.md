# `/go` Pipeline — Specs

## Pipeline system

| Document | Contenu |
|----------|---------|
| [`go-pipeline-contract.md`](./go-pipeline-contract.md) | Contrat central : invariants, sévérités, phases, règles de terminaison et de preuve |
| [`software-design-workflow.md`](./software-design-workflow.md) | Philosophie : pipeline déterministe + agent non-déterministe, cycle de vie |
| [`multi-agent-concurrency.md`](./multi-agent-concurrency.md) | Sessions parallèles sur le même repo |

## Artefacts partagés

| Document | Contenu |
|----------|---------|
| [`pipeline-artifacts.md`](./pipeline-artifacts.md) | Types : `PipelineState`, `CheckRun`, `ReviewFinding`, `WorkSession`, etc. |

## Phases

| Document | Phase |
|----------|-------|
| [`workspace-setup.md`](./workspace-setup.md) | `workspace-setup` — initialisation du worktree |
| [`agent-conduct-check.md`](./agent-conduct-check.md) | `agent-conduct-check` — traces process de l'agent |
| [`commit-push-pr.md`](./commit-push-pr.md) | `commit-push-pr` — découpage Git, branches, PRs |
| [`pr-ci-review.md`](./pr-ci-review.md) | `pr-ci-review` — gate CI autoritative de merge |
| `implementation` | (dans go-pipeline-contract.md — spec détaillée à venir) |
| `lint` | (dans go-pipeline-contract.md — spec détaillée à venir) |
| `typecheck` | (dans go-pipeline-contract.md — spec détaillée à venir) |
| `tests` | (dans go-pipeline-contract.md — spec détaillée à venir) |
| `pre-pr-review` | (dans go-pipeline-contract.md — spec détaillée à venir) |
| `review-remediation` | (dans go-pipeline-contract.md — gate humaine) |

## Review

| Document | Contenu |
|----------|---------|
| [`ideal-review.md`](./ideal-review.md) | Les 13 dimensions non-négociables d'une review |

## Phase harness

| Document | Contenu |
|----------|---------|
| [`phase-harness/`](./phase-harness/) | Harness standalone pour l'exécution d'une phase (spec NIB : NX-CONCEPT + NIB-S + NIB-M) |

## Archives

| Document | Contenu |
|----------|---------|
| [`legacy/`](./legacy/) | Versions précédentes des documents — conservées pour vérifier qu'aucune information n'a été perdue lors de la réorganisation |
