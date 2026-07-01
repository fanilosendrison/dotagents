# Spécification : git-commits-push-TL

Ce document décrit le workflow de la version robuste et mécanisée du processus d'analyse, de commit et de push de modifications sur plusieurs dépôts (/Users/famillesendrison/.agents/skills/git-commits-push/SKILL.md). Il utilise l'orchestrateur Turnlock (/Users/famillesendrison/Developper/Projects/VegaCorp/turnlock) pour diviser le travail en phases claires. L'objectif est de réduire au maximum la charge cognitive et le temps d'exécution de l'agent IA, en mécanisant le workflow étape par étape.

## Architecture Globale (Boucle Turnlock)
Le processus est conçu autour d'une exécution hautement parallélisée : une phase de découverte initiale (Phase 1) retourne la liste globale des dépôts modifiés. Ensuite, les **Phases 2 à 4 s'exécutent de manière asynchrone et strictement en parallèle** (workers indépendants) pour tous les dépôts de la liste. 
Le temps d'exécution total du workflow (même pour 10 dépôts) correspond donc simplement au temps de traitement du dépôt le plus lent.

---

## Phase 1 : Découverte des changements (Discovery)

**Objectif :** Identifier instantanément l'ensemble des dépôts Git contenant des modifications non commitées. C'est une phase purement mécanique.

### Step 1.1 : Scan du périmètre
- Le script lit un fichier de configuration `settings.json` (situé dans le dossier de la skill) pour récupérer la liste des chemins racines à scanner. *(Fallback par défaut si absent : `["~/Developper/Projects"]`)*
- Le script parcourt ensuite dynamiquement les sous-dossiers des chemins configurés.

### Step 1.2 : Vérification de l'état Git
- Pour chaque dépôt trouvé, exécuter mécaniquement `git status --porcelain`.
- Conserver uniquement les dépôts ayant des changements (fichiers modifiés, ajoutés, non trackés ou supprimés).

### Step 1.3 : Génération de l'Output
- Produire une liste structurée (JSON) en mémoire contenant les chemins absolus des dépôts "sales". Cette liste alimente les workers de l'orchestrateur pour la Phase 2.

---

## Phase 2 : Validation et Extraction du Diff (Mécanique)

**Objectif :** Pour un dépôt spécifique, préparer un contexte "propre" et sécurisé pour le LLM.

### Step 2.1 : Validation Standardisée (Tests)
*(Si `skipTests: true` dans `settings.json`, cette étape est ignorée).*
Le script identifie et exécute la suite de tests via une cascade de résolution stricte :
1. **Vérification de `STACK_EVAL.yaml`** : 
   - Si le fichier **existe**, extraire `decisions.test_runner`.
     - `vitest` -> `bun x vitest run`
     - `pytest` -> `pytest`
     - `bun test` -> `bun test`
     - `none` -> ignorer l'étape de test.
   - Si le fichier **n'existe pas** (ou ne contient pas de champ `test_runner`), passer à la règle 2.
2. **Vérification de `package.json`** : 
   - Si le fichier **existe** ET que la clé `scripts.test` y est définie, exécuter selon le lockfile :
     - `bun.lock` ou `bun.lockb` -> `bun run test`
     - `pnpm-lock.yaml` -> `pnpm run test`
     - `yarn.lock` -> `yarn run test`
     - `package-lock.json` (ou aucun lockfile) -> `npm run test`
   - Si le fichier **n'existe pas** (ou n'a pas de clé `test`), passer à la règle 3.
3. **Auto-découverte (Fichiers de tests)** : 
   - Si des fichiers `*.test.ts`, `*.spec.ts` ou `*.test.js` sont présents -> `bun test`
   - Si des fichiers `test_*.py` ou `*_test.py` sont présents -> `pytest`
   - Si aucun de ces patterns n'est trouvé, passer à la règle 4.
4. **Fallback** : 
   - Aucune suite de test n'a pu être identifiée dans ce dépôt. L'étape de test est ignorée.

*Action de blocage : Si la commande de test exécutée échoue, le processus Turnlock est immédiatement interrompu pour ce dépôt, et l'échec est tracé pour le rapport final de la Phase 5.*

### Step 2.2 : Extraction du Diff
- Capturer le diff complet des changements via Git (`git status` + `git diff` et/ou `git diff --cached`).

### Step 2.3 : Scan de Sécurité
- Analyser le diff extrait au Step 2.2 en important le module central (ex: `scanDiff`) du projet `secret-scanner`.
- *Action de blocage : Si un secret est détecté, le processus est interrompu pour ce dépôt, et une alerte de sécurité est tracée pour le rapport final de la Phase 5.*

### Step 2.4 : Formatage du Payload
- Construire un objet structuré contenant le diff brut validé et les métadonnées du dépôt, à destination du LLM.

---

## Phase 3 : Analyse et Rédaction du Commit (LLM)

**Objectif :** Rédiger un message de commit sémantique. C'est la **seule** phase nécessitant le LLM, exécutée via le protocole agnostique de délégation Turnlock.

### Step 3.1 : Délégation au Host (Cession de contrôle)
- Le script Turnlock s'interrompt volontairement. Il émet sur la sortie standard le tag `@@TURNLOCK@@` avec l'action `DELEGATE` et le `kind: "agent"`.
- Il lit le fichier Markdown défini par `systemPromptPath` dans `settings.json` pour récupérer les instructions système de l'IA.
- Il génère un fichier `manifest.json` qui mappe parfaitement aux besoins de l'API LLM : le fournisseur (`provider`), le modèle (`model`), les instructions (`systemPrompt`) et le diff brut (`userPrompt`), ainsi que le chemin cible attendu (`resultPath`).

### Step 3.2 : Inférence Isolée via `@fanilosendrison/llm-runtime` (Consumer Pi)
- Un wrapper dédié à l'environnement Pi (`pi-orch-git-commits-push`) intercepte le tag `@@TURNLOCK@@`.
- Ce wrapper délègue l'inférence à la librairie interne `@fanilosendrison/llm-runtime`.
- Le wrapper isole sa logique d'authentification dans un **Module Séparé (Auth Resolver)**. Ce module implémente un **Pipeline de Résolution** pour le token d'API, garantissant sa réutilisabilité pour de futurs wrappers Pi :
  1. Il vérifie d'abord les variables d'environnement standards (ex: `process.env.ANTHROPIC_API_KEY`), permettant une utilisation "Vanilla Pi" plug-and-play.
  2. En fallback, il lit le fichier spécifique à Pi : `~/.pi/agent/auth.json`.
  3. Si la valeur trouvée commence par `!` (ex: `!doppler secrets get...`), il l'exécute de façon dynamique et sécurisée en sous-processus (Standard VegaCorp). Sinon, il l'utilise comme une clé brute.
- L'appel est effectué de manière "stateless" avec `stripJsonFence: true` pour garantir un retour JSON propre, évitant ainsi de polluer le contexte de l'agent principal.

### Step 3.3 : Reprise de l'exécution (Resume)
- Le wrapper (Consumer) écrit l'output de l'inférence (un objet JSON strict contenant la liste des commits) dans le `resultPath` défini. En cas d'échec fatal de l'API (ex: Rate Limit persistant), il écrit une erreur explicite.
- Le Consumer relance mécaniquement le script avec la commande `--resume` pour que Turnlock lise les résultats et trace les éventuels échecs pour la Phase 5.

---

## Phase 4 : Commit et Push (Mécanique)

**Objectif :** Enregistrer les commits générés et les envoyer sur GitHub de manière mécanique.

### Step 4.1 : Exécution des Commits
- Le script lit le JSON du Step 3.2 et exécute automatiquement les commandes `git commit` appropriées.

### Step 4.2 : Exécution du Push
*(Si `autoPush: false` dans `settings.json`, cette étape est ignorée).*
- Le script exécute `git push` (ou `git push -u origin <branch>` si pas d'upstream).
- Capturer les éventuelles erreurs réseau (ex: timeout, rejet de branche) pour les intégrer au rapport final de la Phase 5 (destiné à l'agent).

---

## Phase 5 : Rapport d'Exécution (Reporting)

**Objectif :** Informer l'agent principal (qui a déclenché l'outil) du résultat global des opérations.

### Mécanisme de Traçabilité FSM (Internal State)
Pour garantir la persistance des erreurs à travers les phases (et notamment la mort du processus en Phase 3), Turnlock maintient un dictionnaire d'état interne pour chaque Worker :
1. **Phase 2 (Tests/Sécurité) :** Turnlock écrit en mémoire (et sérialise sur disque avant le `yield`) les erreurs (ex: `status: "FAILED"`).
2. **Phase 3 (LLM) :** Au `--resume`, Turnlock lit le `result.json`. S'il y trouve une clé `"error"`, il met à jour le dictionnaire interne.
3. **Phase 4 (Push) :** Turnlock intercepte les exceptions `git push` et met à jour le dictionnaire en mémoire.

### Step 5.1 : Synthèse des logs (stdout)
- En bouclant sur son dictionnaire d'état finalisé, Turnlock génère un rapport final textuel dans le terminal (stdout) (voir contrat de données *4. Le Rapport Final*).
- Ce rapport liste les dépôts poussés avec succès (`✅`), et explicite clairement les échecs (`❌`) avec leur cause exacte.
- C'est en lisant cette sortie finale (et uniquement celle-là) que l'agent conversationnel principal comprend ce qu'il s'est passé, et peut en informer l'utilisateur ou proposer des corrections.

---

## Contrats de Données (JSON Schemas)

Pour garantir la stabilité du FSM tout au long des phases, les schémas JSON suivants doivent être strictement respectés.

### 1. Fichier de Configuration (`settings.json`)
Lu par Turnlock en Phase 1.1 pour définir dynamiquement les répertoires racines à scanner.
```json
{
  "searchPaths": [
    "~/Developper/Projects",
    "~/Documents/Scripts"
  ],
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.2,
  "systemPromptPath": "./prompt.md",
  "autoPush": true,
  "skipTests": false
}
```

### 2. Liste des Dépôts Sales (Output Phase 1)
Tableau en mémoire généré par Turnlock au Step 1.3 pour alimenter les workers de la Phase 2.
```json
[
  "/Users/famillesendrison/Developper/Projects/repoA",
  "/Users/famillesendrison/Developper/Projects/repoB"
]
```

### 3. Le `manifest.json` (Input pour le Wrapper)
Généré par Turnlock en Phase 3.1. Il s'agit d'un tableau contenant les requêtes pour tous les dépôts à traiter en parallèle.
```json
[
  {
    "id": "repo-dotagents",
    "repository": "/Users/famillesendrison/.agents",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.2,
    "systemPrompt": "Tu es un expert Git. Génère des commits pour ce diff...",
    "userPrompt": "diff --git a/file.txt b/file.txt\n+ ajout de la feature X..."
  },
  {
    "id": "repo-dotpi",
    "repository": "/Users/famillesendrison/.pi",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.2,
    "systemPrompt": "Tu es un expert Git...",
    "userPrompt": "diff --git a/main.ts b/main.ts\n+ ..."
  }
]
```
*(Note : Turnlock indique généralement le `resultPath` global où le wrapper doit écrire la réponse sous forme d'argument ou dans un objet racine).*

### 4. Le `result.json` (Output de l'Inférence)
Généré par le Wrapper en Phase 3.3 et lu par Turnlock en Phase 4. Il doit obligatoirement mapper les résultats aux `id` du manifest. En cas d'échec fatal du LLM, une clé `error` remplace `commits`.
```json
[
  {
    "id": "repo-dotagents",
    "commits": [
      {
        "type": "feat",
        "scope": "agent",
        "description": "ajout de la feature X pour améliorer les performances",
        "body": "Détails optionnels...",
        "isBreaking": false
      }
    ]
  },
  {
    "id": "repo-dotpi",
    "error": "Échec fatal API: Rate Limit persistant après 5 retries"
  }
]
```

### 5. Le Rapport Final (Output Phase 5)
Texte brut (stdout) généré par Turnlock à la fin de l'exécution, conçu pour être lu et compris par l'Agent Principal. Il est la représentation textuelle du dictionnaire d'état interne de Turnlock.
```text
=== TURNLOCK EXECUTION REPORT ===

✅ [repo-dotagents] Commit et Push réussis.
❌ [repo-dotpi] Tests échoués (Phase 2). Dépôt ignoré.
❌ [repo-llm-runtime] Erreur réseau git push (Phase 4).

=================================
```
