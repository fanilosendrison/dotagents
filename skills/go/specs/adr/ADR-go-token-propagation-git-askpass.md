---
id: ADR-GO-TOKEN-PROPAGATION-GIT-ASKPASS
type: ard
version: "1.0.0"
scope: go-workflow/token-security
status: active
supersedes: []
superseded_by: []
---

# ARD — Propagation securisee du token d'authentification : GIT_ASKPASS + passage explicite

VegaCorp - July 2026

---

## Contexte

Le workflow `/go` manipule un token d'authentification sensible (GitHub PAT,
GitLab PAT) pour deux categories d'operations :

1. **Operations Git** : `clone`, `fetch`, `push` de branches de travail et de
   PRs.
2. **Appels API REST** : creer un depot distant (`workspace-setup`), ouvrir une
   Pull Request (`publish-pr`), lire le statut CI (`pr-ci-review`).

La spec impose que ce token ne soit jamais ecrit sur disque, dans les logs, ou
dans le `WorkflowState` (cf. `provider-config-validation.md` §6.2). Il doit
rester confine en memoire et etre immuable pour la duree du run (cf. §6.3).

La question ouverte est : **comment propager ce token aux taches aval sans
creer de vecteur de fuite ?**

Quatre patterns sont en usage dans l'industrie :

### Pattern A : Variable d'environnement (`GITHUB_TOKEN`)

```bash
GITHUB_TOKEN=ghp_xxx git push
```

**Avantage :** Simple, standard, supporte nativement par les CLI Git et
provider. Utilise par GitHub Actions, GitLab CI, CircleCI et la quasi-totalite
des CI/CD.

**Risque :** Une variable d'environnement est **heritee par tous les processus
enfants**. Si un sous-processus arbitraire (linter, test runner, build tool,
script npm) dump son environnement dans un log ou un crash report (ex: Sentry),
le token fuit. Exemple concret :

```js
// Un script de build innocent qui loggue l'environnement en cas d'erreur
console.error("Build failed", process.env); // → GITHUB_TOKEN=ghp_xxx
```

### Pattern B : `GIT_ASKPASS` (script ephemere)

```bash
GIT_ASKPASS=/tmp/go-askpass-XXXXX.sh git push
# /tmp/go-askpass-XXXXX.sh → echo "ghp_xxx"
```

**Avantage :** Mecanisme natif de Git pour les credentials. Le token n'est
**jamais** dans une variable d'environnement persistante. Il vit uniquement
dans la memoire d'un processus ephemere (le script askpass) qui ecrit sur
stdout et meurt. Utilise par VS Code, IntelliJ, SourceTree et la plupart des
GUI Git.

**Inconvenient :** Ne couvre que les operations Git. Les appels API REST
necessitent un mecanisme complementaire.

### Pattern C : Git credential helper

```bash
git config credential.helper '!f(){ echo "username=token"; echo "password=ghp_xxx"; }; f'
```

**Avantage :** Integre a Git, pas de variable d'environnement, supporte le
caching.

**Inconvenient :** Meme limitation que GIT_ASKPASS (Git uniquement). De plus,
les credential helpers stockent souvent le token dans un keychain persistant
(osxkeychain, libsecret), ce qui est precisement ce que `/go` veut eviter.

### Pattern D : Passage explicite en memoire (parametre de fonction)

```ts
await createRemoteRepo(config, token);
// token est un parametre explicite, jamais dans l'environnement
```

**Avantage :** Zero risque de fuite par l'environnement. C'est le pattern le
plus strict.

**Inconvenient :** Chaque appelant doit explicitement recevoir et transmettre
le token. Pas de support automatique par Git.

---

## Décision

1. **Operations Git → `GIT_ASKPASS`.** Turnlock genere un script ephemere au
   lancement du run et le supprime a la fin. Le script ecrit le token sur
   stdout et ne fait rien d'autre. `GIT_ASKPASS` est positionne comme variable
   d'environnement, mais uniquement pour le chemin vers le script, **pas** pour
   le token lui-meme. Le token n'apparait jamais dans `environ` ou dans
   `/proc/<pid>/environ`.

2. **Appels API REST → Passage explicite.** Le token est transmis en parametre
   de fonction au niveau du client HTTP (ex: header `Authorization: Bearer
   <token>`), sans ecriture dans l'environnement ni dans un fichier temporaire.
   Si une tache a besoin du token, elle le recoit via son `StageInput` ou via
   l'input de la phase Turnlock.

3. **Aucune variable d'environnement `GITHUB_TOKEN` / `GITLAB_TOKEN`.** Ces
   variables ne sont jamais positionnees, meme temporairement. Cela empeche
   toute fuite accidentelle via un sous-processus arbitraire (linter, test
   runner, build, script npm) qui dumperait son environnement.

4. **Cycle de vie du script askpass :**
   - Cree par `run-init` dans `runDir/askpass-<runId>.sh` avec permissions
     `700`.
   - Supprime par Turnlock en fin de run (cleanup normal ou crash).
   - Le fichier ne contient qu'un `echo` du token. Aucune logique,
     conditionnelle, ou appel reseau.
   - Le fichier n'est jamais commite (hors worktree, sous `runDir`).

---

## Conséquences

- **Securite renforcee :** Le token ne peut pas fuiter via un dump
  d'environnement. Les sous-processus incontrolables (linters, test runners,
  outils de build) n'ont aucun acces au token.
- **Separation claire :** Les deux canaux (Git vs API) sont traites par des
  mecanismes distincts et adaptes a leur surface d'attaque respective.
- **Complexite d'implementation legerement accrue :** `workspace-setup` doit
  gerer `GIT_ASKPASS` pour `git push` et le passage explicite pour
  `createRemoteRepo()`. Le cout est faible (un script de 2 lignes, un parametre
  de fonction) et largement compense par le gain de securite.
- **Compatibilite :** `GIT_ASKPASS` est un mecanisme natif Git, disponible sur
  toutes les plateformes, sans dependance externe.
- **Cycle de vie du runDir :** Le script askpass vit dans `runDir/`, deja hors
  worktree et hors repo. Turnlock le nettoie avec le reste du runDir en fin de
  cycle.

---

## Alternatives rejetées

### Variables d'environnement `GITHUB_TOKEN` / `GITLAB_TOKEN`

Rejete pour la raison suivante : dans `/go`, le run execute des sous-processus
arbitraires (linters, tests, builds) definis par le projet cible. Le projet
cible n'est pas sous controle de `/go` et peut contenir n'importe quel code
(npm postinstall, scripts de build, hooks de test). Tout processus heritant de
l'environnement parent peut accidentellement ou malicieusement dumper le token.
`GIT_ASKPASS` + passage explicite confine le token au processus Turnlock et aux
appels API controles, sans exposition aux sous-processus projet.

### Git credential helper

Rejete car les implementations standards (`osxkeychain`, `libsecret`) persistent
le token dans un keychain durable, ce qui contredit l'exigence de stockage
memoire-only sans ecriture sur disque. De plus, le credential helper ne resout
pas le probleme des appels API REST.

### Injection du token dans `StageInput` pour toutes les taches

Partiellement retenu (pour les appels API REST). Non retenu comme mecanisme
unique car les operations Git (`git push`, `git fetch`) ne passent pas par le
`StageInput` — Git lit ses credentials via `GIT_ASKPASS` ou le credential
helper. Le double mecanisme est donc necessaire et assume.

---

## References

- [`provider-config-validation.md`](../working/run-init/provider-config-validation.md) §6.2 — regle de non-divulgation du token.
- [Documentation Git - `GIT_ASKPASS`](https://git-scm.com/docs/gitcredentials#Documentation/gitcredentials.txt-GITASKPASS)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Actions - Security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
