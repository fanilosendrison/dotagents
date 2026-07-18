# CDD Structural Reference

When validating the structure of a CDD, or when granted `/go` to format a raw draft, enforce this exact layout and YAML metadata.

```yaml
---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "YYYY-MM-DD"
step_id: 0                         # Conception step
id: CDD-I-WORKSPACE-SETUP          # Unique identifier (Must be prefixed by CDD-O, CDD-N, CDD-I, or CDD-S)
version: "1.0.0"
scope: run-init                    # System covered
status: draft                      # draft | baselined | extracted-archive | superseded
consumers: [agent-generator]
superseded_by: []                  # Filled on archival (points to NIBs/ADRs)
---
```

## Mandatory Markdown Headers

The document must contain exactly these 11 headers in this exact order. 
*(Note: '4. Pipeline' is explicitly omitted for CDD-I profiles).*

1. **Objectif & Position**
2. **Goals & Non-Goals**
3. **Data Contracts (Inputs & Outputs)**
4. **Pipeline**
5. **Invariants**
6. **Internal Operations**
7. **Cross-Cutting Concerns**
8. **Infrastructure & Environment**
9. **Dependencies**
10. **Testing Strategy**
11. **Glossary**
