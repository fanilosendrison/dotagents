# SemVer Convention

You apply Semantic Versioning 2.0.0 for every version number you produce or update.

Full spec: https://semver.org

## Format

```
MAJOR.MINOR.PATCH[-prerelease][+build]
```

Always **3 segments**. `1.0` is invalid — write `1.0.0`.

## Bump Rules

| Change | Bump | Example |
|---|---|---|
| Breaking change (incompatible API) | MAJOR | `1.2.3` → `2.0.0` |
| New backward-compatible feature | MINOR | `1.2.3` → `1.3.0` |
| Bug fix, no API change | PATCH | `1.2.3` → `1.2.4` |

MAJOR bump → MINOR and PATCH reset to 0.
MINOR bump → PATCH resets to 0.

## Conventional Commits → SemVer

| Commit type | Bump |
|---|---|
| `feat` | MINOR |
| `fix` | PATCH |
| `perf` | PATCH |
| `revert` | Depends on reverted commit |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | No version bump |
| Any type with `!` or `BREAKING CHANGE:` footer | MAJOR |

## Phase 0.x.y — Initial Development

- Start at `0.1.0` (never `0.0.0`, never `1.0`)
- `0.x.y` = unstable API, anything can change
- Breaking changes in `0.x.y` bump MINOR: `0.1.0` → `0.2.0`
- New features in `0.x.y` bump MINOR: `0.1.2` → `0.2.0`
- Fixes bump PATCH: `0.1.2` → `0.1.3`
- Go to `1.0.0` when the project is used in production or has a stable API

## Pre-release and Build Metadata

```
1.0.0-alpha        # pre-release
1.0.0-alpha.1      # numbered pre-release
1.0.0-beta.2       # beta
1.0.0-rc.1         # release candidate
1.0.0+build.123    # build metadata (ignored in ordering)
```

Precedence: `alpha` < `beta` < `rc` < release.

## Where to Apply

- `package.json` / `pyproject.toml` / `Cargo.toml` — `version` field
- YAML frontmatter (`version: "X.Y.Z"`) — pipelines, steps, skills
- Git tags: `vX.Y.Z` (`v` prefix required for tags)
- Changelogs: `## [X.Y.Z] - YYYY-MM-DD` header

## Anti-Patterns

```
# ❌ Two segments
version: "1.0"

# ❌ Starting at 0.0.0
version: "0.0.0"

# ❌ Starting at 1.0.0 for WIP — use 0.1.0
version: "1.0.0"

# ❌ v prefix in config files (v is for git tags only)
version: "v1.2.3"

# ❌ MAJOR bump for a fix
1.2.3 → 2.0.0    # if it's just a bug fix → 1.2.4
```
