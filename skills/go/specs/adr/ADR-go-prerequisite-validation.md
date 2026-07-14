---
id: ADR-GO-PREREQUISITE-VALIDATION
type: adr
version: "1.0.0"
scope: go-workflow/run-init
status: active
supersedes: []
superseded_by: []
---

# ADR — Bootstrap task `prerequisite-validation`

VegaCorp — July 2026

---

## Contexte

Historiquement, `run-init` exécutait deux validations séparées :

1. **`provider-config-validation`** : validation du fichier `~/.go/config.json`
   (ProviderConfig) en première position, fail-fast. Documentée dans
   [ADR-go-mandatory-provider-config-fail-fast.md](./ADR-go-mandatory-provider-config-fail-fast.md).
2. **Vérification Git** : `workspace-setup.worktree.md` §2.3 exigeait
   `git --version` ≥ 2.18 mais déléguait la vérification à
   `workspace-setup` elle-même — soit au 4ᵉ niveau du pipeline, après que
   `dirty-state-capture` ait déjà exécuté plusieurs commandes Git.

Ce placement tardif violait le principe fail-fast : si Git est trop vieux,
le run échoue après avoir exécuté `git rev-parse`, `git status`, et
`git diff` dans `dirty-state-capture`, gaspillant des ressources pour un
échec prévisible.

---

## Décision

1. **Fusionner** les deux vérifications sous une seule bootstrap task
   renommée `prerequisite-validation`, exécutée en première position avant
   toute autre tâche.

2. La tâche couvre désormais :
   - **ProviderConfig** : validation inchangée (schéma, token, endpoint).
   - **Git** : `git --version` ≥ 2.18 (prérequis worktree
     `git worktree remove --force`).

3. `workspace-setup` ne vérifie plus la version Git. Elle documente ses
   prérequis dans ses invariants mais suppose la validation faite en amont
   par `run-init`.

4. Le fichier source de la spec est renommé
   `prerequisite-validation.md` pour refléter le nom logique de la tâche.

---

## Justification

- **Fail-fast cohérent** : toutes les préconditions d'environnement
  échouent au même point, avant la première commande Git sur le dépôt
  source.
- **Extensibilité** : si d'autres prérequis apparaissent (ex: `git-lfs`
  obligatoire, `bun` version minimale), ils atterrissent naturellement
  dans `prerequisite-validation` sans créer de nouvelles tâches.
- **Séparation des responsabilités** : `prerequisite-validation` valide
  l'environnement ; `workspace-setup` crée le worktree en supposant
  l'environnement viable.

---

## Conséquences

- Renommage de `provider-config-validation` → `prerequisite-validation`
  dans tous les graphes, enums, chemins d'artefacts, et références des
  specs `working/`.
- `workspace-setup.worktree.md` §2.3 allégé : ne fait plus que documenter
  les prérequis, sans les vérifier.
- La ligne de failure mode « Version Git < 2.18 » est déplacée de
  `workspace-setup.worktree.md` §4 vers
  `prerequisite-validation.md` §7.
- Le fichier de spec est renommé `provider-config-validation.md` →
  `prerequisite-validation.md` pour refléter le nom de la tâche.
- L'ADR [ADR-go-mandatory-provider-config-fail-fast.md](./ADR-go-mandatory-provider-config-fail-fast.md)
  reste inchangé (document historique).

---

## Alternatives rejetées

### Vérification Git dans `workspace-setup`

Rejetée : place la vérification trop tard dans le pipeline, après que
d'autres tâches aient déjà exécuté des commandes Git.

### Deux tâches séparées (`provider-config-validation` + `git-version-check`)

Rejetée : complexité inutile. Deux tâches séquentielles pour des
validations qui partagent la même sémantique (prérequis d'environnement)
et la même position dans le graphe.

### Renommer le fichier physique

Fait. Le fichier est renommé `prerequisite-validation.md`. Les 3 liens
inter-fichiers (`run-init.md` ×2, `external-primitives.md` ×1) sont mis
à jour.

---

VegaCorp — `/go` Workflow — "Reliability precedes intelligence."
