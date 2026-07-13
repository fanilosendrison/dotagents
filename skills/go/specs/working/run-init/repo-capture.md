# RepoCapture

Ce document definit le contexte que `run-init` doit resoudre avant toute
autre chose.

`run-init` ne lance pas `git`, ne choisit pas de branche et ne communique pas avec le réseau. Il
utilise uniquement des opérations de système de fichiers (realpath, stat) pour déduire ce contexte
à partir du répertoire d'invocation fourni par le parent process.

---

## 1. Objectif

La toute première opération de `run-init` est de produire un
`RepoCapture`.

Ce contexte repond a une question precise :

```text
Quel repo Git et quel sous-perimetre projet ce run /go cible-t-il ?
```

Il existe avant Turnlock pour eviter que `run-init` devienne une phase de
discovery. `run-init` reste purement mecanique :

```text
parent process provides invocationDirectory
-> parent process starts Turnlock with BootstrapState
-> run-init resolves RepoCapture from invocationDirectory
-> workspace-setup verifies it against real Git state
```

---

## 2. Première opération de run-init

Le parent process (l'agent ou le harness) qui recoit le `/go` ne fournit qu'une seule information relative au code :

- le repertoire courant ou workspace courant (`invocationDirectory`).

`run-init` lit ce CWD depuis le `BootstrapState`, puis résout le `RepoCapture` complet.

Inputs typiques de la résolution interne de `run-init` :

- `invocationDirectory` : repertoire courant de la session (l'unique source de verite pour la cible) ;

Si `run-init` ne peut pas prouver un repo Git cible unique (ou fallback formel), `/go` echoue.

Si le parent process n'a pas configuré un `runDirRoot` valide, `run-init` verifie le containment de `runDir` par rapport au repo cible fraîchement résolu. S'il y a violation, `/go` échoue ferme, car il ne peut pas deplacer une enveloppe runtime deja creee.

---

## 3. Contrat minimal

`RepoCapture` doit contenir :

- le repertoire d'invocation ;
- la racine Git canonique cible ;
- le sous-perimetre projet optionnel ;
- l'horodatage de resolution.

Forme conceptuelle :

```ts
type RepoCapture = {
  schema: "go.repo-capture.v1";
  invocationDirectory: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  symlinkResolved: boolean;
  resolvedAt: string;
};
```

`canonicalRepositoryRoot` est la racine Git cible (ou le dossier cible si aucun dépôt n'existait). Elle doit etre utilisable par `workspace-setup` pour creer une branche et un worktree.

`projectRoot` est optionnel. Il represente le sous-dossier metier vise dans un
monorepo. Il ne remplace jamais `canonicalRepositoryRoot`. S'il est absent, cela signifie qu'il n'y a pas de restriction de sous-perimetre (on travaille a la racine).

---

## 4. Resolution normative

Le sous-système de résolution de `run-init` produit le contexte en utilisant strictement le repertoire courant (`invocationDirectory`) :

1. Utiliser le repertoire courant de la session comme unique point de depart.
2. Normaliser les symlinks connus.
3. Chercher le répertoire `.git` le plus proche en remontant depuis ce chemin cible normalisé.
4. Si un dépôt est trouvé, `canonicalRepositoryRoot` est ce dépôt. Sinon, `canonicalRepositoryRoot` devient le répertoire d'invocation (CWD).

Les demandes explicites de l'utilisateur ne doivent jamais court-circuiter cette regle. Le repo cible est **toujours** defini par le CWD.

`workspace-setup` est la premiere bootstrap task qui verifie l'etat du
repo Git reel.

---

## 5. Sous-dossier de monorepo

Cas :

```text
monorepo/
├── .git/
├── packages/
│   ├── app/
│   └── lib/
└── tools/
```

Si la session cible `packages/app/`, le contexte doit distinguer :

```text
canonicalRepositoryRoot = "monorepo/"
projectRoot = "monorepo/packages/app/"
```

Le worktree Git est cree depuis `canonicalRepositoryRoot`, car Git ne cree pas
un worktree pour un sous-dossier.

Le `projectRoot` sert ensuite a limiter la discovery, les commandes ou les
reviews quand la demande porte sur un sous-projet precis.

Regles :

- `canonicalRepositoryRoot` est toujours la racine Git ;
- `projectRoot` est déduit automatiquement : si `invocationDirectory` ≠ `canonicalRepositoryRoot` et que `invocationDirectory` est un sous-dossier de `canonicalRepositoryRoot`, alors `projectRoot` = `invocationDirectory` ;
- `projectRoot` doit etre sous `canonicalRepositoryRoot` ;
- `workspace-setup` cree le worktree pour le repo entier ;
- `project-discovery-finalize` peut produire des commandes dont le
  `workingDirectory` cible le sous-projet.

---

## 6. Repos Git imbriques

Cas :

```text
workspace/
├── .git/
├── app/
└── vendor/
    └── nested-repo/
        └── .git/
```

La cible normative est le premier repo Git trouve en remontant depuis le repertoire courant de la session (`invocationDirectory`).

Si le terminal de la session (CWD) est dans `workspace/`, c'est `workspace/` qui devient le `canonicalRepositoryRoot`. A l'inverse, si le terminal est positionne dans `workspace/vendor/nested-repo/`, la resolution s'arretera sur `nested-repo/`. Le terminal a toujours raison.

Regles :

- `canonicalRepositoryRoot` est resolu uniquement en cherchant le `.git` le plus proche au-dessus du `invocationDirectory` ;
- refuser la cible avant Turnlock si le repertoire courant ne permet pas de trouver une racine Git unique en remontant.

---

## 7. Symlink gateways

Cas :

```text
~/.agents/
├── skills/ -> <physical-agent-repo>/skills/
└── AGENTS.md
```

Un gateway peut contenir des dossiers physiques et des symlinks vers des repos
Git reels.

`run-init` ne doit pas supposer que le gateway lui-meme est un repo Git.
Il doit resoudre le work target reel :

- si le target est `~/.agents/`, la resolution Git peut echouer ;
- si le target est `~/.agents/skills/go/`, le symlink peut mener au repo reel ;

Regles :

- `invocationDirectory` peut rester le chemin visible par la session ;
- `canonicalRepositoryRoot` doit pointer vers la racine Git canonique ;
- `symlinkResolved` indique si la resolution a traverse un symlink ;
- un gateway non Git ne doit pas etre accepte comme `canonicalRepositoryRoot`.

---

## 8. Rapport a `workspace-setup`

`workspace-setup` verifie le contexte contre le repo reel.

Responsabilites :

- garantir que `canonicalRepositoryRoot` est un repo Git (par verification ou initialisation) ;
- verifier que la racine Git reelle correspond au contexte parent ;
- detecter `baseBranch` ;
- detecter `baseHeadSha` ;
- detecter `defaultTargetBranch` ;
- verifier que `projectRoot`, s'il existe, est sous le repo ;

---

## 9. Failure modes

- Aucun chemin cible exploitable : `run-init` echoue avant le workflow.
- Aucun repo Git trouve : `run-init` assigne le CWD comme `canonicalRepositoryRoot` et délègue l'initialisation à `workspace-setup`.
- `projectRoot` hors repo : `run-init` echoue.
- Gateway non Git pris comme repo : `run-init` echoue.
- `RepoCapture` invalide : `run-init` echoue sans transition stable.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
