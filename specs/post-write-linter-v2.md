# Post-Write Linter v2 — Lint qualité en fin de cycle avec délégation agent

## Statut

**Spec** — non implémenté. Document de décision issu de la session du 2026-07-10.

---

## 1. Problème

### État actuel (v1)

L'extension Pi `post-write-linter.ts` et ses homologues Claude Code / Codex exécutent `biome format --write` après chaque `Write`/`Edit`. Cela vérifie **uniquement** :

- La parseabilité du fichier (erreurs de syntaxe)
- Le formatage (auto-corrigé silencieusement)

Ce qui **n'est pas vérifié** : les règles de qualité Biome (`lint`), par exemple :

- Imports inutilisés (`noUnusedImports`)
- Utilisation de `var` au lieu de `const` (`noVar`)
- Complexité cyclomatique excessive
- Conventions de nommage

### Pourquoi c'est un problème

L'agent peut produire du code syntaxiquement valide mais qui viole les règles de qualité du projet. Ces violations ne sont détectées que plus tard (en CI, par un humain), alors qu'elles pourraient être corrigées automatiquement dans la même session.

---

## 2. Approche retenue : deux phases

| Phase | Quand | Quoi | Comportement |
|-------|-------|------|-------------|
| **Phase 1** (existante) | Pendant le cycle, après chaque `Write`/`Edit` | `biome format --write` (syntaxe + format) | Bloque sur erreur de syntaxe. Silencieux si le format est juste corrigé. |
| **Phase 2** (nouvelle) | En fin de cycle, sur `agent_settled` | `biome lint` (règles de qualité) | Si erreurs → délègue la correction à un agent (potentiellement différent du modèle principal), avec retry et fallback. |

### Justification

- **Une erreur de syntaxe n'est jamais intentionnelle.** L'agent ne planifie pas d'écrire du code cassé. Bloquer immédiatement évite de construire sur une fondation invalide.
- **Les règles de qualité sont une autre catégorie.** Elles peuvent être corrigées en bloc à la fin sans perturber le flux créatif de l'agent.
- **`format --write` ne fait pas de résolution inter-fichiers.** Il parse chaque fichier isolément — pas de risque de bloquer sur « le fichier B importe A qui n'existe pas encore ».

---

## 3. Événement déclencheur : `agent_settled`

### Pourquoi `agent_settled` et pas `agent_end`

`agent_end` est un événement bas niveau qui peut se déclencher **plusieurs fois pour une seule tâche utilisateur** (auto-retry, auto-compact, follow-up). Exemple :

```
1. Agent écrit du code → agent_end ① (code cassé, test failed)
2. Pi auto-retry → agent corrige → agent_end ② (code OK)
3. Pas de follow-up → agent_settled ③
```

Déclencher le lint sur `agent_end` ① lancerait un lint sur du code en transition, avec des faux positifs et un risque d'interférence avec le retry automatique.

`agent_settled` garantit que **Pi est vraiment au repos** et que le code est dans son état final.

**Définition exacte** (doc Pi) :

> `agent_end` fires when a low-level agent run ends, but Pi may still auto-retry, auto-compact and retry, or continue with queued follow-up messages. Use `agent_settled` for status integrations that need to know Pi will not continue running automatically.

### Pi recommence tout seul sur le follow-up

Quand Turnlock termine avec succès ou que l'extension injecte un `sendUserMessage({ deliverAs: "followUp" })`, Pi relance automatiquement un cycle agent. Chaque fin de cycle redéclenche `agent_settled`. C'est ce mécanisme qui permet la boucle de correction automatique — mais il nécessite les gardes anti-boucle infinie décrites ci-dessous.

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Pi Extension (post-write-linter.ts)                       │
│                                                          │
│  Phase 1 : tool_result → checkFile() → format --write    │
│                                                          │
│  Phase 2 : agent_settled → biome lint                    │
│             → clean ? rien                                │
│             → erreurs ? lance le pipeline Turnlock        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ Turnlock FSM (lint-fix.orchestrator.ts)                   │
│                                                          │
│  phase:check_lint  → exécute biome lint                  │
│    → clean → DONE                                        │
│    → erreurs → classifie par kind, décide retry/fallback │
│    → DELEGATE { agentType, model, prompt }               │
│                                                          │
│  phase:fix_lint → consomme result.json                   │
│    → retourne à check_lint                               │
│                                                          │
│  stdout: @@TURNLOCK@@ DELEGATE ... @@END@@               │
└──────────────────────┬───────────────────────────────────┘
                       │ pipe
                       ▼
┌──────────────────────────────────────────────────────────┐
│ Agent Bridge (turnlock-to-agent-bridge.ts)                │
│                                                          │
│  Lit les blocs TURNLOCK sur stdin.                       │
│  Pour chaque DELEGATE :                                  │
│    → spawn un agent headless (Claude Code, Pi, Codex)    │
│      avec le modèle demandé (Haiku, Sonnet, GPT-4o…)     │
│    → l'agent bosse multi-turn (read → edit → bash)       │
│    → attend qu'il termine                                │
│    → écrit result.json                                   │
│  Relance l'orchestrateur avec --resume.                  │
│                                                          │
│  Le bridge ne prend AUCUNE décision.                     │
│  Il ne fait qu'exécuter ce que Turnlock délègue.         │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Patterns de retry et fallback (inspirés de git-commits-push)

### 5.1 Classification des erreurs par `kind`

Chaque type d'erreur a son **propre budget de retry**, indépendant des autres.

| Kind | Signification | Budget |
|------|--------------|--------|
| `lint_rule` | Violation d'une règle de qualité Biome (ex: `noUnusedImports`) | 2 |
| `parse_error` | Biome n'a pas pu parser le fichier (ne devrait pas arriver après Phase 1, mais sécurité) | 1 |
| `tool_error` | Biome lui-même a crashé ou est indisponible | 1 |

Une erreur `parse_error` ne consomme pas le budget `lint_rule`, et vice versa.

### 5.2 Fallback model

Si le modèle principal échoue à corriger les erreurs `lint_rule` après avoir épuisé son budget (2 tentatives), Turnlock **escalade** vers un modèle de fallback (ex: Haiku → Sonnet).

Conditions (reprises de `fallback-model.ts` dans git-commits-push) :
- Le kind doit être `lint_rule` (pas de fallback pour `parse_error` ou `tool_error`)
- Le fallback n'a pas déjà été tenté (`fallbackAttempted === false`)
- Le budget normal est épuisé (`attemptCount >= 2`)
- Un `fallbackProvider` et `fallbackModel` sont configurés

Le budget est **reset** pour le fallback : le modèle secondaire repart avec un compteur à zéro.

Le bridge, lui, ne sait pas qu'il y a un fallback. Il reçoit juste un `agentType` et un `model` différent dans le manifest de délégation — il spawn l'agent demandé, point.

### 5.3 Loop detection

Avant chaque délégation, Turnlock calcule un hash de la sortie normalisée de `biome lint` :

```typescript
const normalizedErrors = biomeErrors.map(e => ({
  file: e.file,
  line: e.line,
  rule: e.rule,
}));
const errorHash = sha256(JSON.stringify(normalizedErrors));
```

Si `errorHash === state.lastErrorHash` sur deux checks consécutifs → **loop detected** → abandon immédiat (pas de retry supplémentaire). L'agent a patiné et n'a rien changé.

Ce qui est **exclu** du hash (non déterministe ou bruit) :
- Le message descriptif (redondant avec `rule`)
- La colonne (trop sensible, le moindre reformat la change)
- Les couleurs ANSI et décorations
- Le flag `FIXABLE` (non déterministe selon la config)

Ce qui est **inclus** dans le hash :
- `file` — si le fichier a changé, l'erreur a bougé
- `line` — si l'agent a modifié le fichier, la ligne peut changer même si l'erreur persiste
- `rule` — le type d'erreur

### 5.4 Feedback history

À chaque retry, l'agent reçoit l'historique de ses échecs précédents pour ajuster sa stratégie :

```typescript
const feedbackHistory = state.feedbackHistory ?? [];
// Chaque entrée = sortie biome du check précédent
const prompt = `
Corrige ces erreurs Biome :

${formatCurrentErrors(errors)}

Tentatives précédentes (échecs) :
${feedbackHistory.join("\n\n---\n\n")}
`;
```

Limites (reprises de `queue-retry.ts` dans git-commits-push) :
- Maximum **10 entrées** dans l'historique
- Maximum **16 Ko** par entrée
- Maximum **64 Ko** total

---

## 6. Fonctionnement de l'agent bridge

### Différence avec le LLM bridge existant

| | `turnlock-to-llm-bridge.ts` (git-commits-push) | `turnlock-to-agent-bridge.ts` (post-write-linter) |
|---|---|---|
| Ce qui est exécuté | Appel API LLM stateless (prompt → JSON) | Session agent multi-turn (read → edit → bash → test) |
| Durée | Secondes | Minutes |
| Résultat | Chaîne JSON parsée | Fichiers modifiés sur le filesystem + rapport |
| Complexité du bridge | ~100 lignes | ~150 lignes |
| Types d'agents supportés | Aucun (juste API LLM) | Claude Code, Pi, Codex (extensible) |

### Interface du bridge

```typescript
async function invokeAgent(config: {
  agentType: "claude-code" | "pi" | "codex";
  model: string;
  prompt: string;
  workDir: string;
  timeoutMs: number;
}): Promise<{
  success: boolean;
  output: string;
  filesChanged: string[];
}>;

// Claude Code headless
function spawnClaudeCode(config) {
  return spawn("claude", [
    "--model", config.model,
    "--print",
    "--prompt", config.prompt,
    "--cwd", config.workDir,
  ]);
}

// Pi headless
function spawnPi(config) {
  return spawn("pi", [
    "--model", config.model,
    "-p", config.prompt,
    "--cwd", config.workDir,
  ]);
}

// Codex headless
function spawnCodex(config) {
  return spawn("codex", [
    "--model", config.model,
    "exec", config.prompt,
    "--cwd", config.workDir,
  ]);
}
```

### Pipeline

```bash
bun run lint-fix.orchestrator.ts | bun run agent-bridge.ts
```

Même pattern que git-commits-push :
```bash
bun turnlock-orchestrator.ts | bun turnlock-to-llm-bridge.ts
```

Le bridge lit les blocs `@@TURNLOCK@@ ... @@END@@` sur stdin, parse les manifests, exécute les agents, et relance l'orchestrateur. Si l'orchestrateur émet un nouveau bloc DELEGATE (retry), le bridge le traite récursivement.

---

## 7. Comportement de bout en bout

### Scénario 1 : code clean

```
agent_settled → biome lint → 0 erreur → rien ne se passe
```

### Scénario 2 : erreurs corrigibles en 1 passe

```
agent_settled → biome lint → 3 erreurs lint_rule
  → Turnlock DELEGATE(Haiku, attempt 0/2)
    → Bridge spawn Claude Code --model haiku
      → Agent lit, édite, vérifie → corrige les 3 erreurs
    → Bridge écrit result.json, resume Turnlock
  → check_lint → 0 erreur → DONE
```

### Scénario 3 : Haiku échoue partiellement, retry avec feedback

```
agent_settled → biome lint → 3 erreurs lint_rule
  → DELEGATE(Haiku, attempt 0/2)
    → L'agent corrige 1 erreur sur 3 → 2 erreurs restantes
  → check_lint → 2 erreurs (hash différent → continue)
  → DELEGATE(Haiku, attempt 1/2, +feedback "voici ce que tu as raté")
    → L'agent corrige les 2 restantes
  → check_lint → 0 erreur → DONE
```

### Scénario 4 : loop sur Haiku, fallback Sonnet

```
agent_settled → biome lint → 3 erreurs lint_rule
  → DELEGATE(Haiku, attempt 0/2) → échec : 2 erreurs restantes
  → check_lint → hash A → continue
  → DELEGATE(Haiku, attempt 1/2, +feedback) → échec : 2 erreurs (mêmes)
  → check_lint → hash A → LOOP DETECTED (même hash que le check précédent)
  → Budget Haiku épuisé (2/2) → fallback ?
    → Oui (kind=lint_rule, pas encore tenté, budget >= 2)
    → DELEGATE(Sonnet, budget reset à 0, fallbackAttempted=true)
      → Bridge spawn Claude Code --model sonnet
        → Sonnet trouve le vrai problème, corrige
  → check_lint → 0 erreur → DONE
```

### Scénario 5 : échec total

```
agent_settled → 5 erreurs
  → Haiku échoue 2x → loop
  → Sonnet échoue 1x → loop
  → Turnlock FAIL
  → Extension Pi notifie l'utilisateur avec les erreurs restantes
```

**Jamais d'abandon silencieux.** Si Turnlock échoue, l'utilisateur est notifié avec la liste des erreurs restantes.

---

## 8. Composants à construire

| Composant | Fichier | Taille estimée |
|-----------|---------|---------------|
| **Core linter** : ajouter `runBiomeLint()` | `agent-enforcers/post-write-linter/src/core/linter.ts` | ~20 lignes |
| **Core linter** : ajouter `normalizeLintErrors()` et `hashLintErrors()` | `agent-enforcers/post-write-linter/src/core/linter.ts` | ~15 lignes |
| **Turnlock FSM** pour le lint | `agent-enforcers/post-write-linter/src/turnlock/lint-fix.orchestrator.ts` | ~80 lignes |
| **Agent bridge** générique | `agent-enforcers/post-write-linter/src/turnlock/agent-bridge.ts` | ~150 lignes |
| **Types/config** partagés | `agent-enforcers/post-write-linter/src/turnlock/types.ts` | ~40 lignes |
| **Extension Pi** : intégration `agent_settled` | `~/.pi/agent/extensions/post-write-linter.ts` | ~30 lignes ajoutées |
| **Tests** : FSM + bridge | `agent-enforcers/post-write-linter/src/turnlock/__tests__/` | ~200 lignes |

---

## 9. Pourquoi cette architecture

### Pourquoi Turnlock

| Besoin | Sans Turnlock | Avec Turnlock |
|--------|--------------|---------------|
| Retry multi-agent | Code manuel dans l'extension | Natif, budgété par kind |
| Fallback model | Code manuel | `shouldUseFallback()` réutilisé |
| Loop detection | Code manuel | Hash + comparaison natifs |
| Audit trail | Rien | `state.json` + `events.ndjson` |
| Délégation cross-agent | Pi uniquement, modèle courant uniquement | N'importe quel agent, n'importe quel modèle |
| Extensibilité (futur: typecheck, tests) | Nouveau code pour chaque check | Même bridge, nouvelle FSM |

### Pourquoi le bridge est séparé de l'orchestrateur

- **Séparation des responsabilités** : Turnlock décide, le bridge exécute. Le bridge ne contient aucune logique métier.
- **Réutilisabilité** : le même bridge peut exécuter des délégations pour le lint, le typecheck, les tests, etc. Seule la FSM Turnlock change.
- **Testabilité** : la FSM est testable unitairement sans agent réel. Le bridge est testable avec des mocks d'agents.

### Pourquoi des agents plutôt que des appels LLM simples

Corriger des erreurs de lint n'est pas un appel LLM simple. L'agent doit :
1. Lire les fichiers concernés (`read`)
2. Comprendre le contexte du code
3. Éditer les fichiers (`edit`)
4. Potentiellement exécuter les tests (`bash`) pour vérifier qu'il n'a rien cassé
5. Réessayer si ça ne compile pas

Un appel LLM stateless ne peut pas faire ça. Un agent multi-turn, si.

---

## 10. UX dans Pi

### 10.1 Principe : ne jamais polluer la conversation

Le lint post-cycle est un processus **externe et silencieux**. Il ne doit jamais :

- Injecter un faux prompt utilisateur (`sendUserMessage` avec le rôle `user`)
- Interrompre la lecture du rapport de l'agent
- Voler le focus de l'input

L'utilisateur lit le rapport de l'agent tranquillement. Pendant ce temps, en arrière-plan, le bridge spawn un agent headless (Claude Code) qui corrige les fichiers directement sur le filesystem.

Toute la communication visuelle passe par les **couches UI persistantes** de Pi, jamais par le flux de messages.

### 10.2 Mécanismes UI utilisés

| Information | Mécanisme Pi | Emplacement |
|-------------|-------------|-------------|
| Lint en cours + erreurs trouvées + agent actif + progression | `ctx.ui.setWidget("lint", ...)` | Au-dessus de l'input editor |
| Lint réussi | `ctx.ui.notify("✅ Lint passed", "info")` + widget mis à jour | Notif temporaire + widget 5s |
| Lint échoué (abandon après tous les retries) | `ctx.ui.setWidget("lint", ...)` | Widget persistant au-dessus de l'input |

Le widget est **indépendant de la conversation**. Il persiste même quand l'agent est idle (ce qui est le cas après `agent_settled`). Il est ancré au-dessus de l'input editor, visible en permanence sans que l'utilisateur n'ait à scroller.

### 10.3 Disposition visuelle

```
┌──────────────────────────────────────┐
│                                      │
│  Zone de conversation (scrollable)   │
│                                      │
│  [Assistant] Voici l'implémentation  │
│  du module d'auth, les tests         │
│  passent, tout est bon.              │
│                                      │  ← L'utilisateur lit, scroll
│                                      │     La conversation ne bouge pas
├──────────────────────────────────────┤
│  ┌──── Lint ────────────────────┐    │
│  │ 🔍 Checking...                │    │  ← Widget setWidget("lint")
│  │                               │    │     Apparaît au-dessus de l'input
│  │ src/auth.ts:10 noUnusedImports│    │     Indépendant de la conversation
│  │ src/utils.ts:42 noVar         │    │
│  │ src/api.ts:5  complexity      │    │
│  │                               │    │
│  │ 🧠 claude-haiku (1/2)         │    │  ← Évolue en live
│  │ ⏳ 3s elapsed                  │    │
│  └───────────────────────────────┘    │
│                                      │
│  [User] █                            │  ← Input editor, toujours actif
└──────────────────────────────────────┘
```

### 10.4 États du widget

#### État 1 : Checking

Affiché immédiatement après `agent_settled`, dès que le lint est lancé. Montre les erreurs brutes détectées.

```
┌──── Lint ──────────────────────────┐
│ 🔍 Checking...                      │
│                                     │
│ src/auth.ts:10  noUnusedImports     │
│ src/utils.ts:42 noVar               │
│ src/api.ts:5    complexityExceeded  │
│                                     │
│ 🧠 Fixing with claude-haiku (1/2)   │
│ ⏳ 3s elapsed                        │
└─────────────────────────────────────┘
```

#### État 2 : Fixing (retry / fallback)

Le widget s'update quand Turnlock décide un retry ou un fallback.

```
┌──── Lint ──────────────────────────┐
│ 🔄 Retry (attempt 2/2)...           │
│                                     │
│ src/auth.ts:10  noUnusedImports     │  ← Seulement les erreurs restantes
│                                     │
│ 🧠 claude-haiku (2/2)               │
│ ⏳ 18s elapsed                       │
└─────────────────────────────────────┘
```

```
┌──── Lint ──────────────────────────┐
│ ⚡ Escalating to fallback model...  │
│                                     │
│ src/auth.ts:10  noUnusedImports     │
│                                     │
│ 🧠 claude-sonnet (1/2)              │  ← Changement d'agent visible
│ ⏳ 25s elapsed                       │
└─────────────────────────────────────┘
```

#### État 3 : Réussi

Le widget affiche le succès, puis disparaît après 5 secondes.

```
┌──── Lint ✓ ────────────────────────┐
│ ✅ All 3 errors fixed in 12s       │
│    by claude-sonnet (fallback)     │
└─────────────────────────────────────┘
```

#### État 4 : Échec (abandon)

Le widget persiste jusqu'à ce que l'utilisateur agisse.

```
┌──── Lint ✗ ────────────────────────┐
│ ❌ 2 errors unfixed after 4 attempts│
│                                     │
│ src/auth.ts:10  noUnusedImports     │
│ src/utils.ts:42 noVar               │
│                                     │
│ Tried: haiku (2x), sonnet (2x)     │
│ Press /go to continue anyway        │
└─────────────────────────────────────┘
```

### 10.5 Blocage de l'input : jusqu'à l'état terminal de la FSM

L'input est **bloqué pendant toute la durée de vie de la FSM Turnlock**, pas seulement pendant l'exécution d'un agent. Cela inclut tous les retries, tous les fallbacks, jusqu'à ce que la FSM atteigne un état terminal.

**Justification :** le lint n'est pas un processus optionnel ou décoratif. C'est une barrière de qualité. Tant que la FSM n'a pas rendu son verdict (DONE ou FAIL), le code sur le filesystem n'est pas dans un état considéré comme stable. Laisser Pi travailler sur des fichiers potentiellement en cours de modification par un agent externe créerait un état incohérent et des corruptions silencieuses.

Les deux seuls moments où l'input est débloqué :

| État terminal de la FSM | Comportement de l'input |
|------------------------|------------------------|
| **DONE** (lint clean) | Débloqué immédiatement. L'utilisateur reprend sur du code garanti propre. |
| **FAIL** (abandon après tous les retries et fallbacks) | Débloqué. L'utilisateur décide de corriger manuellement ou d'ignorer. |

Tant que la FSM n'est ni DONE ni FAIL, l'input affiche :

```
┌──── Lint ⏳ ────────────────────────┐
│ ⏳ Lint in progress...               │
│                                     │
│ This may take a few minutes.        │
│ Pi will resume automatically once   │
│ all retries and fallbacks are done. │
└─────────────────────────────────────┘
```

### 10.6 Chronologie précise

```
1. agent_settled → Pi idle
   ├── La conversation affiche le rapport final de l'agent (normal)
   │
2. L'extension lance le pipeline Turnlock
   ├── ctx.ui.setWidget("lint", widget_etat_1)  → widget "Checking" apparaît
   ├── INPUT BLOQUÉ  ←───────────────────────── jusqu'à DONE ou FAIL
   │
3. Turnlock → DELEGATE → Bridge spawn Claude Code headless
   ├── Claude Code bosse en arrière-plan (process séparé, silencieux)
   ├── L'utilisateur lit son rapport mais NE PEUT PAS taper de prompt
   │
4. Claude Code termine → Bridge écrit result.json → resume Turnlock
   ├── Turnlock re-check
   │   ├── clean → widget_etat_3 (succès, disparaît après 5s)
   │   │         → INPUT DÉBLOQUÉ
   │   ├── erreurs + retry → widget_etat_2 (retry ou fallback)
   │   │                   → INPUT RESTE BLOQUÉ, la FSM continue
   │   └── erreurs + abandon après tous les retries
   │                     → widget_etat_4 (échec, persiste)
   │                     → INPUT DÉBLOQUÉ (l'utilisateur reprend la main)
   │
5. L'input reste bloqué pendant TOUTE la durée de la FSM
   ├── Haiku échoue → toujours bloqué
   ├── Retry → toujours bloqué
   ├── Fallback Sonnet → toujours bloqué
   └── DONE ou FAIL → enfin débloqué
```

### 10.7 Pourquoi cette UX

| Approche | Problème |
|----------|----------|
| Injecter `sendUserMessage()` dans la conversation | L'utilisateur voit un faux prompt comme s'il l'avait tapé. La conversation est polluée. Impossible de lire le rapport tranquillement. |
| Ne rien montrer du tout | Boîte noire. L'utilisateur ne sait pas ce qui se passe, combien de temps ça prend, ni si ça a marché. |
| Input libre pendant le lint | Deux process (Pi et Claude Code) peuvent modifier les mêmes fichiers en parallèle → corruption silencieuse, état incohérent. De plus, le code n'est pas considéré comme propre tant que le lint n'est pas passé — travailler sur du code potentiellement sale n'a pas de sens. |
| **Widget au-dessus de l'input + input bloqué jusqu'à DONE/FAIL** (approche retenue) | L'utilisateur voit la progression en live sans que la conversation soit polluée. L'input est débloqué uniquement quand la FSM a rendu son verdict terminal — garantissant que Pi reprend sur un filesystem dans un état cohérent et connu (propre, ou explicitement en échec). |

---

## 11. Non-décisions / questions ouvertes

- **Quel agent par défaut pour le lint ?** Claude Code, Pi lui-même, ou configurable ?
- **Timeout par tentative d'agent ?** À définir (5 minutes ? 10 ?)
- **Parallélisation ?** Si plusieurs fichiers ont des erreurs, un agent par fichier ou un agent global ?
- **Extension Claude Code et Codex** : même intégration que Pi (sur leur équivalent de « fin de cycle ») ou seulement Pi ?
- **Où vit le code ?** Dans `~/.agents/agent-enforcers/post-write-linter/` ou dans un repo dédié ?
