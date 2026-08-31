---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "policy"
domain: "runtime-interoperability"
severity: "strict"
name: "Optional Bun interoperability allowlist policy"
version: "1.0.0"
---

# Optional Bun interoperability allowlist policy

## Default rule

Active in-scope code must not require Bun. Bun globals, modules, test imports, types, shebangs, launch commands, or lockfiles fail the final gate unless an occurrence is represented by an exact machine-readable allowlist entry.

## Allowed categories

An exact exception entry may use only one of these categories:

- `external-project-interop`: package-manager detection or validation for a repository outside dotagents and dotpi;
- `policy-enforcement`: the fail-closed validator, its regression test, or the CI failure sentinel;
- `historical-artifact`: a non-executable artifact that cannot move into the excluded archive;
- `upstream-vendored-code`: vendored code governed by an upstream owner;
- `user-requested-opt-in`: an explicit optional interoperability surface that is never selected by default.

Migration tooling and transitional launch syntax are not permanent categories. They were moved into `docs/migrations/node-pnpm/archive/` or removed before activation.

## Entry requirements

Every allowlist entry specifies an exact repository-relative path, category, required literals, owner, rationale, and removal condition. Directory globs exist only in `excludedPathRules` for the mechanically excluded upstream tree and the migration archive. An occurrence that does not match both path and literals fails closed. Missing files, duplicate entries, or missing required literals are stale-policy failures.

## Interoperability boundary

Optional external-project support may recognize Bun package-manager declarations and lockfiles and may invoke Bun only when an external repository explicitly selects Bun. Dotagents and dotpi installation, build, launch, and required tests must never select Bun.

Package-manager resolution order is:

1. explicit command in `STACK_EVAL.yaml`;
2. standard `packageManager` field;
3. one unique lockfile;
4. fail-closed error when multiple lockfiles exist without a declaration.

## Enforcement

The policy is active. `pnpm run validate:bun-policy` checks lock/config files, package manifests, active source, workflows, test runtime imports, exact exceptions, and the `74/74` parity manifest. The Node CI prepends a sentinel executable that exits non-zero while recording invocations; its log must remain empty after every gate. A separate non-gating interoperability job may exercise external projects that explicitly select Bun.

The machine-readable files are `bun-allowlist.json` in each migration documentation directory. Dotpi applies the same validator to its own `25/25` corpus.
