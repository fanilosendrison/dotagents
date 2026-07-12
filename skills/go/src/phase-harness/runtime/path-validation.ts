import * as path from "node:path";

export const reservedRootFilenames = new Set([
  "output.json",
  "stdout.txt",
  "stderr.txt",
]);

export function containsNulByte(value: string): boolean {
  return value.includes("\0");
}

export function hasBacktrackingSegment(value: string): boolean {
  return value.split(/[\\/]/u).includes("..");
}

export function hasPosixBacktrackingSegment(value: string): boolean {
  return value.split("/").includes("..");
}

export function isInvalidEvidenceRef(value: string): boolean {
  return (
    value.length === 0 ||
    path.isAbsolute(value) ||
    containsNulByte(value) ||
    hasBacktrackingSegment(value) ||
    reservedRootFilenames.has(value)
  );
}

export function isInvalidRepoRelativePosixPath(value: string): boolean {
  return (
    value.length === 0 ||
    path.isAbsolute(value) ||
    containsNulByte(value) ||
    hasPosixBacktrackingSegment(value)
  );
}

export function isPathInside(parent: string, child: string): boolean {
  return child.startsWith(parent + path.sep);
}
