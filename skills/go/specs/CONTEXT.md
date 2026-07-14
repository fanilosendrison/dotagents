# `/go` Workflow - Specs

Ce dossier contient les specs du workflow `/go`.

Les documents actifs distinguent maintenant :

- **stage** : étape métier du workflow ;
- **bootstrap task** : travail d'amorcage du run, hors stages métier ;
- **phase Turnlock** : unité atomique, persistée et reprenable ;
- **délégation** : travail agentique non déterministe encadré ;
- **stage harness** : contrat `StageInput -> StageOutput` ;
- **artefact métier typé** : payload JSON durable validé avant projection dans
  `WorkflowState`.

Voir [`working/standards/canonical-vocabulary.md`](./working/standards/canonical-vocabulary.md).

---

## Briefs NIB

Ces documents sont normatifs pour construction RED/GREEN.

- [`briefs/stage-harness/`](./briefs/stage-harness/) - Harness standalone pour
  exécuter un stage et produire un `StageOutput` canonique.

---

## ADR actifs

- [`ADR-go-workflow-vocabulary.md`](./adr/ADR-go-workflow-vocabulary.md)
  - Vocabulaire canonique : stage, bootstrap task, phase Turnlock, délégation.
- [`ADR-go-stages-vs-turnlock-phases.md`](./adr/ADR-go-stages-vs-turnlock-phases.md)
  - Séparation stage, phase Turnlock, délégation, stage harness.
- [`ADR-go-stage-harness-v1-non-goals.md`](./adr/ADR-go-stage-harness-v1-non-goals.md)
  - Non-goals v1 du stage harness.
- [`ADR-go-stage-output-envelope-and-typed-business-artifacts.md`](./adr/ADR-go-stage-output-envelope-and-typed-business-artifacts.md)
  - `StageOutput` comme enveloppe d'exécution, payloads riches en artefacts
    métier typés.
- [`ADR-go-physical-worktree-isolation.md`](./adr/ADR-go-physical-worktree-isolation.md)
  - Worktree Git physique privé par run `/go`.
- [`ADR-go-token-propagation-git-askpass.md`](./adr/ADR-go-token-propagation-git-askpass.md)
  - Propagation des tokens Git via `GIT_ASKPASS`.
- [`ADR-go-mandatory-provider-config-fail-fast.md`](./adr/ADR-go-mandatory-provider-config-fail-fast.md)
  - Validation `ProviderConfig` en première position, fail-fast.
- [`ADR-go-implicit-repo-capture-control.md`](./adr/ADR-go-implicit-repo-capture-control.md)
  - Résolution implicite du dépôt cible depuis le terminal (pas de magie IDE).
- [`ADR-go-repo-capture-robustness.md`](./adr/ADR-go-repo-capture-robustness.md)
  - Robustesse de la détection : `.git` fichier, rejet Bare, garde-fou
    système, gateway par composant exact.
- [`ADR-go-workspace-setup-skip-setup.md`](./adr/ADR-go-workspace-setup-skip-setup.md)
  - Paramètre `skipSetup` pour la reprise sans reconstruction du worktree.
- [`ADR-go-review-before-packaging-with-package-verify.md`](./adr/ADR-go-review-before-packaging-with-package-verify.md)
  - Review globale avant packaging, avec vérification obligatoire du split.
- [`ADR-go-workspace-agnostic-terminology.md`](./adr/ADR-go-workspace-agnostic-terminology.md)
  - Terminologie agnostique du workspace : découplage vocabulaire vs mécanisme
    worktree, préparation à la swapabilité sandbox.

---

## Working actifs

Ces documents sont les specs de conception en cours. Ils seront promus en NIB
quand leur niveau de détail sera suffisant pour construction.

### Standards

- [`canonical-vocabulary.md`](./working/standards/canonical-vocabulary.md)
  - Vocabulaire canonique.
- [`canonical-hashing.md`](./working/standards/canonical-hashing.md)
  - Profil RFC 8785 / JCS pour les hashes JSON metier.
- [`external-primitives.md`](./working/standards/external-primitives.md)
  - Standards, formats et outils a reutiliser au lieu de primitives maison.
- [`software-design-workflow.md`](./working/standards/software-design-workflow.md)
  - Cycle complet `/go`.
- [`multi-agent-concurrency.md`](./working/standards/multi-agent-concurrency.md)
  - Concurrence multi-run et worktrees physiques.

### Contrats

- [`go-workflow-contract.md`](./working/contracts/go-workflow-contract.md)
  - Contrat central du workflow.
- [`workflow-artifacts.md`](./working/contracts/workflow-artifacts.md)
  - Types JSON partagés du workflow, dont artefacts métier typés.

### Phase `run-init`

- [`run-init.md`](./working/run-init/run-init.md)
  - Phase Turnlock de bootstrap : bootstrap tasks, joins et projection fail-closed.
- [`repo-capture.md`](./working/run-init/repo-capture.md)
  - Resolution mecanique du repo cible depuis le CWD.
- [`dirty-state-capture.md`](./working/run-init/dirty-state-capture.md)
  - Capture du dirty state host-side avant création du workspace.
- [`run-capture.md`](./working/run-init/run-capture.md)
  - Capture du prompt `/go`, extrait de session et hashes.
- [`workspace-setup.md`](./working/run-init/workspace-setup.md)
  - Contrat commun du workspace et `WorkSession`.
- [`workspace-setup.worktree.md`](./working/run-init/workspace-setup.worktree.md)
  - Stratégie Git Worktree : pipeline `git worktree add`.
- [`repo-discovery-draft.md`](./working/run-init/repo-discovery-draft.md)
  - Discovery repo non autoritative depuis le checkout source.
- [`project-discovery-finalize.md`](./working/run-init/project-discovery-finalize.md)
  - Finalisation de la discovery repo contre le worktree prive.

### Stages

- [`implementation.md`](./working/stages/implementation.md)
  - Délégation agentique d'implémentation.
- [`agent-conduct-check.md`](./working/stages/agent-conduct-check.md)
  - Gate `conduct-settled`.
- [`mechanical-gates.md`](./working/stages/mechanical-gates.md)
  - Format, lint, typecheck, tests, build, scans.
- [`review-remediation.md`](./working/stages/review-remediation.md)
  - HumanGate, remediation, dismiss, defer, abort.
- [`ideal-review.md`](./working/stages/ideal-review.md)
  - Dimensions, sévérités, preuves, boucle de remediation.
- [`pr-ci-review.md`](./working/stages/pr-ci-review.md)
  - Gate CI autoritative sur la PR publiee.
- [`package-and-publish.md`](./working/stages/package-and-publish.md)
  - `package-plan`, `package-verify`, branches, commits, PRs.

---

## Legacy

- [`legacy/`](./legacy/) - Anciens documents historiques.
- [`legacy/working-pre-semantic-turnlock-split/`](./legacy/working-pre-semantic-turnlock-split/)
  - Ancienne génération des fichiers `working/`, archivée avant adoption du
    vocabulaire stage / phase Turnlock.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
