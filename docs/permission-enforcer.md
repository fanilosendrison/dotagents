# Permission Enforcer

Gère le cycle d'autorisation globale de modification de code via le mot-clé sémantique `/go`.

L'enforcer a été simplifié en **bibliothèque d'état partagée** — il ne possède plus de hooks runtime indépendants.
La logique de blocage des outils (ex-`checker.ts`) a été fusionnée dans le **ToolPermissionValidator** de `command-validator`.

**Deux mécanismes distincts :**
1. **Directive AGENTS.md** — règle comportementale : « Do not implement anything without asking the user for explicit permission first. »
2. **Skill `/go`** — quand l'utilisateur tape `/go`, le skill charge `operational-rules/implementation.md` pour déverrouiller l'implémentation.

Le fichier `state.ts` fournit `isPermissionGranted()` (consommé par `command-validator`) et `updatePermissionState()` (disponible pour un futur câblage runtime).

## 1. Wiring — 1 point de consommation

| # | Mechanism | Consommateur | Fichier |
|---|-----------|-------------|---------|
| 1 | **Import direct** · `isPermissionGranted()` | Command Validator | `~/.agents/agent-enforcers/command-validator/src/core/tool-validator.ts` |

**Aucun hook runtime dédié.** Le permission-enforcer n'a pas de Pi extension, de hook Claude ni de hook Codex propres.
La mise à jour de l'état (`updatePermissionState`) est disponible dans `state.ts` mais n'est pas encore câblée à un runtime.

## 2. Trigger flow

```
Agent tente d'utiliser un outil d'écriture (Write, Edit, write_to_file...)
        │
        ▼
┌───────────────────────────────────────────┐
│  ToolPermissionValidator.validate()        │
│  (dans command-validator)                  │
│                                             │
│  isPermissionGranted() ?                    │
│    ├── true  → ✅ allow                     │
│    └── false → ❌ deny                      │
│                "Permission denied.          │
│                 Ask user to type /go"       │
└───────────────────────────────────────────┘
        │
        ▼ (si deny)
  L'utilisateur tape /go dans son prochain message
        │
        ▼
  Le skill /go est activé
  → L'agent lit operational-rules/implementation.md
  → L'autorisation d'implémenter est déverrouillée
```

## 3. How it works

L'enforcer maintient le statut d'autorisation dans un fichier JSON partagé : `~/.agents/agent-enforcers/permission-enforcer/.state/config.json`.

1. `isPermissionGranted()` lit le fichier d'état. S'il n'existe pas ou contient `{"allowed": false}`, retourne `false`.
2. `updatePermissionState(promptText)` détecte `/go` via la regex `/(^|\s)\/go(\s|$)/` et écrit l'état dans le fichier.
3. **Actuellement**, `updatePermissionState` n'est pas appelé par les hooks runtime — le blocage s'appuie principalement sur la directive AGENTS.md et le skill `/go`.

## 4. File tree

```
permission-enforcer/
└── src/
    └── core/
        ├── state.ts                   ← isPermissionGranted() & updatePermissionState()
        └── __tests__/
            └── state.test.ts          ← Tests de validation de la Regex d'état
```

## 5. Behavior by runtime

Le comportement est identique quel que soit le runtime, car le blocage s'effectue via le core partagé de `command-validator` :

- **Outil d'écriture sans `/go`** → ❌ Bloqué par `ToolPermissionValidator` avec message « Permission denied. Ask user to type /go. »
- **L'utilisateur tape `/go`** → Le skill `/go` s'active, l'agent lit les règles d'implémentation, l'autorisation est accordée pour ce tour.
