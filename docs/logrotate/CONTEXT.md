# Logrotate — security.log Rotation

Rotates the `command-validator` enforcer security log to prevent unbounded growth.

## Why

The `agent-enforcers/command-validator/data/security.log` file accumulates an entry
per bash command intercepted by the validator. Without rotation it grew to ~2 MB in
~2 months of usage, and would eventually saturate the orchestrator spawnSync buffer
during commit runs (ENOBUFS error: `stdout or stderr buffer reached maxBuffer size`).

## Files

| Path | Purpose |
|------|---------|
| `~/.local/bin/rotate-security-log.sh` | Rotation script (copytruncate pattern) |
| `~/Library/LaunchAgents/com.dotagents.rotate-security-log.plist` | launchd job, runs hourly |

The script is intentionally kept out of the repo — it is user-level config, not
project config. To reinstall on a new machine, copy both files to the paths above.

## Behavior

- **Threshold**: rotates when `security.log` exceeds **10 MB** (override with `MAX_SIZE_MB` env var)
- **Retention**: keeps **5** rotated files (override with `KEEP_COUNT` env var)
- **Frequency**: launchd runs every **hour** (`StartInterval=3600`)
- **Compression**: old logs are gzipped (`security.log.1.gz` … `security.log.5.gz`)

## Pattern: copytruncate

The script does NOT use the standard `mv log log.1` rotation. Instead it:

1. Copies current log → `security.log.1`
2. Gzips the copy
3. **Truncates the original in place** (using `: > log`)

This preserves the **inode** and the **open file descriptor** held by the
`command-validator` enforcer. A standard `mv` rotation would cause the enforcer
to keep writing to the rotated file (now named `.1`) instead of the new empty log.

## Install / Reinstall

```bash
chmod +x ~/.local/bin/rotate-security-log.sh
launchctl load ~/Library/LaunchAgents/com.dotagents.rotate-security-log.plist
```

## Verify

```bash
launchctl list | grep rotate-security-log
# Should show: <pid> 0 com.dotagents.rotate-security-log

# Trigger immediate run:
launchctl start com.dotagents.rotate-security-log

# Check output:
cat /tmp/rotate-security-log.out
```

## Related Changes

The rotation alone is not enough — `security.log` was also added to `.gitignore`
and untracked from git history:

| Commit | Description |
|--------|-------------|
| `99b4321` | chore(data): ignore generated agent-enforcer state files (added to `.gitignore`) |
| `617164f` | chore(data): untrack enforcer data logs (git rm --cached) |
| `257f866` | chore(data): untrack security.log entirely (final git rm --cached) |

## Related Files

- **Source enforcer**: `agent-enforcers/command-validator/data/security.log`
- **Enforcer doc**: `docs/command-validator/CONTEXT.md`