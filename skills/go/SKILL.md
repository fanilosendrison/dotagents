---
name: Explicit Implementation Authorizer (/go)
description: Grants the agent temporary clearance to use file-modifying tools like 'Write', 'Edit', or 'write_to_file', which are blocked by default. Requires the agent to immediately review the implementation rules before proceeding.
---

# Instruction for the Agent

The user has explicitly typed `/go` in their prompt to authorize you to implement changes in this turn.

**You are now cleared to use code editing tools.**

### ⚠️ MANDATORY PREREQUISITE BEFORE CODING:
Even though you are authorized, you **MUST NOT** write or edit any code until you have read the project's implementation rules. 
If you haven't read them in this conversation yet, you must immediately read the following file:
`~/.agents/operational-rules/implementation.md`

Read it, acknowledge its constraints, and then proceed with your implementation.
