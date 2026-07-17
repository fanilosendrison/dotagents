---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "architecture"
severity: "strict"
name: "ADR Granularity Rules"
---

# 🛑 ADR Granularity Instructions

**YOUR DIRECTIVE:** You must output exactly ONE decision per ADR (Single Decision Principle). If the conversation covers multiple architectural choices, you must split them into separate ADRs.

Apply these 3 heuristics to determine if you must split decisions:

### 1. The Disagreement Test (Primary)
- **RULE:** If another engineer could reasonably agree with one part of the proposed architecture but disagree with another, **YOU MUST SPLIT** the topics into multiple ADRs.

### 2. The Lifecycle Test
- **RULE:** If one part of a decision might be replaced in the future while the other remains valid (e.g., swapping the Database but keeping the Auth Provider), **YOU MUST SPLIT** them.
- **Why:** Grouping them creates a "zombie" ADR where half is valid and half is superseded.

### 3. Coupling vs Cohesion
- **DISTINCT BUT RELATED:** **SPLIT** them into separate ADRs and cross-link via the `References` section.
  - *Example:* "Choosing Postgres as Database" and "Choosing Prisma as ORM" -> **2 ADRs**.
- **HIGHLY COHESIVE:** **KEEP TOGETHER** if they are inextricably linked.
  - *Example:* "Choosing Postgres" and "Using a Master-Replica setup for Postgres" -> **1 ADR**.

### 4. Chronological Overrides (The "Nevermind" Rule)
- **RULE:** If a decision is made but explicitly reversed or replaced later *within the same conversation/transcript*, the initial decision is **NOT** a separate ADR.
- **Action:** You must treat the aborted decision as a **Rejected Alternative** within the ADR of the final, surviving decision. Do not extract it as its own ADR.
