---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "file-system"
severity: "strict"
name: "Repository-aware ADR naming"
---

# Repository-aware ADR naming

## Authority order

Determine the final ADR identity and filename from the active repository rather
than from a global digit-width assumption.

1. If `docs/adr/adr-profile.yaml` exists, use its ID pattern, filename pattern,
   digit width, preferred H1 separator, and retention rules.
2. Otherwise, read the repository directives and inspect existing ADRs to
   preserve their established convention.
3. If neither source establishes a convention, ask the user before assigning an
   identity or filename.

Do not default silently to four digits or omit a repository's established
`adr-` prefix.

## Stable identity

Treat the repository-defined ADR ID as canonical. Derive its numeric order and
validate the filename and H1 against it.

- Select the next unallocated ID after the highest retained ID.
- Never reuse an ID belonging to a rejected, deprecated, or superseded record.
- Preserve every allocated record when the repository requires contiguous
  identities.
- Use lowercase kebab-case for the descriptive filename segment.
- Do not include dates or lifecycle statuses in filenames.

## Examples

A repository profile may require:

```text
ADR-016
adr-016-separate-authorship-from-execution-authority.md
```

Another repository may legitimately require:

```text
ADR-0016
0016-separate-authorship-from-execution-authority.md
```

The repository contract decides; the skill does not normalize one convention
into the other.
