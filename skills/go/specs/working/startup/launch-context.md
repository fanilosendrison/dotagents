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
- les fichiers actifs quand le client les expose ;
- les chemins ouverts dans l'IDE quand le client les expose ;
- les gateways et symlinks connus du harness.

Le parent process doit resoudre un `RepositoryLaunchContext` avant d'appeler
Turnlock.

Inputs typiques :

- `invocationDirectory` : repertoire courant de la session ;
- `activePathRefs` : fichiers ou dossiers actifs pertinents ;
- `repositoryRootHint` : repo explicitement fourni par l'utilisateur ou le
  harness ;
- `projectRootHint` : sous-dossier metier explicitement cible ;
- hints provider : `github`, `gitlab`, `local-only` ;
- hint de branche cible : `main`, `master`, ou autre.

Si le parent process ne peut pas prouver un repo Git cible unique, `/go` echoue
avant `run-init`.

---

## 3. Contrat minimal

`RepositoryLaunchContext` doit contenir :

- le repertoire d'invocation ;
- les chemins actifs utilises pour resoudre la cible ;
- la racine Git canonique cible ;
- le sous-perimetre projet optionnel ;
- les hints provider et branche cible ;
- la methode de resolution ;
- l'horodatage de resolution.

Forme conceptuelle :

```ts
type RepositoryLaunchContext = {
  schema: "go.repository-launch-context.v1";
  invocationDirectory: string;
  activePathRefs: string[];
  repositoryRootHint?: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  providerHint?: "github" | "gitlab" | "local-only";
  remoteNameHint?: string;
  defaultTargetBranchHint?: string;
  resolutionSource:
    | "explicit-user-input"
    | "active-path"
    | "invocation-directory"
    | "parent-session";
  symlinkResolved: boolean;
  resolvedAt: string;
};
```

`canonicalRepositoryRoot` est la racine Git cible. Elle doit etre utilisable par
`workspace-setup` pour creer une branche et un worktree.

`projectRoot` est optionnel. Il represente le sous-dossier metier vise dans un
monorepo. Il ne remplace jamais `canonicalRepositoryRoot`.

---

## 4. Resolution normative

Le parent process resout le contexte dans cet ordre :

1. Utiliser un repo explicitement demande par l'utilisateur ou le harness.
2. Sinon, utiliser les fichiers ou dossiers actifs.
3. Sinon, utiliser le repertoire courant de la session.
4. Normaliser les symlinks connus avant de valider la racine Git.
5. Appeler l'equivalent de `git rev-parse --show-toplevel` depuis le chemin
   cible normalise.
6. Refuser si aucune racine Git unique ne peut etre prouvee.

Le parent process peut transmettre des hints non verifies comme
`defaultTargetBranchHint`. Ces hints ne sont pas autoritatifs. Ils servent a
initialiser l'etat du run et a produire une trace.

`workspace-setup` est la premiere startup task qui verifie ces hints contre le
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

La cible normative est le repo Git le plus proche du work target reel.

Si le fichier actif est dans `vendor/nested-repo/`, le parent process doit
resoudre `canonicalRepositoryRoot` vers `vendor/nested-repo/`, pas vers
`workspace/`.

Si plusieurs chemins actifs pointent vers plusieurs repos Git, le parent process
doit echouer avant `run-init`, sauf si l'utilisateur ou le harness fournit une
cible explicite.

Regles :

- ne pas choisir le repo parent si le work target est dans un repo imbrique ;
- ne pas fusionner plusieurs repos dans un seul run `/go` ;
- refuser les cibles ambigues avant Turnlock ;
- stocker les chemins actifs qui ont servi a la decision.

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
- si le client expose un fichier actif sous un symlink, ce fichier doit etre
  normalise avant validation Git.

Regles :

- `invocationDirectory` peut rester le chemin visible par la session ;
- `canonicalRepositoryRoot` doit pointer vers la racine Git canonique ;
- `activePathRefs` doivent conserver les chemins qui expliquent la decision ;
- `symlinkResolved` indique si la resolution a traverse un symlink ;
- un gateway non Git ne doit pas etre accepte comme `canonicalRepositoryRoot`.

---

## 8. Rapport a `run-init`

`run-init` recoit le `RepositoryLaunchContext` et le persiste dans
`WorkflowState`.

`run-init` ne doit pas :

- appeler `git rev-parse` ;
- verifier que `canonicalRepositoryRoot` existe ;
- verifier que `defaultTargetBranchHint` est vraie ;
- choisir entre `main` et `master` ;
- resoudre un sous-projet ;
- suivre des symlinks.

Ces decisions sont hors de son perimetre.

Si le contexte fourni est absent, incomplet, ou mal forme, `run-init` echoue
avant que Turnlock ne publie une transition stable vers les startup tasks.

---

## 9. Rapport a `workspace-setup`

`workspace-setup` verifie le contexte contre le repo reel.

Responsabilites :

- verifier que `canonicalRepositoryRoot` est un repo Git ;
- verifier que la racine Git reelle correspond au contexte parent ;
- detecter `baseBranch` ;
- detecter `baseHeadSha` ;
- detecter ou corriger `defaultTargetBranch` selon la policy ;
- verifier que `projectRoot`, s'il existe, est sous le repo ;
- refuser si les hints parent contredisent l'etat Git et ne peuvent pas etre
  corriges proprement.

Exemple :

```text
parent hint: defaultTargetBranch = "main"
real repo:   defaultTargetBranch = "master"

workspace-setup either:
  - records the correction and continues if policy allows it
  - fails closed if the mismatch is unsafe
```

---

## 10. Failure modes

- Aucun chemin cible exploitable : `/go` echoue avant `run-init`.
- Aucun repo Git trouve : `/go` echoue avant `run-init`.
- Plusieurs repos Git candidats : `/go` echoue avant `run-init`.
- `projectRoot` hors repo : `/go` echoue avant `run-init`.
- Gateway non Git pris comme repo : `/go` echoue avant `run-init`.
- `RepositoryLaunchContext` invalide : `run-init` echoue sans transition stable.
- Contexte parent contredit Git reel : `workspace-setup` corrige ou echoue
  selon policy.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
