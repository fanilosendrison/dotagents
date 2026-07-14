---
id: ADR-GO-MANDATORY-PROVIDER-CONFIG-FAIL-FAST
type: ard
version: "1.0.0"
scope: go-workflow/run-init
status: active
supersedes: []
superseded_by: []
---

# ARD - Validation anticipée et obligatoire de la configuration du fournisseur (ProviderConfig)

VegaCorp - July 2026

---

## Contexte

Le workflow `/go` a besoin d'interagir avec des plateformes Git distantes (GitHub, GitLab) pour plusieurs opérations clés :
- Créer un dépôt distant si un nouveau dépôt est initialisé en local (`workspace-setup`).
- Pousser des branches de travail et publier des Pull Requests (`package-and-publish`).
- Lire l'état réel de la PR et de la CI (`pr-ci-review`).

Ces interactions reposent sur le fichier de configuration globale `ProviderConfig` (stocké à `~/.go/config.json`). 

Auparavant, la validation de `ProviderConfig` était effectuée tardivement au sein de la tâche `workspace-setup` (en plein milieu de la phase `run-init`), après que le dépôt ait été capturé, que les branches de travail ont été lancées en parallèle et que les répertoires de travail ont été alloués sur le disque. De plus, une possibilité de fonctionnement "local-only" sans configuration fournisseur était envisagée.

Cette approche présentait plusieurs inconvénients :
1. **Échec tardif (Late Failure) :** Un fichier de configuration absent ou mal formé n'était détecté qu'après le démarrage des opérations, polluant le disque avec des ressources allouées pour un run condamné à échouer.
2. **Complexité inutile :** Le support théorique d'un mode "local-only" introduisait des bifurcations logiques complexes dans toutes les étapes d'initialisation et de validation de PR.
3. **Visibilité de l'erreur :** L'erreur de configuration globale se retrouvait noyée dans les rapports d'exécution de la sous-tâche `workspace-setup` au lieu d'être signalée comme un problème d'installation global et immédiat.

---

## Décision

1. **Obligation stricte de `ProviderConfig` :** Le workflow `/go` exige la présence d'une configuration fournisseur valide. Le mode "local-only" (sans plateforme distante configurée) est explicitement rejeté pour le périmètre nominal de `/go`.
2. **Fail-Fast upfront dans `run-init` :** La validation de la forme, de la présence et de la validité syntaxique de `ProviderConfig` (chargé depuis `~/.go/config.json`) devient la toute première étape synchrone et séquentielle de la phase `run-init`.
3. **Aucun effet de bord avant validation :** Si la configuration est absente ou invalide, l'orchestrateur s'arrête immédiatement en statut `errored` sans allouer de `runId` définitif sur le disque, sans réserver de répertoires, et sans démarrer les branches de bootstrap parallèles.

---

## Conséquences

- **Robustesse accrue :** Réduction des états d'erreur partiels ou corrompus sur le système de fichiers.
- **Diagnostics simplifiés :** Les erreurs de configuration globale sont signalées instantanément au démarrage du run avec une cause claire.
- **Simplification du code et des specs :** Les bootstrap tasks (`workspace-setup`, `project-discovery-finalize`) et les stages ultérieurs (`package-and-publish`, `pr-ci-review`) peuvent supposer sans vérification supplémentaire qu'une configuration `ProviderConfig` valide et structurée est disponible globalement.

---

## Alternatives rejetées

### Support du mode "local-only"

Rejeté car non conforme aux objectifs de `/go`. Le workflow `/go` vise par nature l'automatisation complète de bout en bout, y compris la matérialisation et la vérification contre le dépôt distant et la CI. Un environnement sans fournisseur n'a pas l'usage du workflow `/go`.

### Validation asynchrone / parallèle

Rejeté car l'allocation de ressources de run et le lancement d'autres branches en parallèle de la vérification de configuration globale violent le principe de "Fail-Fast".

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
