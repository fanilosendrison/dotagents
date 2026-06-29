#!/usr/bin/env bun

import { readHookInput } from "../../../shared/runtime/read-hook-input";
import { exitAllow, respondPreToolDeny } from "../../../shared/runtime/respond";
import { checkPath, checkBashCommand } from "../core/path-guard";

async function main() {
  const input = await readHookInput();
  if (!input || input.hook_event_name !== "PreToolUse") {
    process.exit(0);
  }

  // Guard Write and Edit
  if (input.tool_name === "Write" || input.tool_name === "Edit") {
    const filePath = input.tool_input?.file_path;
    if (typeof filePath === "string" && filePath) {
      const result = checkPath(filePath);
      if (!result.allowed) {
        respondPreToolDeny(result.reason!);
      }
    }
    exitAllow();
  }

  // Guard Bash
  if (input.tool_name === "Bash") {
    const command = input.tool_input?.command;
    if (typeof command === "string" && command) {
      const result = checkBashCommand(command);
      if (!result.allowed) {
        respondPreToolDeny(result.reason!);
      }
    }
    exitAllow();
  }

  exitAllow();
}

main().catch((error) => {
  console.error("path-guard pre-tool-use error:", error instanceof Error ? error.message : String(error));
  exitAllow();
});
