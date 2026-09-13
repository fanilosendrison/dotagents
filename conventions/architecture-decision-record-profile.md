---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "architecture-decisions"
severity: "strict"
name: "OKF Architecture Decision Record Profile"
version: "0.1.0"
---

# OKF Architecture Decision Record Profile

## Purpose and authority

Use this profile for machine-readable Architecture Decision Records represented
as OKF `KnowledgeAsset` documents. The profile specializes the generalized OKF
envelope without replacing repository-specific authority rules.

The canonical metadata schema is
[`architecture-decision-record.schema.json`](architecture-decision-record.schema.json).
Repositories adopt a pinned profile version and remain responsible for local
naming, authority order, validation, generated indexes, lifecycle policy, and CI
enforcement.

This profile adopts selected conventions from
[MADR 4.0.0](https://adr.github.io/madr/), including YAML frontmatter,
lifecycle terminology, decision dates, and stable number-plus-title identities.
It is MADR-inspired, not MADR-compliant or MADR-governed. Log4brains informs the
immutable-decision-body principle but is not a format authority.

## Canonical metadata

Every conforming ADR frontmatter must validate against the canonical schema.
Apply these meanings:

- `id` is the canonical stable identity. Derive numeric order, filename
  validation, and H1 validation from it; do not duplicate `decision_order`.
- `name` is the canonical human-readable decision title. Keep an H1 for readers
  and validate it against `id` and `name`.
- `status` uses the closed lifecycle vocabulary defined by the schema.
- `date` is the recorded decision date. Quote ISO dates so YAML parsers preserve
  strings. A repository may allow `null` only for an explicit fixed set of
  legacy records whose dates are genuinely unavailable.
- `severity` expresses enforcement strength, not documentary precedence. Use
  repository authority rules to determine how ADRs relate to specifications,
  evidence, generated projections, and explanatory documents.
- `decision_body_sha256` is the lowercase SHA-256 digest of the exact UTF-8/LF
  bytes beginning at the first line matching `^## Context(?: |$)` through EOF,
  including the final-newline state.
- `relation_completeness: complete` means that every explicitly asserted
  outgoing ADR relation of this record is represented structurally. It does not
  claim discovery of every conceptual relationship mentioned in prose.
- `relation_completeness: legacy-partial` marks a migrated record whose retained
  historical prose may contain relationships not yet normalized structurally.
- `governs` records the decision scopes explicitly asserted by this ADR.

Reject BOM and CRLF rather than normalizing decision bytes silently. JSON
Schema validators must enable calendar-aware `format: date` assertion rather
than treating `format` as annotation. Repository tests must prove rejection of
invalid months, invalid days, and invalid leap days.

## Relationship authority

Store only outgoing decision relations on the record that makes them:

```yaml
relations:
  clarifies:
    - "ADR-009"
  amends: []
  supersedes: []
  confirms: []
```

Derive incoming relationships such as `clarified_by`, `amended_by`,
`superseded_by`, and `confirmed_by` in generated projections. Do not store both
directions as independent authority.

A generated reverse graph is complete only relative to the outgoing assertions
represented in source frontmatter. While any record is `legacy-partial`, do not
present the graph as a complete reconstruction of decision history.

## Immutability and lifecycle

After acceptance, keep all of the following immutable:

- `id`, `name`, and decision date;
- outgoing relationships and `governs` scope;
- decision body from the `## Context` boundary onward.

Permit only lifecycle transitions explicitly defined by the adopting repository,
principally changes to `status`. A repository-wide metadata/schema migration may
change representation only when a new governance decision authorizes it and
machine-readable evidence proves that accepted decision bodies and semantics
were preserved.

Retain every allocated ID, including rejected, deprecated, and superseded
records. Never reuse an ID. A repository may therefore require contiguous IDs
without pressuring authors to recycle decision identities.

## Repository adoption contract

A repository profile should identify at least:

- adopted ADR profile version;
- canonical schema repository, path, commit, `$id`, and SHA-256;
- byte-identical vendored base schema and any separate local overlay;
- expected domain, filename pattern, ID width, and H1 separator policy;
- exact temporary legacy-without-frontmatter and null-date allowlists;
- generated index path;
- validation and rendering commands.

The repository validator must verify schema provenance, apply the base and local
schemas with calendar-aware format assertion, validate cross-record identity
and relationships, recompute body hashes, reject stale allowlist entries, and
verify generated projections.

## Generated indexes

Keep canonical metadata and explanatory history separate:

```text
ADR frontmatter
    = machine-readable identity, lifecycle, scope, and outgoing relations

ADR body
    = immutable decision record

generated ADR index
    = mechanical forward/reverse projection

ADR README or decision history
    = maintained narrative and nuanced historical commentary
```

Do not discard or infer nuanced historical statements merely to make a generated
index appear complete.
