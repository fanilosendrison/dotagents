---
name: file-and-folder-naming
description: You MUST strictly adhere to these file and directory naming rules whenever you create or rename anything in the workspace. Use kebab-case by default.
type: global-convention
---

# Naming Conventions

> 🛑 **CRITICAL DIRECTIVE**: Non-negotiable workspace constraints. Any violation breaks system routing. Do not attempt to be creative.

## 1. Default: `kebab-case`

Use `kebab-case` by default for files, scripts, and directories, except where one of the strictly scoped exceptions below applies.

- **DO**: `user-profile/`, `data-parser.ts`, `api-routes.js`, `run-tests.sh`
- **DO NOT**: `UserProfile/`, `data_parser.ts`, `apiRoutes.js`, `my file.txt`

## 2. Allowed Exceptions (Strictly Scoped)

You may ONLY deviate from `kebab-case` in these three exact scenarios:

1. **System Entry Points**: Use `UPPERCASE.md` (e.g., `SKILL.md`, `CONTEXT.md`, `README.md`).
2. **UI Components**: Use `PascalCase` ONLY for UI files matching an exported component (e.g., `UserProfile.tsx`, `PrimaryButton.vue`).

### Python importable modules, packages and tests

For Python files that must be imported as modules, loaded as packages, executed using `python -m`, or discovered as Python tests, use lowercase `snake_case` names consistent with Python import and test-discovery conventions.

This includes:

- Importable modules such as `pre_model_worker_v3.py`.
- Test modules such as `test_issue70_rwp02_worker.py`.
- Importable packages such as `review_broker/`.
- Standard Python entry points and discovery files, including `__init__.py`, `__main__.py` and `conftest.py`.

This exception applies only to Python importability, package structure, execution and test-discovery requirements.

Standalone Python scripts that are not imported or executed as modules retain the default `kebab-case` rule.

This exception does not authorize underscores in unrelated TypeScript, JavaScript, Markdown or general-purpose filenames.

Do not rename existing files solely to enforce the new convention.

## 3. Hard Prohibitions

- **NO spaces**.
- **NO special characters** (only alphanumeric, hyphens, and periods), except underscores solely within the scope of the third exception for Python importable modules, packages and tests.
