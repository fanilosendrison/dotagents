---
name: go
description: Grants the agent temporary clearance to use file-modifying tools. NEVER autoload this skill — it must be invoked only when the user explicitly types /go or <skill name="go">.
---

Immediately read the following file:
[implementation.md](file:///Users/famillesendrison/.agents/operational-rules/implementation.md)

This skill is an authorization marker and an instruction loader. It does not
choose the task by itself: after reading `implementation.md`, continue with the
user's requested work and keep respecting the gateway/path-guard rules.

The shared permission enforcer also records prompts containing `/go` or
`<skill name="go">` so restricted write/edit tools can run for the authorized
turn. Never self-trigger this skill.
