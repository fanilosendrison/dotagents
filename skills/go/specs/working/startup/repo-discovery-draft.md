# Startup branch `repo-discovery-draft`

`repo-discovery-draft` inspecte le checkout source en lecture seule pendant que
`workspace-setup` peut creer le worktree physique prive.

Cette branche produit un brouillon non autoritatif. Elle accelere le demarrage,
mais elle ne definit jamais les gates finales par elle-meme.

---

## 1. Objectif

Produire un `RepositoryDiscoveryDraft` contenant :

- fichiers inspectes ;
- hashes des fichiers inspectes ;
- package manager candidat ;
- lockfiles candidats ;
- commandes mecaniques candidates ;
- capacites provider candidates.

---

## 2. Position dans le demarrage

`repo-discovery-draft` est une startup branch interne a la phase Turnlock
`run-init`.

```text
run-init
├─ run-capture
├─ repo-discovery-draft
└─ workspace-setup
       ↓
project-discovery-finalize
```

`repo-discovery-draft` ne depend pas de `WorkSession`. Le join
`project-discovery-finalize` verifie ensuite le draft contre `worktreeRoot`.

---

## 3. Inputs

- `runId` fourni par Turnlock et stocke par `run-init` ;
- repository source ;
- checkout source ;
- `artefactRoot` reserve par `run-init` ;
- `WorkflowPolicy.discovery`.

---

## 4. Outputs

Artefact metier :

```ts
type RepositoryDiscoveryDraft = {
  schema: "go.repository-discovery-draft.v1";
  id: string;
  runId: string;
  sourceCheckoutRoot: string;
  inspectedAt: string;
  inspectedFiles: InspectedFileRef[];
  candidatePackageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
  candidateLockfiles: string[];
  candidateCommands: CandidateMechanicalCommand[];
  providerCapabilities: ProviderCapabilities;
};
```

---

## 5. Fichiers inspectables

La branche peut inspecter :

- manifestes projet ;
- lockfiles ;
- configs de lint, format, typecheck, test et build ;
- fichiers de workspace ;
- configuration Git remote ;
- scripts declares par le projet.

Elle ne doit pas executer les checks lourds et ne doit pas installer d'outils.

---

## 6. Regles d'autorite

Le draft n'est pas autoritatif parce qu'il est lu depuis le checkout source,
pas depuis le worktree prive du run.

Il devient consommable seulement si `project-discovery-finalize` prouve que les
fichiers inspectes correspondent au worktree prive :

```text
draft inspected package.json hash == worktree package.json hash
draft inspected lockfile hash == worktree lockfile hash
draft inspected config hash == worktree config hash
```

Si les hashes ne correspondent pas, `project-discovery-finalize` relance la
discovery depuis `worktreeRoot` ou echoue ferme selon
`WorkflowPolicy.discovery`.

---

## 7. Operations internes typiques

```text
inspect-source-manifests
inspect-source-lockfiles
inspect-source-package-scripts
inspect-source-provider-capabilities
hash-inspected-files
write-repository-discovery-draft
persist-execution-record
```

---

## 8. Failure modes

- Checkout source introuvable : `errored`.
- Manifestes illisibles : `failed` ou `errored` selon cause.
- Commande candidate non representable en argv : `failed`.
- Evidence hors `artefactRoot` : `errored`.
- Artefact JSON invalide : `errored`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
