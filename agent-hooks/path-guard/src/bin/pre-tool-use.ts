#!/usr/bin/env bun

import { readHookInput } from "../../../shared/runtime/read-hook-input";
import { exitAllow, respondPreToolDeny } from "../../../shared/runtime/respond";
import { checkPath } from "../core/path-guard";

async function main() {
  const input = await readHookInput();
  if (!input || input.hook_event_name !== "PreToolUse") {
    process.exit(0);
  }

  if (input.tool_name !== "Write" && input.tool_name !== "Edit") {
    process.exit(0);
  }

  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== "string" || !filePath) {
    process.exit(0);
  }

  const result = checkPath(filePath);
  if (!result.allowed) {
    respondPreToolDeny(result.reason!);
  }

  exitAllow();
}

main().catch((error) => {
  console.error("path-guard pre-tool-use error:", error instanceof Error ? error.message : String(error));
  exitAllow();
});
