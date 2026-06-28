/**
 * Shared read-tracker logic — used by Pi extensions and agent hooks.
 *
 * Tracks which files have been read in a session so that re-reading
 * an identical, still-in-context file can be short-circuited.
 */
export interface TrackEntry {
  fingerprint: string;
  turn: number;
}

export function createReadTracker() {
  const map = new Map<string, TrackEntry>();

  return {
    /** Look up the tracked entry for a path, or undefined if not yet read. */
    get(path: string): TrackEntry | undefined {
      return map.get(path);
    },

    /** Store (or update) the track entry for a path. */
    track(path: string, fingerprint: string, turn: number): void {
      map.set(path, { fingerprint, turn });
    },
  };
}
