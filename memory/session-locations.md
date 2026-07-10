# Session Locations for Antigravity, Codex, Pi, and Claude Code

This file documents the exact locations and structure of local session/conversation history for the four agent harnesses.

## 1. Antigravity Sessions
* **Logs & Transcripts**: `/Users/famillesendrison/.gemini/antigravity-ide/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`
* **Databases**: `/Users/famillesendrison/.gemini/antigravity-ide/conversations/` (contains `<conversation-id>.db`, `<conversation-id>.db-shm`, and `<conversation-id>.db-wal`)

## 2. Codex Sessions
* **Logs & Transcripts**: `/Users/famillesendrison/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<Timestamp>-<SessionID>.jsonl`
* **Session Index**: `/Users/famillesendrison/.codex/session_index.jsonl`
* **Databases**:
  * Logs: `/Users/famillesendrison/.codex/logs_2.sqlite`
  * State: `/Users/famillesendrison/.codex/state_5.sqlite`
  * Goals: `/Users/famillesendrison/.codex/goals_1.sqlite`
  * Memories: `/Users/famillesendrison/.codex/memories_1.sqlite`

## 3. Pi Sessions
* **Logs & Transcripts**: `/Users/famillesendrison/.pi/agent/sessions/--Users-famillesendrison--/<Timestamp>_<SessionID>.jsonl` (or the corresponding sanitized workspace directory)

## 4. Claude Code Sessions
* **Logs & Transcripts**: `/Users/famillesendrison/.claude/history.jsonl` (Contains all queries, executed commands, and timestamps mapped by `sessionId`)
* **Journal (Daily Summaries)**: `/Users/famillesendrison/.claude/journal/`
* **Sessions Directory**: `/Users/famillesendrison/.claude/sessions/`
