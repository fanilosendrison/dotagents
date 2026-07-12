# Stage `project-discovery`

`project-discovery` détecte comment vérifier le repository courant. Elle évite
que `/go` invente des commandes ou applique une convention d'un autre projet.

---

## 1. Objectif

Produire une matrice de gates mécaniques adaptées au repo.

---

## 2. Inputs

- `WorkSession`
- worktree physique privé
- fichiers manifeste du projet
- scripts déclarés par le projet

---

## 3. Outputs

`ProjectDiscovery`

Evidence typiques :

- manifestes détectés ;
- lockfiles ;
- scripts disponibles ;
- commandes candidates ;
- commandes retenues ;
- commandes requises ou optionnelles.

---

## 4. Responsabilités

- Détecter package manager.
- Détecter lockfiles.
- Détecter scripts de format/lint/typecheck/tests/build.
- Détecter scans disponibles.
- Détecter provider Git distant si possible.
- Détecter si les PRs peuvent être ouvertes automatiquement.
- Écrire la matrice `MechanicalCheckDefinition[]`.

---

## 5. Règles

- Ne pas installer de nouveaux outils.
- Ne pas modifier le repo.
- Ne pas exécuter les checks lourds ; seulement découvrir.
- Préférer les scripts du projet aux conventions génériques.
- Échouer fermé si aucun moyen fiable de vérifier le projet n'existe et que la
  policy exige des gates.

---

## 6. Phases Turnlock typiques

```text
inspect-manifests
inspect-lockfiles
inspect-package-scripts
inspect-provider-capabilities
build-mechanical-gate-matrix
write-discovery-evidence
persist-stage-output
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
