export function stringifyThrownValue(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    const serialized = JSON.stringify(cause);
    if (serialized !== undefined && serialized.length > 0) {
      return serialized;
    }
  } catch {
    return "Phase threw a non-serializable value";
  }

  return "Phase threw a non-serializable value";
}
