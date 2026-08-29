# Claude Code Facade Installer

Génère la façade Claude Code dans `~/.claude/` à partir des sources canoniques
de `~/.agents/`. Les liens symboliques créés pointent vers `$HOME/.agents/...`
et sont portables : aucune machine ni utilisateur n'est codé en dur.

## Architecture

```
dotagents → source canonique unique des ressources migrées
~/.agents/ → gateway vers dotagents
~/.claude/ → façade Claude Code générée localement (symlinks vers ~/.agents/)
```

## Commandes

```bash
# Installer la façade (crée les symlinks manquants)
node ~/.agents/scripts/claude-facade/src/cli.ts install

# Vérifier l'état de la façade (ne modifie rien)
node ~/.agents/scripts/claude-facade/src/cli.ts check

# Réparer les symlinks incorrects ou cassés
node ~/.agents/scripts/claude-facade/src/cli.ts install --repair

# Afficher les règles .gitignore attendues pour dotclaude
node ~/.agents/scripts/claude-facade/src/cli.ts gitignore-rules
```

## Tests

```bash
cd ~/.agents/scripts && pnpm test
```

Les tests s'exécutent dans des répertoires temporaires et ne touchent jamais
au vrai `$HOME`.

## Contrat de sécurité

- **Source absente** → erreur, aucun lien créé
- **Destination absente** → création des parents + symlink
- **Symlink déjà correct** → succès idempotent, aucune modification
- **Symlink incorrect** → erreur en mode `install`, réparé en mode `repair`
- **Fichier ou dossier réel à destination** → erreur, jamais supprimé ni déplacé
- **Lien cassé** → erreur en mode `install`, réparé en mode `repair`

## Manifeste

La liste des entrées de façade est définie dans `src/manifest.ts` (source unique).
Ne pas dupliquer cette liste ailleurs.
