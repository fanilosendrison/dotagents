---
id: ADR-GO-RUN-INIT-EARLY-PARALLEL-BRANCHES
type: ard
version: "1.0.0"
scope: go-workflow/run-init
status: active
supersedes: []
superseded_by: []
---

# ADR — Démarrage anticipé des branches parallèles dans `run-init`

VegaCorp - July 2026

---

## Contexte

La phase `run-init` comporte sept bootstrap tasks, dont trois s'exécutent en
parallèle : `run-capture`, `workspace-setup` et `repo-discovery-draft`.
Jusqu'ici, ces trois branches étaient toutes bloquées derrière
`dirty-state-capture` — le graphe les plaçait comme enfants de cette tâche :

```text
repo-capture
     ↓
dirty-state-capture ──┬── run-capture
                      ├── workspace-setup
                      └── repo-discovery-draft
```

Or, l'analyse des dépendances réelles montre que seules `workspace-setup`
dépend de `dirty-state-capture` (elle consomme le `DirtyStateDiffArtifact`
pour le replay du patch). Ni `run-capture` ni `repo-discovery-draft`
n'ont besoin de cette tâche :

| Tâche | Dépend de `dirty-state-capture` ? | Preuve |
|---|---|---|
| `workspace-setup` | Oui — replay du patch dirty | Consomme `DirtyStateDiffArtifact` |
| `run-capture` | Non | §6.1 de sa spec : « ne lit pas le worktree et ne dépend pas de `RepoCapture` » ; inputs = `runId`, `artefactRoot`, `CaptureContext` |
| `repo-discovery-draft` | Non | §2 de sa spec : « lit uniquement le dépôt source d'origine » ; §3 inputs = `runId`, source repo, `artefactRoot`, `WorkflowPolicy.discovery` |

Le blocage actuel derrière `dirty-state-capture` est un point de synchronisation
artificiel pour deux branches qui pourraient avancer plus tôt.

La raison historique est un choix de simplicité : regrouper le lancement des
trois branches après un point unique facilite la lecture du graphe. Mais cette
simplicité a un coût : elle masque les vraies dépendances et retarde
inutilement deux opérations I/O-bound (scan en lecture seule du dépôt source et
capture des preuves de session).

Le principe directeur est : **chaque tâche doit démarrer dès que toutes ses
dépendances sont satisfaites**. Le graphe d'exécution doit refléter les
dépendances réelles, pas les regrouper artificiellement.

---

## Décision

### 1. Nouveau graphe d'exécution

`run-capture` et `repo-discovery-draft` démarrent immédiatement après
`repo-capture`, en parallèle avec `dirty-state-capture`. `workspace-setup`
reste chaînée derrière `dirty-state-capture` :

```text
run-init
│
├─ prerequisite-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       │
│       ├─ dirty-state-capture (séquentiel, host-side only)
│       │       │
│       │       └─ workspace-setup ──────────────────┐
│       │                                             │
│       ├─ run-capture ───────────────────────────┐   │
│       │                                          │   │
│       └─ repo-discovery-draft ──┐                │   │
│                  │               │                │   │
│                  └───────┬───────┤                │   │
│                          ↓       ↓                │   │
│              project-discovery-finalize           │   │
│                          │                        │   │
│                          ↓                        │   │
│              join run-capture ◄───────────────────┘   │
│                          ↓
└─ delegate implementation
         ↓ resumeAt
    implementation-settlement
```

### 2. Mise à jour des `requiredBefore`

Dans le `WorkflowState` initial, le champ `requiredBefore` est corrigé pour
refléter les dépendances réelles :

| Tâche | `requiredBefore` actuel | `requiredBefore` corrigé |
|---|---|---|
| `repo-capture` | `["dirty-state-capture"]` | `["dirty-state-capture", "run-capture", "repo-discovery-draft"]` |
| `dirty-state-capture` | `["run-capture", "workspace-setup", "repo-discovery-draft"]` | `["workspace-setup"]` |

### 3. Texte descriptif

Le paragraphe d'introduction des branches parallèles (§1.2 de `run-init.md`)
est réécrit pour expliquer explicitement pourquoi `run-capture` et
`repo-discovery-draft` ne sont pas bloquées par `dirty-state-capture`.

---

## Conséquences

### Positives

- Le graphe reflète les dépendances réelles. Un lecteur comprend immédiatement
  ce qui bloque quoi sans avoir à croiser les specs de chaque tâche.
- `run-capture` et `repo-discovery-draft` peuvent terminer avant
  `dirty-state-capture`, libérant des ressources plus tôt et réduisant la
  fenêtre pendant laquelle une annulation devrait les tuer.
- Le principe « démarrer dès que possible » est appliqué uniformément,
  renforçant la cohérence architecturale du workflow.
- Zéro changement de code : le stage harness et les implémentations runtime
  ne sont pas impactés. La modification est purement spécificative.

### Coûts

- 4 fichiers de spec modifiés (`run-init.md`, `run-capture.md`,
  `repo-discovery-draft.md`, `project-discovery-finalize.md`).
- 1 ADR créé.
- La règle de cancellation en cas d'échec (§1.5) est inchangée mais
  potentiellement plus fréquente : si `dirty-state-capture` échoue alors que
  `run-capture` est déjà en cours, cette dernière sera annulée. Ce
  comportement est déjà prévu par la spec actuelle (« annule les branches
  encore actives »).

### Non-goals

- Ce changement ne modifie pas le comportement des tâches elles-mêmes.
- Il n'introduit pas de nouveau mécanisme de parallélisme.
- Il ne change pas les joins ni les règles de projection dans `WorkflowState`.

---

## Alternatives rejetées

### Garder le graphe actuel

Rejeté. Masquer les vraies dépendances derrière un point de synchronisation
artificiel crée de la confusion (pourquoi `repo-discovery-draft` attend-elle
un dirty state qu'elle ne lit pas ?) et retarde inutilement deux branches.

### Lancer aussi `workspace-setup` avant `dirty-state-capture`

Rejeté. `workspace-setup` a une dépendance réelle sur `dirty-state-capture`
(replay du patch). La lancer avant serait incorrect.

### Tout séquentialiser

Rejeté. Contredit le principe de parallélisme déjà établi par l'architecture
`run-init` et ralentirait le démarrage sans bénéfice.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
