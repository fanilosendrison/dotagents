---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "architecture"
severity: "strict"
name: "Cubits Design Docs Specification"
---

# Cubits Design Docs Specification (State of the Art & /go Standard)

Ce document définit le standard (l'état de l'art) pour la rédaction des spécifications techniques et des *Cubits Design Docs* au sein de l'espace de travail `/go`. Il s'applique notamment aux documents situés dans les dossiers `specs/working/` ou `specs/briefs/`.

Un Cubits Design Doc ne documente pas *pourquoi* une décision majeure a été prise (c'est le rôle des ADRs), mais *comment* un composant, une tâche ou un système complet doit être construit, quelles sont ses interfaces, ses règles et ses limites.

Tout nouveau Cubits Design Doc (ou spécification technique d'architecture) dans le projet `/go` doit impérativement contenir les sections suivantes.

---

## 1. Métadonnées (En-tête YAML)
Conformément au standard OKF, le document doit obligatoirement commencer par un bloc YAML Frontmatter contenant son état dans le cycle de vie, et non par du texte Markdown. Le schéma ci-dessous est **l'unique schéma autorisé** pour le `format: "cubits-design-doc"` (aligné sur le standard maître Cubits Design Doc §4) :
```yaml
---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "YYYY-MM-DD"
step_id: 0                         # Étape de conception
id: CDD-GO-EXEMPLE                 # Identifiant unique
version: "1.0.0"
scope: run-init                    # Système couvert
status: draft                      # draft | active | extracted-archive
consumers: [agent-generator]
superseded_by: []                  # Rempli à l'archivage (NIBs/ADRs)
---
```

Cycle de vie (`status`) : `draft` (conception en cours, absorbe l'ancien tier NX) → `active` (mûr, prêt pour extraction NIB) → `extracted-archive` (NIBs générés, document archivé, non maintenu). Aucun autre statut n'est autorisé. Les documents **permanents** (standards, contrats, conventions) ne sont pas des CDDs : ils utilisent `kind: "KnowledgeAsset"` et échappent à ce cycle de vie.

## 2. Objectif & Position dans l'Architecture
Un bref paragraphe définissant le rôle exact du composant et son périmètre global.
- **Objectif :** Un résumé strict de l'utilité de la tâche.
- **Position :** Un **diagramme ASCII** illustrant où se situe cette étape dans le graphe d'exécution global (ex: avant `B`, en parallèle de `C`). Très important pour visualiser les flux.

## 3. Goals & Non-Goals (Périmètre) 🌟
C'est la section la plus critique pour éviter le "scope creep".
- **Goals :** Ce que le composant ou le module *doit* accomplir.
- **Non-Goals :** Ce que le composant *ne fera explicitement pas* (ex: "Ne pas altérer le dépôt source", "Ne pas lire le prompt utilisateur").

## 4. Contrats de Données (Inputs & Outputs)
L'implémentation nécessite un typage fort.
- **Inputs :** Les entrées requises (artefacts, configuration, variables d'environnement, contexte). Précisez si c'est par référence ou par valeur.
- **Outputs :** La structure exacte (ex: schéma JSON TypeScript) des preuves (evidences) ou artefacts générés.

## 5. Pipeline / Stratégie d'exécution
Le cœur technique du document. Il décrit la séquence logique pas-à-pas (ex: *5.1 Résolution*, *5.2 Initialisation*). C'est la séquence interne d'exécution détaillée (ce que l'agent devra coder).

## 6. Règles & Invariants
Les règles métier ou techniques immuables (ex: "Lecture seule absolue", "Host-side uniquement"). Le composant ne doit jamais enfreindre ces règles.

## 7. Opérations internes typiques
Une simple liste des fonctions ou opérations clés à implémenter (ex: `verify-head-exists`, `write-capture-artifact`).

## 8. Cross-Cutting Concerns & Résilience
Les éléments d'ingénierie globale qui affectent le système :
- **Failure Modes :** Un **tableau exhaustif** associant chaque point de défaillance du pipeline à un statut (ex: `failed`, `errored`, `warning`) et l'action associée (ex: Arrêt immédiat, Retry).
- **Idempotence & Checkpoints :** Comment la tâche gère les reprises (retries). Composition exacte de la clé d'idempotence (ex: hachage canonique) et conditions de ré-exécution.
- **Cleanup :** Opérations de nettoyage post-exécution (ex: destruction du conteneur, `git worktree remove`).
- **Security & Permissions :** Les contraintes de sécurité (ex: isolation réseau, accès au disque).

## 9. Dependencies (Dépendances)
Aucun composant ne vit dans le vide. Précisez les dépendances externes :
- **Amont (Upstream) :** De quels systèmes, APIs ou autres étapes dépend ce composant ?
- **Aval (Downstream) :** Quels systèmes seront impactés si ce composant modifie son contrat de sortie ?

## 10. Testing Strategy
Cette section fournit la matière première à l'agent qui rédigera le document de tests d'acceptation (NIB-T).
- **Vecteurs d'Acceptation :** Exemples concrets (Input A produit Output B). On teste le comportement observable (la frontière), pas l'implémentation.
- **Propriétés Anti-Cheat :** Règles structurelles à vérifier (ex: l'idempotence, ne pas toucher au disque).
- **Invariants de Contrat :** Assertions transverses vraies pour toutes les exécutions.
- **INTERDIT :** Toute mention ou prescription de tests unitaires internes est formellement proscrite. Les tests unitaires émergeront naturellement pendant l'implémentation.

## 11. Glossary (Glossaire)
Si l'architecture introduit de nouveaux concepts (ou réutilise des concepts pointus), définissez-les brièvement ou ajoutez un lien vers le vocabulaire canonique du projet (ex: `canonical-vocabulary.md`).

---

## 12. Checklist de Conformité (Agent Linter)
*À l'attention des agents IA effectuant une revue de conformité architecturale.*

Lors de la vérification d'un brouillon (proto-CubitsDesignDoc) ou d'une spécification finale, validez obligatoirement les points suivants. Tout point non satisfait doit être signalé à l'utilisateur comme un **angle mort (blind spot)** nécessitant réflexion.

- [ ] **Métadonnées :** Le frontmatter YAML est-il conforme à l'unique schéma du §1 (clés OKF complètes, `status` ∈ `draft | active | extracted-archive`) ?
- [ ] **Contexte & Position :** Le rôle du composant est-il clair et a-t-on un diagramme ASCII de sa position dans l'architecture globale ?
- [ ] **Non-Goals :** A-t-on défini explicitement ce que le système ne fera PAS pour brider le scope ?
- [ ] **Contrats (I/O) :** Les Inputs et Outputs sont-ils strictement listés (idéalement avec schémas JSON ou typages) ?
- [ ] **Pipeline :** L'exécution est-elle découpée pas-à-pas avec une granularité suffisante pour être codée sans ambiguïté ?
- [ ] **Règles & Invariants :** Les contraintes physiques ou logiques immuables sont-elles explicites ?
- [ ] **Opérations typiques :** Une liste des fonctions clés est-elle présente ?
- [ ] **Failure Modes :** Y a-t-il une liste ou un tableau liant chaque échec possible du pipeline à une action stricte (failed, errored, retry) ?
- [ ] **Idempotence :** Le calcul de la clé d'idempotence (ou hachage de contexte) et le comportement lors d'un Retry sont-ils documentés ?
- [ ] **Cleanup :** Le nettoyage des ressources physiques ou mémoires post-exécution est-il abordé ?
- [ ] **Dépendances :** Les composants amont (ceux qu'on consomme) et aval (ceux qui nous consomment) sont-ils identifiés ?
- [ ] **Testing Strategy :** Les vecteurs d'acceptation (I/O observables) et les propriétés anti-triche sont-ils définis SANS aucune mention de tests unitaires internes ?
