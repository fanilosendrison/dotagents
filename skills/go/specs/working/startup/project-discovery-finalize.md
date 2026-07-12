# Startup join `project-discovery-finalize`

`project-discovery-finalize` produit le `ProjectDiscovery` autoritatif du run.
Il ne se contente pas de lire des manifestes : il prouve que les commandes de
gates retenues correspondent au worktree physique prive qui sera modifie et
verifie.

Ce startup join synchronise :

- `workspace-setup`, qui produit `WorkSession` ;
- `repo-discovery-draft`, qui peut avoir inspecte le checkout source en
  parallele.

---

## 1. Objectif

Produire une matrice de gates mecaniques adaptee au repo, validee contre le
worktree prive du run.

Le resultat durable est `ProjectDiscovery`.

---

## 2. Position dans le workflow

Demarrage nominal :

```text
run-init
├─ repo-discovery-draft
└─ workspace-setup
       ↓
project-discovery-finalize
       ↓
implementation
```

`repo-discovery-draft` peut commencer avant `workspace-setup`, mais
`project-discovery-finalize` ne peut finaliser qu'apres `WorkSession`.

---

## 3. Inputs

Inputs obligatoires :

- `WorkSession`
- worktree physique prive (`worktreeRoot`)
- artefact root prive (`artefactRoot`)
- policy de gates

Inputs optionnels :

- `RepositoryDiscoveryDraft`
- fichiers manifeste du projet
- scripts declares par le projet
- lockfiles
- configs de tooling

Si aucun `RepositoryDiscoveryDraft` valide n'est disponible, ce join peut
relancer la discovery depuis `worktreeRoot`.

---

## 4. Outputs

Artefact metier :

```ts
type ProjectDiscovery = {
  source: "draft-finalized" | "worktree-rerun";
  finalizedFromDraftId?: string;
  finalizedAgainstWorktreeRoot: string;
  inspectedFiles: InspectedFileRef[];
  packageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
  lockfiles: string[];
  checkCommands: MechanicalCheckDefinition[];
  testCommands: MechanicalCheckDefinition[];
  buildCommands: MechanicalCheckDefinition[];
  providerCapabilities: ProviderCapabilities;
};
```

Evidence typiques :

- manifestes detectes ;
- lockfiles detectes ;
- fichiers inspectes et hashes ;
- scripts disponibles ;
- commandes candidates ;
- commandes retenues ;
- commandes requises ou optionnelles ;
- justification de fallback si le draft est invalide.

---

## 5. Responsabilites

- Verifier la presence du worktree prive.
- Valider que les chemins de commande pointent vers `worktreeRoot`.
- Valider que les evidence refs pointent sous `artefactRoot`.
- Detecter ou finaliser le package manager.
- Detecter ou finaliser les lockfiles.
- Detecter ou finaliser les scripts de format, lint, typecheck, tests et build.
- Detecter les scans disponibles.
- Detecter le provider Git distant si possible.
- Detecter si les PRs peuvent etre ouvertes automatiquement.
- Ecrire la matrice `MechanicalCheckDefinition[]`.

---

## 6. `repo-discovery-draft`

`repo-discovery-draft` est une startup branch. Elle lit le
checkout source en lecture seule pendant que `workspace-setup` peut creer le
worktree.

Elle peut inspecter :

- `package.json` ;
- lockfiles ;
- configs de lint, format, typecheck et test ;
- fichiers de workspace ;
- configuration Git remote ;
- scripts declares par le projet.

Elle produit `RepositoryDiscoveryDraft`.

Ce draft n'est pas autoritatif. Il accelere `project-discovery-finalize`, mais
il ne suffit pas a definir les gates.

---

## 7. Finalisation du draft

Quand un draft existe, `project-discovery-finalize` doit verifier :

- chaque fichier requis par `inspectedFiles` existe dans `worktreeRoot` ;
- le hash du fichier dans le worktree correspond au hash du draft ;
- les commandes candidates peuvent etre exprimees avec
  `workingDirectory: worktreeRoot` ou un sous-dossier valide ;
- les commandes retenues sont des argv, pas des chaines shell concatenees ;
- aucun evidence ref ne pointe dans le worktree ;
- la policy autorise les gates retenues.

Si toutes les preuves matchent, le `ProjectDiscovery.source` vaut
`"draft-finalized"`.

Si une preuve ne matche pas, le join doit choisir entre :

- relancer la discovery depuis `worktreeRoot`, si la policy l'autorise ;
- echouer ferme.

Dans le cas d'un rerun depuis le worktree, `ProjectDiscovery.source` vaut
`"worktree-rerun"`.

---

## 8. Regles

- Ne pas installer de nouveaux outils.
- Ne pas modifier le repo.
- Ne pas executer les checks lourds ; seulement decouvrir.
- Preferer les scripts du projet aux conventions generiques.
- Echouer ferme si aucun moyen fiable de verifier le projet n'existe et que la
  policy exige des gates.
- Ne jamais rendre autoritatif un draft non prouve contre `WorkSession`.
- Ne jamais utiliser le checkout source comme `workingDirectory` des gates
  finales.

---

## 9. Phases Turnlock typiques

```text
load-work-session
load-repository-discovery-draft
validate-draft-file-hashes-against-worktree
rerun-discovery-from-worktree-if-needed
build-mechanical-gate-matrix
write-discovery-evidence
persist-stage-output
```

---

## 10. Failure modes

- `WorkSession` absent : `errored`.
- Worktree introuvable : `errored`.
- Draft invalide et rerun non autorise : `failed`.
- Aucun check fiable detecte alors que la policy exige des gates : `failed`.
- Commande candidate non representable en argv : `failed`.
- Evidence hors `artefactRoot` : `errored`.
- Artefact `ProjectDiscovery` invalide : `errored`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
