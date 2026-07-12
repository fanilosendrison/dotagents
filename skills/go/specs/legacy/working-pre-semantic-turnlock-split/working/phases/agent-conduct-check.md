# Agent Conduct — Règles de processus pendant l'implémentation

Ce document ne concerne pas le **code produit** (couvert par `ideal-review.md`) mais
le **comportement de l'agent pendant qu'il travaille**. L'agent laisse des traces
en dehors du code — certaines sont des vulnérabilités durables, invisibles à
une review de code classique.

---

## Pourquoi ce document existe

La review de code vérifie l'état **final** du filesystem (fichiers versionnés,
tests, spec). Mais le chemin emprunté pour y arriver laisse des résidus que la
review ne voit pas :

- Une clé API passée en argument de `curl` → elle est dans l'historique shell
- Un `export SECRET=...` → il est dans l'environnement de la session
- Un fichier temporaire `/tmp/token` → il reste sur le disque
- Un `git push --force` → il écrase le travail d'un autre sans trace dans le diff

Ces traces sont **invisibles** dans le code final, et **persistantes** après la fin
de la session.

---

## Principes

1. **Fail-closed** : toute violation d'une règle est un événement bloquant.
2. **Zéro secret en clair** : aucun secret (token, clé, mot de passe) ne doit
   transiter en clair dans une commande shell, un fichier non protégé, ou une
   variable d'environnement persistante.
3. **Cleanup obligatoire** : tout fichier temporaire créé par l'agent doit être
   détruit avant la fin de la session (`agent_settled`).
4. **Moindre privilège** : toute opération sur le filesystem ou le réseau doit
   utiliser les permissions et les précautions minimales nécessaires.
5. **Artefact vérifiable** : la conduite de l'agent est une gate du pipeline
   `/go`. Chaque violation produit une finding structurée de dimension
   `agent-conduct` dans le contrat `go-pipeline-contract.md`.

---

## Règles

### 1. Secrets : jamais en ligne de commande

**Interdit** :
```bash
curl -H "Authorization: Bearer sk-xxx" https://api.example.com
```

**Correct** : passer le secret via stdin, un fichier temporaire protégé, ou une
variable d'environnement limitée au process enfant :

```bash
# Option A : fichier temporaire protégé
echo "sk-xxx" > /tmp/.secret_token
chmod 600 /tmp/.secret_token
curl -H @<(echo "Authorization: Bearer $(cat /tmp/.secret_token)") https://api.example.com
shred -u /tmp/.secret_token

# Option B : variable éphémère
SECRET="sk-xxx" curl -H "Authorization: Bearer $SECRET" https://api.example.com
# SECRET n'existe que pour ce processus
```

**Pourquoi** : les arguments de commande sont visibles dans `/proc/<pid>/cmdline`
et dans l'historique shell (`.bash_history`, `.zsh_history`). Un secret passé en
argument est une fuite permanente.

### 2. Secrets : jamais dans l'environnement global

**Interdit** :
```bash
export OPENAI_API_KEY="sk-xxx"
```

**Correct** : passer la variable uniquement au process qui en a besoin, et jamais
la persister dans l'environnement du shell parent :

```bash
OPENAI_API_KEY="sk-xxx" command
# ou via un fichier .env chargé dynamiquement et non versionné
```

**Pourquoi** : une variable exportée est héritée par tous les process enfants
de la session. Un sous-process légitime peut logger l'environnement, ou un
process malveillant peut le lire.

### 3. Fichiers temporaires : cleanup obligatoire

**Règle** : tout fichier créé par l'agent hors du working tree doit être :

- Créé dans un répertoire dédié (ex: `.pi/tmp/` ou `/tmp/<session-id>/`)
- Avec les permissions minimales (`chmod 600` pour les fichiers contenant des
  secrets ou des données sensibles)
- Détruit (`shred -u` pour les secrets, `rm` sinon) avant la fin de la session

**Interdit** :
```bash
echo "sk-xxx" > /tmp/token
# ... oubli de cleanup
```

**Correct** :
```bash
mkdir -p /tmp/session-XXXX
echo "sk-xxx" > /tmp/session-XXXX/token
chmod 600 /tmp/session-XXXX/token
# ... utilisation
shred -u /tmp/session-XXXX/token
rmdir /tmp/session-XXXX
```

**Pourquoi** : `/tmp` est accessible à tous les utilisateurs. Un fichier
temporaire non nettoyé est un secret persistant sur le disque.

### 4. Secrets : jamais dans un fichier non protégé

**Règle** : si un secret doit être écrit sur disque (fichier `.env` temporaire,
fichier de config), il doit :

- Être dans un fichier avec permissions `600`
- Être dans un répertoire non versionné (`.gitignore` vérifié)
- Être détruit après usage

**Pourquoi** : même avec `600`, un fichier sur disque peut être lu par un
processus avec les mêmes privilèges. La durée de vie du secret sur disque doit
être la plus courte possible.

### 5. Pas de `curl | bash`

**Interdit** :
```bash
curl -sSL https://example.com/install.sh | bash
```

**Correct** :
```bash
# Option A : télécharger, auditer, exécuter
curl -sSL https://example.com/install.sh -o /tmp/install.sh
# lire /tmp/install.sh pour audit
bash /tmp/install.sh
rm /tmp/install.sh

# Option B : utiliser le package manager
bun install <package>  # ou npm, pip, cargo, etc.
```

**Pourquoi** : `curl | bash` exécute du code arbitraire sans audit préalable,
avec les privilèges de l'utilisateur. Même un script signé peut être compromis
si le serveur est compromis.

### 6. Pas de `chmod 777`

**Interdit** :
```bash
chmod 777 fichier
# ou chmod -R 777 répertoire
```

**Correct** : utiliser les permissions minimales nécessaires.
```bash
chmod 644 fichier   # lecture pour tous, écriture pour le propriétaire
chmod 600 fichier   # lecture/écriture pour le propriétaire uniquement
chmod 755 script    # exécution pour tous, écriture pour le propriétaire
```

**Pourquoi** : `777` donne des droits d'écriture et d'exécution à tout le monde.
Si le fichier contient du code exécutable, n'importe quel utilisateur peut le
modifier et exécuter du code arbitraire sous l'identité de la victime.

### 7. Pas de `git push --force` sans flag explicite

**Règle** : le force push ne doit être utilisé que si l'utilisateur l'a
explicitement demandé, et uniquement sur une branche personnelle.

**Pourquoi** : un force push écrase l'historique distant. Sur une branche
partagée, il peut écraser silencieusement le travail d'un autre contributeur.

### 8. Pas de secrets dans les messages de commit ou les logs

**Interdit** :
```bash
git commit -m "fix: update token to sk-xxx"
console.log("Using API key: " + apiKey)
```

**Correct** :
```bash
git commit -m "fix: rotate API token"
# Les logs ne contiennent jamais de secrets. Logger l'ID du secret, pas sa valeur.
```

**Pourquoi** : les messages de commit sont immuables dans l'historique git.
Les logs sont souvent stockés et indexés. Un secret dans un log ou un commit
est une fuite permanente.

### 9. Pas d'installation globale sans nécessité

**Règle** : préférer les installations locales au projet (`bun install`,
`pip install --user`) aux installations globales (`npm install -g`,
`pip install` system-wide).

**Pourquoi** : une installation globale affecte tous les projets et peut
introduire des conflits de version ou des vulnérabilités partagées.

### 10. Pas d'outils de debug en production ou persistants

**Interdit** :
```bash
node --inspect=0.0.0.0:9229 app.ts
# ou laisser un port debug ouvert après usage
```

**Pourquoi** : un port debug ouvert sans authentification permet l'exécution
de code arbitraire à distance.

---

## Check-list pour l'agent

Avant `agent_settled`, vérifier :

- [ ] Aucun secret dans l'historique shell (`history | grep -E '(sk-|Bearer|token|key|secret|password)'`)
- [ ] Aucune variable d'environnement exportée contenant un secret (`env | grep -E '(SECRET|TOKEN|KEY|PASSWORD)'`)
- [ ] Tous les fichiers temporaires sont nettoyés (`ls /tmp/session-*`, `ls /tmp/.secret_*`)
- [ ] Aucun fichier `.env` ou de config avec des secrets n'est dans le working tree
- [ ] Aucun `chmod 777` n'a été appliqué (`find . -perm 0777`)
- [ ] Aucun secret dans la staging area (`git diff --cached | grep -E '(sk-|Bearer|token|key|secret|password)'`)
- [ ] Pas de processus debug laissé ouvert (`ps aux | grep -E '(--inspect|--debug)'`)

Dans le pipeline `/go`, cette check-list devient la phase déterministe
`agent-conduct-check`. Elle s'exécute après toute phase qui a pu modifier le
filesystem : implémentation initiale, fix de lint/typecheck/tests, remediation de
review, et application des paquets Git. Un échec est `Bloquant` par défaut car il
concerne des traces persistantes hors diff.

---

## Référence

- `ideal-review.md` — les 13 dimensions de la review du **code produit**
- `go-pipeline-contract.md` — contrat JSON et phases canoniques du pipeline `/go`
- Ce document — les règles de conduite du **processus d'implémentation**
