import { describe, expect, test } from "bun:test";
import { extractTouchedFilesFromApplyPatch } from "./patch-files";

describe("extractTouchedFilesFromApplyPatch", () => {
	test("extracts added and updated files as absolute paths", () => {
		const patch = `*** Begin Patch
*** Add File: src/new.ts
+export const value = 1;
*** Update File: src/existing.ts
@@
-old
+new
*** End Patch
`;

		expect(extractTouchedFilesFromApplyPatch(patch, "/repo")).toEqual([
			"/repo/src/new.ts",
			"/repo/src/existing.ts",
		]);
	});

	test("keeps absolute paths and deduplicates repeated files", () => {
		const patch = `*** Begin Patch
*** Update File: /tmp/app.ts
@@
+a
*** Update File: /tmp/app.ts
@@
+b
*** End Patch
`;

		expect(extractTouchedFilesFromApplyPatch(patch, "/repo")).toEqual([
			"/tmp/app.ts",
		]);
	});

	test("includes move destinations and ignores deletes", () => {
		const patch = `*** Begin Patch
*** Update File: src/old.ts
*** Move to: src/new.ts
@@
+new
*** Delete File: src/deleted.ts
*** End Patch
`;

		expect(extractTouchedFilesFromApplyPatch(patch, "/repo")).toEqual([
			"/repo/src/old.ts",
			"/repo/src/new.ts",
		]);
	});
});
