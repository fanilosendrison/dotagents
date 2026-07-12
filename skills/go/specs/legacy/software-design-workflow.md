# Software Design Workflow — Pipeline déterministe + Agent non-déterministe

## Principe fondamental

Un changement logiciel traverse un cycle de vie en deux couches distinctes :

| Couche | Nature | Qui décide | Régime |
|--------|--------|-----------|--------|
| **Pipeline** (FSM Turnlock) | Déterministe, mécanique | La machine | Check → décision binaire → delegate → recheck |
| **Agent** (spawné par le bridge) | Non-déterministe, créatif | L'IA | Explore, expérimente, itère jusqu'à ce que ça passe |

Le pipeline orchestre. L'agent crée. L'un est une horloge, l'autre un artiste.

---

## Pourquoi cette séparation

### Le pipeline doit être déterministe

| Propriété | Si le pipeline était non-déterministe |
|-----------|--------------------------------------|
| Reproductibilité | Le même code donnerait des résultats différents d'une exécution à l'autre |
| Prédictibilité | Impossible de savoir combien de temps une étape prendra, ni si elle aboutira |
| Confiance | On ne peut pas garantir que tout ce qui devait être vérifié l'a été |
| Audit trail | Le `state.json` perd sa valeur : deux runs identiques divergent |

Les décisions du pipeline sont mécaniques et sans ambiguïté :

- `biome lint` retourne 3 erreurs → pas clean → on délègue
- Budget restant pour `lint_rule` : 1/2 → on retry
- Même hash que le check précédent → loop → on abandonne
- Budget épuisé + fallback dispo → on escalade

Aucune de ces décisions ne nécessite de jugement humain ou d'IA. Ce sont des
branches conditionnelles sur des résultats mesurables.

### L'agent doit être non-déterministe

| Propriété | Si l'agent était déterministe |
|-----------|------------------------------|
| Cas ambigus | Incapable de choisir entre plusieurs corrections valides |
| Contexte | Incapable de comprendre l'intention derrière le code |
| Créativité | Incapable de refactorer plutôt que d'appliquer un fix mécanique |

L'agent reçoit une contrainte de sortie (« plus aucune erreur biome ») et
dispose d'une liberté totale sur le chemin pour y arriver. Il peut :

- Lire plusieurs fichiers pour comprendre le contexte
- Éditer, compiler, tester, itérer
- Choisir entre supprimer un import ou réorganiser le code
- Décider qu'un refactoring est plus propre qu'un fix ponctuel

---

## Le cycle de vie complet d'un `/go`

```
/go
  │
  ├── 1. Workspace Setup       (FSM Turnlock, déterministe)
  │       │                     Fige le point de départ : repo,
  │       │                     branche, HEAD, état dirty, branche
  │       │                     cible, puis crée work/<run-id>.
  │       │
  ├── 2. Implémentation        (agent principal, modèle courant)
  │       │                     L'agent explore, expérimente, teste,
  │       │                     et produit un diff brut sur
  │       │                     work/<run-id>.
  │       │
  ├── 3. Agent Conduct Check   (FSM Turnlock, déterministe)
  │       │                     Vérifie les traces hors diff : secrets,
  │       │                     fichiers temporaires, permissions,
  │       │                     commandes dangereuses.
  │       │
  ├── 4. Lint qualité          (FSM Turnlock, biome)
  │       │                     Check déterministe. Si échec →
  │       │                     agent dédié corrige, puis recheck.
  │       │
  ├── 5. Typecheck             (FSM Turnlock, tsc --noEmit)
  │       │                     Types incorrects → agent corrige,
  │       │                     puis recheck.
  │       │
  ├── 6. Tests                 (FSM Turnlock, bun test / pytest / ...)
  │       │                     Tests cassés → agent corrige
  │       │                     le code ou les tests, puis recheck.
  │       │
  ├── 7. Pre-PR Review         (FSM Turnlock, hybride outils + LLM)
  │       │                     Vérifie les 13 dimensions de
  │       │                     `ideal-review.md` et produit des
  │       │                     findings JSON structurés.
  │       │
  │       ├── Aucun Bloquant ni Majeur bloquant ouvert
  │       │       → transition → commit-push-pr
  │       │
  │       └── Remediation approuvée par l'humain ou la policy
  │               → agent applique le batch approuvé
  │               → retour à agent-conduct-check
  │               → conduct → lint → typecheck → tests → pre-pr-review
  │
  ├── 8. Commit + Push + PR    (FSM Turnlock)
  │       │                     Découpe le diff en paquets, crée les
  │       │                     branches, commit, push, ouvre les PRs.
  │       │
  └── 9. PR CI Review          (GitHub Actions + Turnlock)
          │                     Rejoue les gates sur le diff poussé.
          │                     C'est la gate autoritative de merge.
```

### Pourquoi cet ordre : du plus mécanique au plus humain

```
Workspace ──► Impl ──► Conduct ──► Lint ──► Typecheck ──► Tests ──► Review ──► PRs ──► CI
    │           │          │          │          │           │         │        │       │
    │           │          │          │          │           │         │        │       └── Gate merge
    │           │          │          │          │           │         │        └── Packaging Git
    │           │          │          │          │           │         └── Jugement senior + preuves
    │           │          │          │          │           └── Runtime, le plus cher
    │           │          │          │          └── Structure, dépend du lint
    │           │          │          └── Surface, le plus rapide
    │           │          └── Traces hors diff, secrets, permissions
    │           └── Création du diff brut sur work/<run-id>
    └── Base snapshot et branche de travail
```

**Workspace Setup d'abord** — avant toute modification, le pipeline enregistre
le repo, la branche, le `HEAD`, l'état dirty, la branche cible, puis crée
`work/<run-id>`. C'est le socle de preuve : sans base figée, le diff final n'a
pas de frontière fiable.

**Agent Conduct Check juste après l'implémentation** — cette gate ne regarde pas
seulement le diff final. Elle inspecte les traces que l'agent peut laisser
pendant le travail : secrets dans l'historique, fichiers temporaires, commandes
dangereuses, permissions, ports debug, état git risqué. Si cette étape échoue,
le diff peut être parfait et rester inacceptable.

**Lint avant les checks lourds** — secondes, pas de dépendances, parse chaque
fichier isolément. Si le code a des imports inutilisés, aucun intérêt à lancer le
typecheck. Le lint est le filtre le moins cher sur le code produit, il élimine le
bruit de surface.

**Typecheck ensuite** — secondes, dépend du lint (fichiers parseables). `tsc` a
besoin que les fichiers soient syntaxiquement valides. Si le typecheck échoue,
les tests ne peuvent même pas compiler.

**Tests après** — minutes, dépend du typecheck (code compilable). C'est le check
le plus cher. Le lancer avant d'avoir vérifié lint et typecheck, c'est gaspiller
du temps de compute sur du code qui ne compile pas.

**Pre-PR Review avant commit** — minutes, dépend des tests (comportement
validé). Le reviewer ne doit pas perdre son temps à pointer des imports inutilisés
ou des types cassés — les phases précédentes les ont déjà éliminés. Il se
concentre sur ce que les machines ne savent pas juger : architecture, sécurité,
maintenabilité, invariants produit, et artefacts typiques du code généré par IA.

**PR CI Review après push** — elle ne remplace pas la review locale. Elle rejoue
les gates sur le diff réellement poussé et dans l'environnement CI. Son rôle est
de protéger la branche cible contre un drift entre workspace local, branches
empilées, lockfiles, secrets CI, et configuration GitHub.

### La boucle interne de la review

La review n'est pas une étape linéaire. Si une remediation est approuvée,
l'agent modifie les fichiers → mécaniquement, c'est aussi sale que la sortie de
l'implémentation → tout le pipeline mécanique doit être re-vérifié, y compris
`agent-conduct-check`.

Un LLM reviewer trouvera **toujours** quelque chose à redire. Viser 0 remarque,
c'est une boucle infinie garantie. La solution : distinguer les findings
probatoires qui bloquent réellement le pipeline des préférences et améliorations
non bloquantes.

```
review → findings classés par sévérité
  │
  ├── Bloquant : bug, faille, corruption, régression,
  │              breaking change non documenté, échec mécanique
  │     → Correction obligatoire, dismissal justifié, ou abort
  │     → Re-run conduct → lint → typecheck → tests → pre-pr-review
  │
  ├── Majeur : risque significatif
  │     → Bloque seulement si blocksPipeline=true
  │     → Sinon gate humaine ou backlog prioritaire
  │
  ├── Mineur : amélioration utile mais non bloquante
  │     → Backlog, ne bloque pas le pipeline
  │
  └── Suggestion : préférence ou alternative équivalente
        → Jamais bloquante
```

La boucle s'arrête quand il n'y a plus de `Bloquant` ouvert ni de `Majeur` avec
`blocksPipeline: true`. Elle ne s'arrête pas quand le reviewer n'a plus aucune
suggestion : ce critère serait infini.

```
/go
  │
  ├── implémentation
  │
  ├── conduct ✓ → lint ✓ → typecheck ✓ → tests ✓
  │
  ├── review → 1 Bloquant, 2 Majeur bloquants, 4 Mineur
  │   │
  │   ├── humain approuve le batch de remediation
  │   │   └── agent corrige
  │   │       └── conduct ✓ → lint ✓ → typecheck ✓ → tests ✓
  │   │           └── review → 0 Bloquant, 0 Majeur bloquant, 3 Mineur
  │   │               └── → transition commit-push-pr
  │   │               ┌──── Backlog ────────────────────┐
  │   │               │ src/a.ts:42  Use interface       │
  │   │               │ src/b.ts:10  Consider memoizing  │
  │   │               │ src/c.ts:5   Extract constant    │
  │   │               │                                   │
  │   │               │ Gardé pour la prochaine session    │
  │   │               └───────────────────────────────────┘
  │   │
  ├── commit-push-pr
  │
  └── pr-ci-review
```

Pourquoi re-run **complet** (conduct + lint + typecheck + tests) plutôt que
juste relint ?

- **Déterministe** : pas de décision sur « est-ce que ce fix mérite un retypecheck ? »
- **Simple** : une seule boucle, pas des branches conditionnelles par type de modification
- **Coût marginal** : lint + typecheck = ~10 secondes, rien comparé à la review qui dure plusieurs minutes
- **Sécurité** : un fix de review peut casser les types, les tests, ou laisser une trace agent dangereuse.

Cette boucle est **bornée par conception** : on itère sur les findings réellement
bloquants, pas sur l'appétit infini du reviewer.

---

## Propriétés invariantes de chaque étape du pipeline

Quelle que soit l'étape, le pattern est identique :

| Propriété | Description |
|-----------|-------------|
| Un check à passer | Commande déterministe (biome, tsc, test runner, review prompt…) |
| Si échec → déléguer la correction | Agent dédié avec le modèle adapté à l'étape |
| Retry avec feedback | L'historique des échecs précédents est fourni à l'agent |
| Fallback model | Si l'agent principal échoue, escalade vers un modèle plus capable |
| Loop detection | Même résultat après correction → abandon |
| Statut de phase canonique | `PhaseOutput.status` : `passed`, `failed`, `skipped`, ou `errored` |
| Artefact JSON | `artefactDir/output.json` validé par `phase-contract.md`; `state.json` n'en garde qu'une référence ou une projection |
| Si FAIL → notifier l'humain | Jamais d'abandon silencieux |

---

## Ce qui change entre les étapes

| | Workspace | Conduct | Lint | Typecheck | Tests | Pre-PR Review |
|---|---|---|---|---|---|---|
| Check | Base + dirty + work branch | Traces hors diff | `biome lint` | `tsc --noEmit` | `bun test` | 13 dimensions |
| Modèle principal | Déterministe | Déterministe | Haiku | Haiku | Sonnet | Sonnet / agents spécialisés |
| Modèle fallback | Humain si dirty | Sonnet si remediation | Sonnet | Sonnet | Opus/GPT-4 | Humain / modèle senior |
| Budget retry | 0 | 1 + cleanup | 2 + fallback | 2 + fallback | 2 + fallback | Batches approuvés |
| Applique les corrections ? | Crée `work/<run-id>` | Oui, cleanup ciblé | Oui | Oui | Oui | Seulement si approuvé |
| Bloque le pipeline ? | Oui | Oui | Oui | Oui | Oui | Oui si finding bloquant |
| Décision humaine ? | Si dirty | Seulement exception | Non | Non | Non | Oui pour remediation/dismissal |

---

## Infrastructure commune

Toutes les étapes partagent la même infrastructure décrite dans
`phase-contract.md` : une fonction de phase standalone, exécutée par `runPhase`,
qui produit un `PhaseOutput` canonique. Turnlock n'est qu'un wrapper
d'orchestration autour de cette fonction.

Toutes les phases ne sont pas des FSMs imbriquées — seules celles qui nécessitent
un cycle check/fix/retry.

### Deux types de phases

| Type | Exemples | Wrapper Turnlock |
|------|----------|-------------------|
| **Délégation simple** | Implémentation | `io.delegate("agent", { prompt })` — spawn l'agent, attend, transition. Pas de check autoritatif dans cette phase. |
| **FSM imbriquée** | Workspace, Conduct, Lint, Typecheck, Tests, Review, Commit/Push/PR, CI Review | Check → retry → fallback → loop → recheck. La FSM fille a sa propre boucle et son propre budget. |

Dans les deux cas, le wrapper Turnlock consomme le `PhaseOutput` produit par le
harness. Les transitions `DONE`, `FAIL`, `REMEDIATE`, ou `MERGEABLE` sont des
états d'orchestration dérivés du statut canonique de phase, pas des statuts
retournés par la phase elle-même.

```
┌──────────────────────────────────────────────────────────┐
│ Super FSM : /go pipeline (Turnlock)                       │
│                                                          │
│  phase:workspace-setup ─────────────────────────┐        │
│    │  record base → create work/<run-id>        │ FSM fille│
│    └── PhaseOutput → transition/fail            │        │
│                                            └────┘        │
│  phase:implementation ─────────────────────────┐         │
│    │  delegate("agent", { prompt: "implémente" })│ simple │
│    └── PhaseOutput → transition                │         │
│                                           └────┘         │
│  phase:agent-conduct-check ────────────────────┐         │
│    │  inspect traces → cleanup/remediate       │ FSM fille│
│    └── PhaseOutput → transition/fail           │         │
│                                           └────┘         │
│  phase:lint ───────────────────────────────────┐         │
│    │  check → retry → fallback → recheck       │ FSM fille│
│    └── PhaseOutput → transition/fail           │         │
│                                           └────┘         │
│  phase:typecheck ──────────────────────────────┐         │
│    │  check → retry → fallback → recheck       │ FSM fille│
│    └── PhaseOutput → transition/fail           │         │
│                                           └────┘         │
│  phase:tests ──────────────────────────────────┐         │
│    │  check → retry → fallback → recheck       │ FSM fille│
│    └── PhaseOutput → transition/fail           │         │
│                                           └────┘         │
│  phase:pre-pr-review ──────────────────────────┐         │
│    │  tools + agents → findings → human gate   │ FSM fille│
│    └── PhaseOutput → transition/remediate/fail │         │
│                                           └────┘         │
│  phase:commit-push-pr ─────────────────────────┐         │
│    │  package diff → branches → commits → PRs  │ FSM fille│
│    └── PhaseOutput → transition/fail           │         │
│                                           └────┘         │
│  phase:pr-ci-review ───────────────────────────┐         │
│    │  CI gates + review on pushed diff         │ FSM fille│
│    └── PhaseOutput → mergeable/fail            │         │
│                                           └────┘         │
└──────────────────────────────────────────────────────────┘
```

### Pourquoi repasser derrière l'agent d'implémentation

L'agent d'implémentation **peut** déjà faire du lint, des tests, etc. en interne.
Les modèles les plus performants le font spontanément. Mais :

- Il peut oublier (l'IA n'est pas déterministe)
- Il peut ne pas avoir les bons outils (pas de biome, pas de tsc)
- Il peut prioriser la fonctionnalité sur la qualité
- Même s'il le fait, rien ne garantit qu'il l'a fait **avec les bonnes règles**

Les phases post-implémentation sont des **barrières d'enforcement**. Elles ne font
pas confiance à ce que l'agent a fait en interne. Elles vérifient quoi qu'il arrive,
de manière déterministe, avec le même outil et les mêmes règles, sans exception.

C'est le principe de **défense en profondeur** : l'agent fait ce qu'il peut, le
pipeline garantit ce qui doit être.

### Pourquoi une FSM maîtresse plutôt qu'un séquenceur dans le harness hôte

| | Séquenceur dans le harness | FSM maîtresse Turnlock |
|---|---|---|
| Portabilité (Pi, Codex, Claude Code) | Spécifique à un hôte | Le bridge lit juste des blocs TURNLOCK |
| State persistant | Fragmenté par FSM individuelle | Centralisé, la FSM maîtresse sait où elle en est |
| Reprise après crash | Chaque FSM indépendante, le séquenceur peut perdre sa place | La FSM maîtresse reprend exactement à la phase interrompue |
| Audit trail | Fragmenté | Unifié dans un seul `state.json` |
| Ajouter une étape | Modifier le code du harness | Ajouter une phase à la config de la FSM maîtresse |
| Le grain de l'orchestration | Dans du code applicatif non-déterministe | Dans une FSM, au même niveau d'abstraction que les étapes |

Le harness hôte ne fait que **lancer** la FSM maîtresse, **relayer** les blocs
TURNLOCK, et **afficher** l'état à l'utilisateur. L'orchestration — le
séquencement, les transitions, les décisions — est entièrement dans Turnlock,
déterministe et persistante.

### Le pont entre les deux niveaux

```
┌─────────────────────────────────────────┐
│ Agent Bridge (générique, commun)         │
│                                          │
│  Lit les blocs TURNLOCK sur stdin.       │
│  Ne sait pas si c'est une FSM maîtresse  │
│  ou une FSM fille.                       │
│                                          │
│  Pour chaque DELEGATE :                  │
│    → spawn l'agent demandé               │
│    → écrit result.json                   │
│    → resume l'orchestrateur              │
│                                          │
│  Quand un sous-orchestrateur émet DONE,  │
│  le bridge resume l'orchestrateur parent │
│  avec --resume.                          │
└─────────────────────────────────────────┘
```

Le bridge est **aveugle à la hiérarchie**. Il traite tous les blocs TURNLOCK de
la même manière, qu'ils viennent de la FSM maîtresse ou d'une FSM fille. C'est
cette indifférence qui rend le système extensible : ajouter une étape au pipeline
ne nécessite aucun changement dans le bridge.

---

## Références

- [Post-Write Linter v2 Spec](../.agents/specs/post-write-linter-v2.md) — première implémentation de ce pattern (lint qualité)
- [Turnlock](../Developper/Projects/VegaCorp/turnlock/AGENTS.md) — runtime de FSM persistante
- [git-commits-push](../.agents/skills/git-commits-push/AGENTS.md) — implémentation existante des patterns retry/fallback/loop
- [Go Pipeline Contract](./go-pipeline-contract.md) — contrat central des phases, artefacts JSON, gates, et sévérités
