---
id: ADR-GO-TURNLOCK-V0.9-PHASE-MECHANICS
type: adr
version: "1.0.0"
scope: go-workflow/orchestrator
status: active
supersedes: []
superseded_by: []
---

# ADR — Alignement sur Turnlock v0.9.0 et mécanique des phases

VegaCorp — July 2026

---

## Contexte

La première version du bridge spec (`turnlock-bridge.md`) a été rédigée
contre Turnlock v0.8.0. Elle supposait l'existence de `io.transition()`,
une primitive permettant à une phase Turnlock d'enchaîner vers une autre
phase sans sortir du processus — et donc sans délégation. Cette hypothèse
a donné naissance à `dummy-phase`, une phase placeholder qui devait
recevoir la transition après `implementation-settlement` en Phase 1.

Le passage à Turnlock v0.9.0 a révélé que cette primitive n'existe pas.
`PhaseResult` a exactement 3 variants :

| Kind | Effet |
|---|---|
| `delegate` | Suspend le workflow, émet un bloc protocole, exit(0). Turnlock attend le résultat puis relance le processus avec `--resume` vers `resumeAt`. |
| `done` | Termine le workflow, exit(0). |
| `fail` | Échec, exit(1). |

Il n'y a **pas** de transition intra-process entre phases. Chaque
invocation de phase est un processus distinct. Le seul mécanisme
d'enchaînement est la délégation : `io.delegate()` → exit(0) → résumé
via `--resume` → la phase pointée par `resumeAt` est invoquée.

Cette découverte invalide structurellement `dummy-phase` : une phase qui
n'est jamais référencée par un `resumeAt` est du code mort, jamais atteint
par le runtime.

Par ailleurs, cette contrainte clarifie le modèle mental déjà amorcé dans
[ADR-go-stages-vs-turnlock-phases](./ADR-go-stages-vs-turnlock-phases.md) :
puisqu'une phase ne peut enchaîner vers une autre que via délégation,
**toutes les étapes mécaniques entre deux délégations s'exécutent dans la
même phase**. Le nombre de phases = O(nombre de délégations), pas
O(nombre de stages).

---

## Décision

1. **Supprimer `dummy-phase`.** La phase n'a jamais été atteignable dans
   Turnlock v0.9.0 et n'aurait servi qu'avec un `io.transition()` inexistant.

2. **`implementation-settlement` termine par `io.done()`.** En Phase 1, après
   avoir consommé le résultat de la délégation `implementation`, la phase
   conclut le workflow. En Phase 2+, cette même phase sera **étendue** (pas
   remplacée) pour enchaîner avec `change-snapshot`, `conduct-settled` et
   `mechanical-gates` avant de déléguer à nouveau.

3. **Règle canonique** : une phase Turnlock batche tout le travail mécanique
   déterministe jusqu'au prochain point de délégation. Elle ne se suspend
   que lorsque le workflow a besoin d'un agent externe (LLM, skill,
   décision humaine).

4. **Mise à jour du bridge spec** : `turnlock-bridge.md` passe de `^0.8.0` à
   `^0.9.0`. Les imports et le registre de phases sont réduits à 2 entrées
   (`run-init` + `implementation-settlement`). L'appel à `io.transition()`
   est remplacé par `io.done()`. Le modèle mental (§0) est reformulé pour
   expliciter le batch mécanique.

---

## Conséquences

- **FSM Phase 1 = 2 phases** : `run-init` → `delegate implementation` →
  `implementation-settlement` → `done`.
- **Le plan NIB** hérite de cette mécanique : le `NIB-S` documente 2 phases,
  `NIB-M-IMPLEMENTATION-DELEGATION-STUB` spécifie `io.done()`, et aucun
  NIB-M n'est créé pour `dummy-phase`.
- **`ADR-go-stages-vs-turnlock-phases` reste valide** mais est précisé :
  la séparation stage/phase/délégation était correcte, mais l'hypothèse
  sous-jacente (existence de `io.transition()`) était erronée.
- **Phase 2+ inchangée dans son design** : `implementation-settlement`
  continuera vers les stages mécaniques dans la même phase, puis déléguera
  à nouveau. La suppression de `dummy-phase` n'affecte que Phase 1.
- **Bridge spec** est la référence unique pour la consommation de
  Turnlock ; les futures évolutions de l'API Turnlock doivent être
  vérifiées contre le bridge spec d'abord.

---

## Alternatives rejetées

### Garder `dummy-phase` avec une délégation synthétique

Faire en sorte que `implementation-settlement` émette un
`io.delegate()` synthétique (qui se résout immédiatement) avec
`resumeAt: "dummy-phase"`. Rejeté parce que :

- Complexité inutile : une délégation synthétique nécessite un worker
  factice, un protocole de résolution immédiate, et un mécanisme de
  reprise pour quelque chose qui ne fait que `io.done()`.
- `io.done()` est la primitive prévue pour terminer un workflow — c'est
  exactement ce qu'on veut en Phase 1.
- En Phase 2+, `dummy-phase` aurait de toute façon disparu au profit
  des vrais stages mécaniques.

### Forker Turnlock pour ajouter `io.transition()`

Rejeté parce que :

- `io.transition()` introduirait un second mécanisme d'enchaînement
  (intra-process vs inter-process) avec des sémantiques de reprise
  différentes, complexifiant le runtime.
- Le modèle actuel (une phase = un processus, un seul mécanisme de
  suspension = la délégation) est plus simple et plus robuste.
- Turnlock est une primitive externe (cf.
  [`external-primitives.md`](../working/standards/external-primitives.md)) ;
  `/go` ne définit pas de variante maison.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
