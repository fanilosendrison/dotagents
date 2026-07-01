#!/usr/bin/env bun

import {
  getToolCommand,
  readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
  respondPreToolDeny,
} from "../../../shared/runtime/respond";
import {
  isGitCommit,
  extractMessage,
  isValidCC,
  hasPush,
} from "../core/validator";

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input || input.tool_name !== "Bash") {
    process.exit(0);
  }

  const command = getToolCommand(input);
  if (typeof command !== "string" || !isGitCommit(command)) {
    process.exit(0);
  }

  // Allow git commit without -m (interactive editor)
  const msg = extractMessage(command);
  if (msg === null) {
    process.exit(0);
  }

  // Block if the inline message doesn't look like Conventional Commits
  if (!isValidCC(msg)) {
    respondPreToolDeny(
      "❌ COMMAND BLOCKED BY ENFORCER:\n" +
      "Use /git-commits-push to generate a Conventional Commits message.\n" +
      `Got: "${msg.slice(0, 60)}" — expected: <type>(<scope>): <description>`
    );
  }

  // Block if commit is not followed by push
  if (!hasPush(command)) {
    respondPreToolDeny(
      "❌ COMMAND BLOCKED BY ENFORCER:\n" +
      "Always push after commit. Use: git commit ... && git push\n" +
      "Or invoke /git-commits-push which handles this automatically."
    );
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(
    "git-commits-push-enforcer error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
});
