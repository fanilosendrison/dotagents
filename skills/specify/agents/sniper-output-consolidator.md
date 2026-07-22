---
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "Assigned as a sub-agent to merge, align, deduplicate, and classify sniper outputs for one document"
  agent: "sniper-output-consolidator"
  step: 2
  name: "Sniper Output Consolidator"
  role: "You merge, align, deduplicate, and classify sniper outputs for one document."
---

# Sniper Output Consolidator

You receive `$RUNDIR` and `<document>`. The sniper outputs for this document are already in `$RUNDIR/sniper-<N>-<document>.json`.

## Step 2 — Merge

```bash
npx tsx scripts/merge-sniper-outputs.ts $RUNDIR <document-name>
```

**Output** : `$RUNDIR/merged-<document>.json`

---

## Step 3 — Align

1. Lis `$RUNDIR/merged-<document>.json`.
2. Lis `$RUNDIR/requirements-<document>.json` pour obtenir les slugs canoniques et leurs lignes.
3. Pour chaque slug absent de la liste canonique, cherche un slug canonique dont la plage `lines` chevauche la sienne (deux plages se chevauchent si elles partagent au moins une ligne). Si trouvé → sur ce slug absent, mets `"parent": "<slug-canonique>"`. Sinon → laisse `null`.
4. Écris `$RUNDIR/aligned-<document>.json`.

---

## Step 4 — Dedup

1. Lis `$RUNDIR/aligned-<document>.json`.
2. Pour chaque `req_slug` qui a ≥2 FAILs dans `snipers` :
   a. Compare toutes les paires de FAILs (A, B). Imagine A corrigé : B serait-il automatiquement résolu ? Oui → fusion A+B, note A comme "kept". Non → rien.
   b. Une fois toutes les paires évaluées, applique :
      - Dans `findings`, ne garde que les "kept".
      - Ajoute `"merged_findings"` avec chaque fusion : `{"from": ["1","3"], "kept": "1", "reason": "même cause racine"}`.
      - Ne touche pas `snipers`.

   **Exemple.** Avant : `snipers: {"1":"FAIL","3":"FAIL","6":"FAIL"}`, `findings: {"1":"Oracle missing","3":"No effect","6":"No recovery"}`. (1,3) fusionnent, (1,6) et (3,6) non. Après : `findings: {"1":"Oracle missing","6":"No recovery"}`, `merged_findings: [{"from":["1","3"],"kept":"1","reason":"même cause racine"}]`.
3. Écris `$RUNDIR/deduped-<document>.json`.

---

## Step 5 — Classify

```bash
npx tsx scripts/classify-sniper-outputs.ts $RUNDIR <document-name>
```

Ajoute `"status"` à chaque exigence selon ses FAILs restants : aucune clé FAIL → `TDD_READY`, `"8"` présent → `SPEC_CONFLICT`, `"5"` présent → `SPEC_AMBIGUITY`, autre → `SPEC_GAP`. Les clés `N/A` (ex: Deferred) sont ignorées.

**Output** : `$RUNDIR/classified-<document>.json`
