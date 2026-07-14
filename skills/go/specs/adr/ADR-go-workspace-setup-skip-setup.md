---
id: ADR-GO-WORKSPACE-SETUP-SKIP-SETUP
type: adr
version: "1.0.0"
scope: go-workflow/run-init/workspace-setup
status: active
supersedes: []
superseded_by: []
---

# ADR - Paramètre `skipSetup` pour `workspace-setup`

VegaCorp - July 2026

---

## Contexte

`workspace-setup` est une bootstrap task interne à `run-init`. Elle prépare le
worktree Git physique privé du run : initialisation du dépôt si besoin (§4.2),
détection du point de départ Git (§4.3), capture et adoption du dirty state
(§4.4), création du worktree (§4.5), replay du dirty state (§4.6), et
persistance du `WorkSession` (§4.7).

Lors d'un retry de `run-init` (reprise après crash), `workspace-setup` a déjà
produit un checkpoint valide : le worktree existe, la branche `work/<runId>`
existe, le `WorkSession` est persisté. Relancer le pipeline complet
déclencherait la logique de retry destructive du §4.8.2 (force-delete et
reconstruction), ce qui serait incorrect et risquerait de perdre des données.

`run-init` §5.1 prescrit donc de relancer `workspace-setup` en mode
vérification seule, sans ré-exécuter les étapes de création.

---

## Décision

Ajouter un paramètre `skipSetup` (`boolean`, défaut `false`) aux inputs de
`workspace-setup`.

Quand `skipSetup` vaut `true` :

- Les étapes §4.2 (initialisation) et §4.5 (création du worktree) sont
  ignorées.
- L'étape §4.1 est exécutée avec des vérifications assouplies : seul le
  containment du `workspaceRoot` dans le run est vérifié, sans imposer de
  résolution de la racine Git source.
- Le pipeline ne tente jamais de suppression ou reconstruction du worktree.

Quand `skipSetup` vaut `false` (défaut) :

- Le pipeline complet est exécuté, y compris la logique de retry du §4.8.2
  (qui gère les worktrees préexistants de manière destructive si nécessaire).

---

## Justification du nom

`skipSetup` a été choisi après rejet de plusieurs alternatives :

- `mode: "execute" | "validate"` — trop vague. `mode` ne dit pas ce qui est
  contrôlé, et `"execute"` ne communique pas la création.
- `intent: "setup" | "verify"` — meilleur que `mode`, mais ne fait toujours pas
  le lien avec le contexte worktree/retry.
- `onRetry: "verify-worktree"` — verbeux, et le cas d'usage est binaire.

`skipSetup` est auto-documenté : le nom du paramètre décrit exactement ce qui
change dans le pipeline. Aucune ambiguïté sur sa sémantique. Un booléen suffit
car le besoin est binaire (setup complet vs. vérification seule), conforme au
principe YAGNI.

---

## Conséquences

- `run-init` §5.1 et §5.2 référencent `skipSetup: true` au lieu de `mode:
  "validate"`.
- Le contrat de `workspace-setup` est stable : ajout d'un paramètre optionnel
  sans rupture des inputs existants.
- La logique de retry reste dans `workspace-setup` (pas de duplication dans
  `run-init`), mais le contrôle du comportement est explicite via l'input.
- Si un futur besoin exige un comportement plus fin, un enum pourra remplacer
  le booléen sans casser la sémantique (la valeur par défaut `false` reste le
  chemin nominal).

---

## Alternatives rejetées

### `mode: "execute" | "validate"`

Rejeté pour manque de clarté. Le terme `mode` est un fourre-tout qui oblige le
lecteur à consulter la spec pour comprendre ce qui est contrôlé. `"execute"`
ne distingue pas la création de la simple exécution.

### Pas de paramètre — détection implicite

Rejeté. Détecter automatiquement si le worktree existe déjà est fragile (le
worktree peut exister mais être corrompu, ou ne pas exister mais devoir être
recréé). Un paramètre explicite force l'appelant (`run-init`) à prendre une
décision consciente basée sur l'état des checkpoints.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
