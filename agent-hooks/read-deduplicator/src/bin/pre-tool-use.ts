#!/usr/bin/env bun

import { readHookInput } from "../../../shared/runtime/read-hook-input";
import { exitAllow, respondPreToolDeny } from "../../../shared/runtime/respond";
import { createReadTracker } from "../core/read-tracker";
import { statSync } from "node:fs";

const tracker = createReadTracker();
let currentTurn = 0;

async function main() {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (input.hook_event_name === "PreToolUse") {
    if (input.tool_name === "Read") {
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

      // First read or file modified — allow
      if (!entry || entry.fingerprint !== fingerprint) {
        exitAllow();
      }

      // Same fingerprint, still in context — block
      if (entry.stillInContext) {
        respondPreToolDeny(`(already in context, turn ${entry.turn})`);
      }

      // Same fingerprint, truncated — allow
      exitAllow();
    }

    // Other tool types — not our concern
    exitAllow();
  }

  if (input.hook_event_name === "PostToolUse") {
    if (input.tool_name === "Read") {
      const path = input.tool_input?.file_path;
      const toolOutput = input.tool_output;
      if (typeof path !== "string" || !path || !toolOutput) {
        process.exit(0);
      }

      let fingerprint: string;
      try {
        const stat = statSync(path);
        fingerprint = `${stat.mtimeMs}:${stat.size}`;
      } catch {
        process.exit(0);
      }

      const textContent = typeof toolOutput === "string"
        ? toolOutput
        : JSON.stringify(toolOutput);

      tracker.track(path, fingerprint, currentTurn, textContent);
    }

    exitAllow();
  }

  exitAllow();
}

main().catch((error) => {
  console.error("read-deduplicator hook error:", error instanceof Error ? error.message : String(error));
  exitAllow();
});
