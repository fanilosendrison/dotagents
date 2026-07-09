---
name: fix-a-bug
description: Use this skill whenever you are asked to fix something, understand a bug, or when you yourself need to resolve a bug. It contains the mandatory protocol for bug resolution and checking known issues.
---

# Fix a Bug

Before taking any action to fix or understand a bug, you must first read the known bugs registry:
`/Users/famillesendrison/.agents/memory/bug-fixes.md`

Then, you must follow this mandatory 3-step protocol:

## Step 1: Bug Reproduction
Before starting to fix a bug, you must always reproduce it end-to-end (E2E) under conditions as close as possible to final usage. This ensures the real problem is isolated and the future fix will actually work.

## Step 2: Bug Fix Testing
Once the bug is resolved, you must systematically write the test that would have detected this bug had it existed before, if possible.

## Step 3: Test Integrity
The added test must not "cheat". It must validate the actual behavior end-to-end and not merely artificially mock the boundaries of the system.
