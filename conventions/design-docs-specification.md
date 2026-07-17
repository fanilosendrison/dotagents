---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "architecture"
severity: "strict"
name: "Design Docs Specification"
---

# Design Docs Specification (State of the Art)

Ce document définit le standard (l'état de l'art) pour la rédaction des spécifications techniques et des *Design Docs* au sein de l'espace de travail `/go`. Il s'applique notamment aux documents situés dans les dossiers `specs/working/` ou `specs/briefs/`.

Un Design Doc ne documente pas *pourquoi* une décision majeure a été prise (c'est le rôle des ADRs), mais *comment* un composant, une tâche ou un système complet doit être construit, quelles sont ses interfaces, ses règles et ses limites.

Tout nouveau Design Doc (ou spécification technique d'architecture) doit impérativement contenir les sections suivantes.

---

## 1. Métadonnées (En-tête)
Le document doit commencer par un bloc listant son état dans le cycle de vie :
- **Author(s) :** Les concepteurs initiaux.
- **Reviewer(s) :** Les personnes ou entités ayant validé l'architecture.
- **Status :** L'état actuel du document (`Draft`, `In Review`, `Approved`, `Implemented`, `Deprecated`).
- **Last Updated :** Date de la dernière modification majeure.

## 2. Context & Motivation (Pourquoi)
Un bref paragraphe expliquant pourquoi ce composant existe et quel problème il résout.
- Ne présumez pas que le lecteur possède tout l'historique du projet.
- Incluez des liens vers d'autres ADRs (`specs/adr/`) ou tickets pertinents.

## 3. Goals & Non-Goals (Périmètre) 🌟
C'est la section la plus critique pour éviter le "scope creep".
- **Goals :** Ce que le composant ou l'étape de workflow *doit* accomplir (ex: "Isoler le workspace Git", "Délivrer une réponse sous 200ms").
- **Non-Goals :** Ce que le composant *ne fera explicitement pas* (ex: "Ce n'est pas le rôle de ce composant de parser les variables d'environnement").

## 4. Proposed Architecture / Design (Comment)
Le cœur technique du document. Il doit être suffisamment précis pour qu'un agent ou un développeur puisse l'implémenter sans ambiguïté.
- **System Architecture :** Description haut niveau du flux. L'utilisation de **diagrammes Mermaid** (séquence, états) est fortement encouragée.
- **Interface Contract :** Les `Inputs` et `Outputs` exacts attendus (types de données, références).
- **Internal Operations :** Les grandes étapes logiques internes du système.

## 5. Alternatives Considered (Rejets)
Toute architecture est un compromis. Vous devez lister au moins une alternative viable et expliquer pourquoi elle a été rejetée.
- *Exemple : "Nous avons envisagé l'utilisation de Docker, mais nous avons choisi Git Worktrees à cause des contraintes macOS."*
- Cela permet aux relecteurs futurs de comprendre que la question a déjà été posée et étudiée.

## 6. Cross-Cutting Concerns (Impacts transverses)
Les éléments d'ingénierie globale qui affectent le système :
- **Reliability & Failure Modes :** Lister chaque mode d'échec possible et l'action associée (ex: Arrêt immédiat, Retry).
- **Observability :** Comment surveiller ce composant (quels identifiants de trace loguer, quelles métriques).
- **Security & Permissions :** Les contraintes de sécurité (ex: isolation réseau, risques de *path traversal*).
- **Invariants :** Les règles immuables que le système ne doit jamais enfreindre.

## 7. Testing Strategy
Comment l'implémentation de cette spécification sera-t-elle vérifiée de manière fiable ?
- Stratégie globale (Tests unitaires, tests d'intégration, "Fixtures" complexes).
- Comment simuler les "Failure Modes" décrits précédemment.
