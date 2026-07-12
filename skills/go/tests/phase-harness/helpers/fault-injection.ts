export type FaultInjection = {
  failGitCommand?: "rev-parse-head" | "status" | "ls-files-s";
};

export async function withGitFault<T>(
  _fault: FaultInjection,
  run: () => Promise<T>,
): Promise<T> {
  return await run();
}
