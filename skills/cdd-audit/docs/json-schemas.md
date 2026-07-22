---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "reference"
domain: "architecture"
severity: "strict"
name: "JSON Schemas — CDD Audit"
---

# JSON Schemas — CDD Audit

All JSON files produced and consumed by the pipeline, in one place.

---

## requirements-<doc>.json

**Produced by** : `agents/requirement-lister.md` (Step 01)

```json
[
  {
    "req_slug": "REQ-001-debit-carte",
    "lines": "12-15",
    "quote": "charges the card and handles timeouts"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `req_slug` | `string` | `REQ-NNN-<description>` : zero-padded sequential number + `kebab-case` description. |
| `lines` | `string` | Line range (`"12-15"`). |
| `quote` | `string` | Exact text of the requirement. |

---

## sniper-<N>-<doc>.json (N ∈ {1..8})

**Produced by** : `agents/sniper-*.md` (Step 02 — Sniper Run)

```json
[
  {
    "req_slug": "REQ-001-debit-carte",
    "lines": "12-15",
    "verdict": "FAIL",
    "finding": "Oracle missing: \"handles the payment\" — expected result undefined."
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `req_slug` | `string` | Same as in the requirements file. |
| `lines` | `string` | Line range. |
| `verdict` | `"PASS"` \| `"FAIL"` \| `"N/A"` | `N/A` = check does not apply. `N/A` with a `finding` = Deferred (TBD at design time). |
| `finding` | `string` \| `null` | If `FAIL`, quote and description. If `PASS`, `null`. If `N/A` and Deferred, contains the reason. |

---

## merged-<doc>.json

**Produced by** : `scripts/merge-sniper-outputs.ts` (Step 02 — Consolidator, merge step)

```json
{
  "document": "foo.md",
  "requirements": [
    {
      "req_slug": "REQ-001-debit-carte",
      "lines": "12-15",
      "quote": "charges the card and handles timeouts",
      "parent": null,
      "snipers": {
        "1": "FAIL",
        "2": "PASS",
        "3": "N/A",
        "4": "N/A",
        "5": "PASS",
        "6": "PASS",
        "7": "N/A",
        "8": "PASS"
      },
      "findings": {
        "1": "Oracle missing: ..."
      }
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `document` | `string` | Audited document name. |
| `requirements[].req_slug` | `string` | Canonical identifier (`REQ-NNN-<description>` or sniper-created slug). |
| `requirements[].lines` | `string` \| `null` | Line range. |
| `requirements[].quote` | `string` \| `null` | Exact text from requirements file. `null` for sniper-created slugs. |
| `requirements[].parent` | `string` \| `null` | Always `null` at merge output (filled by Align). |
| `requirements[].snipers` | `object` | Verdicts per sniper (`"1"`…`"8"`). Values: `"PASS"`, `"FAIL"`, `"N/A"`, `"—"` (absent). |
| `requirements[].findings` | `object` | Findings keyed by sniper ID. Only present if non-null finding. |

---

## aligned-<doc>.json

**Produced by** : `agents/sniper-output-consolidator.md` (Step 02 — Align)

Same structure as `merged-<doc>.json`. The `parent` field is filled in:

```json
{
  "document": "foo.md",
  "requirements": [
    {
      "req_slug": "REQ-001-debit-carte",
      "lines": "12-15",
      "quote": "charges the card and handles timeouts",
      "parent": null,
      "snipers": {},
      "findings": {}
    },
    {
      "req_slug": "REQ-001-debit-carte-undocumented-failure",
      "lines": "14-15",
      "quote": null,
      "parent": "REQ-001-debit-carte",
      "snipers": { "6": "FAIL" },
      "findings": { "6": "Undocumented failure mode: ..." }
    }
  ]
}
```

| Modified field | Values |
|----------------|--------|
| `requirements[].parent` | `null` if canonical or orphan. `"<canonical-slug>"` if child with line overlap. Always present. |

---

## deduped-<doc>.json

**Produced by** : `agents/sniper-output-consolidator.md` (Step 02 — Dedup)

Same structure as `aligned-<doc>.json`. Adds `merged_findings`:

```json
{
  "document": "foo.md",
  "requirements": [
    {
      "req_slug": "REQ-001-debit-carte",
      "lines": "12-15",
      "quote": "charges the card and handles timeouts",
      "parent": null,
      "snipers": { "1": "FAIL", "2": "PASS", "3": "FAIL" },
      "findings": { "1": "Oracle missing: expected result undefined." },
      "merged_findings": [
        { "from": ["1", "3"], "kept": "1", "reason": "same root cause" }
      ]
    }
  ]
}
```

| Added field | Type | Description |
|-------------|------|-------------|
| `requirements[].merged_findings` | `array` | Merge history. Empty array if no merges. |
| `merged_findings[].from` | `string[]` | Merged sniper IDs. |
| `merged_findings[].kept` | `string` | Kept sniper ID. |
| `merged_findings[].reason` | `string` | Justification. |

---

## classified-<doc>.json

**Produced by** : `scripts/classify-sniper-outputs.ts` (Step 02 — Consolidator, classify step)

Same structure as `deduped-<doc>.json`. Adds `status`:

```json
{
  "document": "foo.md",
  "requirements": [
    {
      "req_slug": "REQ-001-debit-carte",
      "lines": "12-15",
      "quote": "charges the card and handles timeouts",
      "parent": null,
      "snipers": {},
      "findings": {},
      "merged_findings": [],
      "status": "SPEC_GAP"
    }
  ]
}
```

| Added field | Values |
|-------------|--------|
| `requirements[].status` | `"TDD_READY"` \| `"SPEC_GAP"` \| `"SPEC_AMBIGUITY"` \| `"SPEC_CONFLICT"` |

---

## all-classified.json

**Produced by** : `scripts/merge-classified-outputs.ts` (Step 03)

Flat merge of all `classified-<doc>.json` files. Each requirement gets a `document` field:

```json
{
  "requirements": [
    {
      "document": "foo.md",
      "req_slug": "REQ-001-debit-carte",
      "lines": "12-15",
      "quote": "charges the card and handles timeouts",
      "parent": null,
      "snipers": {},
      "findings": {},
      "merged_findings": [],
      "status": "SPEC_GAP"
    }
  ]
}
```

| Added field | Type | Description |
|-------------|------|-------------|
| `requirements[].document` | `string` | Source document name. |

---

## cat1-fixes.json

**Produced by** : `agents/fix-proposer.md` (Step 03)

Machine-readable Cat 1 fixes to be applied by the fixer:

```json
[
  {
    "finding_id": "REQ-001",
    "document": "foo.md",
    "file": "specs/foo.md",
    "lines": "12-15",
    "severity": "🔴",
    "correction": "Replace 'handles the payment' with 'returns a PaymentResult object'"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `finding_id` | `string` | `req_slug` of the requirement. |
| `document` | `string` | Source document name. |
| `file` | `string` | Path to the file to modify. |
| `lines` | `string` | Line range. |
| `severity` | `string` | `"🔴"` or `"🟡"`. |
| `correction` | `string` | Description of the exact change to apply. |

---

## fixer-result.json

**Produced by** : `agents/fixer.md` (Step 03)

Result of applying Cat 1 fixes:

```json
{
  "applied": [
    {
      "finding_id": "REQ-001",
      "document": "foo.md",
      "file": "specs/foo.md",
      "status": "applied",
      "before": "charges the card and handles timeouts",
      "after": "charges the card and returns a PaymentResult object on timeout"
    }
  ],
  "failed": [
    {
      "finding_id": "REQ-003",
      "document": "bar.md",
      "file": "specs/bar.md",
      "status": "failed",
      "reason": "Could not locate the exact text in the file"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `applied[].finding_id` | `string` | `req_slug` of the fixed requirement. |
| `applied[].status` | `"applied"` | Fix was successfully applied. |
| `applied[].before` | `string` | Original text. |
| `applied[].after` | `string` | Replaced text. |
| `failed[].status` | `"failed"` | Fix could not be applied. |
| `failed[].reason` | `string` | Why the fix failed. |

---

## cat2-remaining.json

**Produced by** : `scripts/filter-applied-fixes.ts` (Step 03)

`all-classified.json` minus requirements whose Cat 1 fixes were applied:

```json
{
  "requirements": [
    {
      "document": "foo.md",
      "req_slug": "REQ-002",
      "quote": "...",
      "status": "SPEC_AMBIGUITY"
    }
  ]
}
```

Same structure as `all-classified.json`, but only requirements that still need decisions (Cat 2).

---

## behavioral-report.md

**Produced by** : main agent (Step 03 — Assemble)

Markdown report following `assets/templates/audit-report-template.md`:

- Section 1 — Applied Fixes (from `fixer-report.md`)
- Section 2 — Decisions Required (Cat 2 from `fix-proposals.md`)
- Section 3 — Unverified Areas
- Section 4 — Final Verdict
