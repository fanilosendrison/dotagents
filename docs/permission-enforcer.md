# Permission Enforcer

Gère le cycle d'autorisation globale de modification de code via le mot-clé sémantique `/go`.

Cet enforcer est uniquement responsable de **la mise à jour de l'état** (Phase 1). La logique de blocage physique des outils (Phase 2) a été déléguée à **Command Validator** pour simplifier la structure des hooks.

## 1. Wiring — 3 points d'interception (Prompts)

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("user_prompt")` | Pi | `~/.pi/agent/extensions/permission-enforcer.ts` |
| 2 | **Claude Code hook** · `user-prompt-submit` | Claude Code | `~/.claude/hooks/permission-enforcer-state.ts` |
| 3 | **Codex hook** · `user-prompt-submit` | Codex | `~/.codex/hooks/permission-enforcer-state.ts` |

Tous partagent la **même logique core** : `~/.agents/agent-enforcers/permission-enforcer/src/core/state.ts`.

## 2. Trigger flow

```
Utilisateur soumet son message
        │
        ▼
┌──────────────────────────────────────┐
│  Phase 1: Débloqueur                 │
│  (permission-enforcer)               │
│                                      │
│  Regex: /(^|\s)\/go(\s|$)/ dans msg? │
└──────────────┬───────────────────────┘
         No    │   Yes
         ▼     ▼
  State=false  State=true
        │            │
        └─────┬──────┘
              ▼
    Écriture dans le fichier d'état
    (.state/config.json)
```

## 3. How it works

L'enforcer est stateless par rapport aux sessions d'agent mais maintient le statut d'autorisation dans un fichier JSON partagé : `~/.agents/agent-enforcers/permission-enforcer/.state/config.json`.
1. À chaque message de l'utilisateur, le texte brut est intercepté.
2. Si le mot `/go` est présent (détecté par la regex `/(^|\s)\/go(\s|$)/`), le fichier d'état est écrit avec `{"allowed": true}`.
3. Si le mot n'est pas présent, il est réinitialisé avec `{"allowed": false}`.
4. Ce fichier d'état est ensuite lu par **Command Validator** pour valider ou bloquer l'usage des outils.

## 4. File tree

```
permission-enforcer/
└── src/
    └── core/
        ├── state.ts                   ← updatePermissionState(promptText) & isPermissionGranted()
        └── __tests__/
            └── state.test.ts          ← Tests de validation de la Regex d'état
```

## 5. Behavior by runtime

Pour tous les runtimes (Pi, Claude, Codex, Antigravity) :
- Si l'utilisateur saisit `/go` (ou `Fais-le /go`), l'état passe à `true`.
- Si l'utilisateur envoie un message sans `/go` (ex: `Merci`), l'état repasse instantanément à `false`.
