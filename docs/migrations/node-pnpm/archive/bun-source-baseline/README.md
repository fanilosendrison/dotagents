# Retired Bun source baseline

This directory preserves the implementation and test files that served as the
historical differential oracle during the Node and pnpm migration. They are not
part of any package boundary, build, test runner, launcher, or runtime path.

The original repository-relative locations remain recorded as `sourceFile`
values in `../../test-parity.json`; the active successors are the corresponding
`targetFile` values. All 74 target surfaces were green before these artifacts
moved here. The archive also contains the retired inventory and parity-generation
tools, which were superseded by the active fail-closed Bun policy validator.

Do not restore an artifact to an active path. Any future interoperability need
must use an exact `permanentExceptions` entry in `../../bun-allowlist.json` and
remain opt-in or scoped to an external repository.
