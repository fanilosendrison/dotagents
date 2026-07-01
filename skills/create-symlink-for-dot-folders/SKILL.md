---
name: create-symlink-for-dot-folders
description: Safely initializes physical folders in dot-projects and symlinks them to ~/. gateways. Bypasses path-guard restrictions securely and automatically backs up existing data to prevent loss. Use this whenever the user asks to create a new symlink for a folder (like ~/.agents/specs -> dotagents/specs).
---

# Create Symlink for Dot-Folders

## When to use this skill

The `path-guard` system intentionally blocks you from creating new directories directly inside `~/Developper/Projects/dot<name>/` (it rewrites paths to `~/.<name>/`). This creates a bootstrap problem when you need to initialize a brand new folder and its symlink.

**Do NOT attempt to use `mkdir` or `git init` or `ln -s` manually** to solve this. You will get trapped by `path-guard` and you risk deleting user data. 
Use the bundled Python script instead.

## How to use

Run the bundled Python script, providing the physical target directory and the symlink path.

```bash
python3 ~/.agents/skills/create-symlink-for-dot-folders/scripts/create_symlink.py <physical_target_dir> <symlink_path>
```

### Example Usage

If the user wants `~/.agents/specs` to be a symlink to `~/Developper/Projects/dotagents/specs`:

```bash
python3 ~/.agents/skills/create-symlink-for-dot-folders/scripts/create_symlink.py ~/Developper/Projects/dotagents/specs ~/.agents/specs
```

### What the script does mechanically:
1. Backups the existing contents of `symlink_path` (if it already exists as a real folder/file) to `/tmp/`.
2. Creates the `physical_target_dir` safely (bypassing path-guard because it's a python process).
3. Creates the symlink from `symlink_path` to `physical_target_dir`.
4. Restores any backed-up contents directly into the new physical directory.

You don't need to do any manual backups, the script handles it all. Just run the script and verify the output.
