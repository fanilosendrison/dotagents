#!/usr/bin/env bun

import { readHookInput } from "../../../shared/runtime/read-hook-input";
import { exitAllow, respondPreToolDeny } from "../../../shared/runtime/respond";
import { createReadTracker } from "../core/read-tracker";
import { statSync } from "node:fs";

const TURN_THRESHOLD = 50;
const tracker = createReadTracker();
let currentTurn = 0;

async function main() {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (input.hook_event_name === "PreToolUse") {
    if (input.tool_name !== "Read") {
      process.exit(0);
    }

    const path = input.tool_input?.file_path;
    if (typeof path !== "string" || !path) {
      process.exit(0);
    }

    let fingerprint: string;
    try {
      const stat = statSync(path);
      fingerprint = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      process.exit(0);
    }

    const entry = tracker.get(path);

    if (!entry) {
      tracker.track(path, fingerprint, currentTurn);
      exitAllow();
    }

    if (entry.fingerprint !== fingerprint) {
      tracker.track(path, fingerprint, currentTurn);
      exitAllow();
    }

    if (currentTurn - entry.turn < TURN_THRESHOLD) {
      respondPreToolDeny(`(already in context, turn ${entry.turn})`);
    }

    tracker.track(path, fingerprint, currentTurn);
    exitAllow();
  }

  exitAllow();
}

main().catch((error) => {
  console.error("read-deduplicator pre-tool-use error:", error instanceof Error ? error.message : String(error));
  exitAllow();
});
