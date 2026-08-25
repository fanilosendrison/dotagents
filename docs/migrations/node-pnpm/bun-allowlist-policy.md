---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "policy"
domain: "runtime-interoperability"
severity: "strict"
name: "Optional Bun interoperability allowlist policy"
version: "0.1.0"
---

# Optional Bun interoperability allowlist policy

## Default rule

Active in-scope code must not require Bun. Bun globals, modules, test imports, types, shebangs, launch commands, or lockfiles fail the final gate unless an occurrence is represented by an exact machine-readable allowlist entry.

## Allowed categories

An entry may use only one of these categories:

- `external-project-interop`: package-manager detection or validation for a repository outside dotagents and dotpi;
- `upstream-exclusion`: the mechanically excluded pi-subagents-4-turnlock tree;
- `archive`: retained historical implementation material;
- `superseded-specification`: a document listed in the successor registry.

Migration tooling and transitional launch syntax are not permanent categories. They must be removed before the final sweep.

## Entry requirements

Every allowlist entry must specify an exact repository-relative path, category, required literals, owner, reason, and removal condition. Directory globs are permitted only for the upstream and archive categories. An occurrence that does not match both path and literal fails closed.

## Interoperability boundary

Optional external-project support may recognize Bun package-manager declarations and lockfiles and may invoke Bun only when an external repository explicitly selects Bun. Dotagents and dotpi installation, build, launch, and required tests must never select Bun.

Package-manager resolution order is:

1. explicit command in `STACK_EVAL.yaml`;
2. standard `packageManager` field;
3. one unique lockfile;
4. fail-closed error when multiple lockfiles exist without a declaration.

## Enforcement

The required no-Bun job removes Bun from `PATH` and adds a sentinel executable that exits non-zero while recording invocations. The invocation log must remain empty. A separate non-gating interoperability job may exercise external Bun projects.

The machine-readable files are `bun-allowlist.json` in each migration documentation directory.
