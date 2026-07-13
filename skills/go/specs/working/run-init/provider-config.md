# Configuration fournisseur `ProviderConfig`

`ProviderConfig` est une configuration statique fournie une fois a
l'installation de `/go`. Elle ne fait pas partie du `WorkflowState` et ne varie
pas entre les runs.

---

## 1. Objectif

Permettre a `workspace-setup` de connecter automatiquement un nouveau depot
cree via `git init` a un repo distant, sans intervention de l'utilisateur.

Pour les depots deja existants (clones), le remote `origin` est deja configure
et `ProviderConfig` n'est pas necessaire pour ce cas.

---

## 2. Structure

```ts
type ProviderConfig = {
  provider: "github" | "gitlab";
  token: string;
  username: string;
  defaultVisibility: "private" | "public";
  remoteName: "origin";
};
```

| Champ | Description |
|---|---|
| `provider` | Plateforme cible (github.com, gitlab.com) |
| `token` | Token d'authentification API (PAT, token d'acces) |
| `username` | Nom d'utilisateur ou organisation proprietaire du repo |
| `defaultVisibility` | Visibilite par defaut des nouveaux repos (private recommande) |
| `remoteName` | Nom du remote Git (`"origin"` par defaut, fixe) |

---

## 3. Stockage

`ProviderConfig` est stocke hors de tout projet, dans la configuration
globale de `/go` (ex: `~/.go/config.json`). Il n'est jamais ecrit dans
`WorkflowState`, les artefacts du run, ou le worktree.

Le token est sensible : le fichier de config est en `.gitignore` global et ses
permissions sont `600`.

---

## 4. Utilisation par `workspace-setup`

Quand `workspace-setup` initialise un nouveau depot (`git init`) :

1. Creer le repo distant via l'API du provider :
   - GitHub : `POST https://api.github.com/user/repos`
   - GitLab : `POST https://gitlab.com/api/v4/projects`
   - Corps : `{ name: basename(canonicalRepositoryRoot), private: true/false }`
   - Header : `Authorization: Bearer <token>`
2. Ajouter le remote : `git remote add origin <url-retournee-par-API>`
3. Pousser : `git push -u origin main`

Si `ProviderConfig` est absent alors qu'un `git init` est necessaire,
`workspace-setup` echoue avec `errored`.

---

## 5. Non-goals

- Gerer plusieurs providers simultanement (v1 = un seul provider)
- Faire tourner les tokens
- Creer des repos dans des organisations (v1 = compte utilisateur uniquement)
- Supporter autre chose que GitHub et GitLab

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
