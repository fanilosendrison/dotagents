---
name: session-lookup
description: Tells you where to find the local session history/transcripts for all LLM agents (Antigravity, Claude Code, Codex, Pi, ChatGPT, and Claude chat). Use this skill when you need to search or look up past conversation logs/sessions, or when the user asks to look up, locate, or inspect past session history.
---

# Session Lookup

The centralized entry point for all LLM session histories is:

`/Users/famillesendrison/neelopedia/llm-sessions-history/`

- **Coding agents** (Antigravity, Claude Code, Codex, Pi): symlinks → live native directories. Read them directly.
- **Chat agents** (ChatGPT, Claude): one-time export snapshots. Use `conversations-XXX.json` (ChatGPT) or `conversations.json` + `projects/*.json` (Claude) for transcripts. Use `chat.html` to browse ChatGPT exports in a browser.

## Folder Structure

```
llm-sessions-history/
├── chat-agents-sessions/
│   ├── chatgpt/
│   │   └── <export-timestamp>/
│   │       ├── conversations-XXX.json   ← conversation transcripts (numbered)
│   │       ├── chat.html                ← full chat export as HTML
│   │       ├── user.json                ← user profile
│   │       ├── export_manifest.json     ← export metadata
│   │       ├── shared_conversations.json
│   │       ├── message_feedback.json
│   │       ├── conversation_asset_file_names.json
│   │       ├── ads.json
│   │       ├── library_files.json
│   │       └── file-*.dat               ← attached files/assets
│   └── claude/
│       └── <batch-id>/
│           ├── conversations.json       ← all conversations
│           ├── users.json               ← user metadata
│           ├── memories.json            ← Claude memories
│           └── projects/
│               └── <project-id>.json    ← per-project conversations
└── coding-agents-sessions/
    ├── antigravity/
    │   ├── brain/            → ~/.gemini/antigravity-ide/brain          (symlink)
    │   └── conversations/    → ~/.gemini/antigravity-ide/conversations  (symlink)
    ├── claude-code/
    │   ├── history.jsonl     → ~/.claude/history.jsonl                  (symlink)
    │   ├── journal/          → ~/.claude/journal/                       (symlink)
    │   └── sessions/         → ~/.claude/sessions/                      (symlink)
    ├── codex/                → ~/.codex/sessions                        (symlink)
    └── pi/                   → ~/.pi/agent/sessions                     (symlink)
```

---

## Coding Agents — Canonical Source Paths & Formats

### Antigravity
- **Brain logs**: `~/.gemini/antigravity-ide/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`
- **Databases**: `~/.gemini/antigravity-ide/conversations/<conversation-id>.db` (+ `.db-shm`, `.db-wal`)

### Claude Code
- **History**: `~/.claude/history.jsonl` — all queries, commands, timestamps keyed by `sessionId`
- **Journal** (daily summaries): `~/.claude/journal/`
- **Sessions**: `~/.claude/sessions/`

### Codex
- **Transcripts**: `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<Timestamp>-<SessionID>.jsonl`
- **Session index**: `~/.codex/session_index.jsonl`
- **Databases**: `~/.codex/logs_2.sqlite`, `state_5.sqlite`, `goals_1.sqlite`, `memories_1.sqlite`

### Pi
- **Transcripts**: `~/.pi/agent/sessions/--Users-famillesendrison--/<Timestamp>_<SessionID>.jsonl`

---

## Chat Agents — Export Structures

### ChatGPT
- **Location**: `llm-sessions-history/chat-agents-sessions/chatgpt/<export-timestamp>/`
- **Key files**: `conversations-XXX.json` (transcripts), `chat.html` (browsable export), `user.json`, `export_manifest.json`, `file-*.dat` (assets)

### Claude (Chat)
- **Location**: `llm-sessions-history/chat-agents-sessions/claude/<batch-id>/`
- **Key files**: `conversations.json` (all transcripts), `users.json`, `memories.json`, `projects/<project-id>.json`


