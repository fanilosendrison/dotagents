# Launch context parent avant `run-init`

Ce document definit le contexte que le parent process doit resoudre avant de
lancer Turnlock.

`run-init` ne decouvre rien. Il ne lance pas `git`, ne choisit pas le repo
cible, ne verifie pas la branche par defaut et ne resout pas les symlinks. Il
stocke seulement un contexte de lancement deja resolu par le parent process.

---

## 1. Objectif

Avant `run-init`, le parent process doit produire un
`RepositoryLaunchContext`.

Ce contexte repond a une question precise :

```text
Quel repo Git et quel sous-perimetre projet ce run /go cible-t-il ?
```

Il existe avant Turnlock pour eviter que `run-init` devienne une phase de
discovery. `run-init` reste purement mecanique :

```text
parent process resolves RepositoryLaunchContext
-> parent process starts Turnlock with GoBootstrapState
-> run-init stores it without Git verification
-> workspace-setup verifies it against real Git state
```

---

## 2. Responsabilite du parent process

Le parent process est l'agent ou le harness qui recoit le `/go` dans la session.
Il connait deja :

- le contexte de session ;
- le prompt utilisateur ;
- le repertoire courant ou workspace courant ;
- les gateways et symlinks connus du harness.

Le parent process doit resoudre un `RepositoryLaunchContext` avant d'appeler
Turnlock, puis lancer Turnlock avec :

- un `GoBootstrapState` contenant `RepositoryLaunchContext`, `WorkflowPolicy`,
  et `CaptureContext` ;
- un `runDirRoot` hors du repo cible ;
- aucun `--run-id` externe, sauf s'il est deja un ULID Turnlock valide.

Inputs typiques :

- `invocationDirectory` : repertoire courant de la session (l'unique source de verite pour la cible) ;

Si le parent process ne peut pas prouver un repo Git cible unique, `/go` echoue
avant `run-init`.

Si le parent process ne peut pas configurer un `runDirRoot` hors de
`canonicalRepositoryRoot`, `/go` echoue avant Turnlock. `run-init` verifiera
encore le containment de `runDir`, mais il ne peut pas deplacer une enveloppe
runtime deja creee.

---

## 3. Contrat minimal

`RepositoryLaunchContext` doit contenir :

- le repertoire d'invocation ;
- la racine Git canonique cible ;
- le sous-perimetre projet optionnel ;
- l'horodatage de resolution.

Forme conceptuelle :

```ts
type RepositoryLaunchContext = {
  schema: "go.repository-launch-context.v1";
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

Le parent process resout le contexte en utilisant strictement le repertoire courant (`invocationDirectory`) :

1. Utiliser le repertoire courant de la session comme unique point de depart.
2. Normaliser les symlinks connus.
3. Chercher le répertoire `.git` le plus proche en remontant depuis ce chemin cible normalisé.
4. Si un dépôt est trouvé, `canonicalRepositoryRoot` est ce dépôt. Sinon, `canonicalRepositoryRoot` devient le répertoire d'invocation (CWD).

Les demandes explicites de l'utilisateur ne doivent jamais court-circuiter cette regle. Le repo cible est **toujours** defini par le CWD.

`workspace-setup` est la premiere startup task qui verifie l'etat du
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

Le parent process ne doit pas supposer que le gateway lui-meme est un repo Git.
Il doit resoudre le work target reel :

- si le target est `~/.agents/`, la resolution Git peut echouer ;
- si le target est `~/.agents/skills/go/`, le symlink peut mener au repo reel ;

Regles :

- `invocationDirectory` peut rester le chemin visible par la session ;
- `canonicalRepositoryRoot` doit pointer vers la racine Git canonique ;
- `symlinkResolved` indique si la resolution a traverse un symlink ;
- un gateway non Git ne doit pas etre accepte comme `canonicalRepositoryRoot`.

---

## 8. Rapport a `run-init`

`run-init` recoit le `RepositoryLaunchContext` et le persiste dans
`WorkflowState`.

Plus precisement, `RepositoryLaunchContext` arrive dans `GoBootstrapState`.
`run-init` lit ce bootstrap snapshot durable, valide sa forme, calcule les hashes
JCS, puis produit le `WorkflowState` complet.

Le noyau bootstrap de `run-init` ne doit pas :

- appeler `git rev-parse` ;
- verifier que `canonicalRepositoryRoot` existe ;
- choisir entre `main` et `master` ;
- resoudre un sous-projet ;
- suivre des symlinks.

Ces decisions sont hors de son perimetre direct. Elles sont verifiees plus tard
par la startup task interne `workspace-setup`.

Si le contexte fourni est absent, incomplet, ou mal forme, `run-init` echoue
avant que les startup tasks internes ne puissent produire une evidence
autoritative.

---

## 9. Rapport a `workspace-setup`

`workspace-setup` verifie le contexte contre le repo reel.

Responsabilites :

- verifier que `canonicalRepositoryRoot` est un repo Git ;
- verifier que la racine Git reelle correspond au contexte parent ;
- detecter `baseBranch` ;
- detecter `baseHeadSha` ;
- detecter `defaultTargetBranch` ;
- verifier que `projectRoot`, s'il existe, est sous le repo ;

---

## 10. Failure modes

- Aucun chemin cible exploitable : `/go` echoue avant `run-init`.
- Aucun repo Git trouve : Le parent process assigne le CWD comme `canonicalRepositoryRoot` et délègue l'initialisation à `workspace-setup`.
- Plusieurs repos Git candidats : `/go` echoue avant `run-init`.
- `projectRoot` hors repo : `/go` echoue avant `run-init`.
- Gateway non Git pris comme repo : `/go` echoue avant `run-init`.
- `RepositoryLaunchContext` invalide : `run-init` echoue sans transition stable.
- Contexte parent contredit Git reel : `workspace-setup` corrige ou echoue
  selon `WorkflowPolicy.launchContextMismatch`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
