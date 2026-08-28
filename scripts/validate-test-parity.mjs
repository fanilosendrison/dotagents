import { readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(
	repositoryRoot,
	"docs",
	"migrations",
	"node-pnpm",
	"test-parity.json",
);

function fail(message) {
	throw new Error(`Invalid test parity manifest: ${message}`);
}

function resolveTargetPath(targetFile) {
	const absoluteTargetPath = path.resolve(repositoryRoot, targetFile);
	const relativeTargetPath = path.relative(repositoryRoot, absoluteTargetPath);
	if (
		relativeTargetPath.length === 0 ||
		relativeTargetPath === ".." ||
		relativeTargetPath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeTargetPath)
	) {
		fail(`target escapes the repository: ${JSON.stringify(targetFile)}`);
	}
	return absoluteTargetPath;
}

async function readTargetFile(surface) {
	try {
		return await readFile(resolveTargetPath(surface.targetFile), "utf8");
	} catch (cause) {
		throw new Error(
			`Invalid test parity manifest: green target is unreadable: ${JSON.stringify(surface.targetFile)}`,
			{ cause },
		);
	}
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.surfaces)) {
	fail("surfaces must be an array");
}
if (manifest.expectedSurfaceCount !== manifest.surfaces.length) {
	fail(
		`expectedSurfaceCount is ${manifest.expectedSurfaceCount}, but ${manifest.surfaces.length} surfaces exist`,
	);
}

const sourceFiles = new Set();
const greenSurfaces = [];
for (const surface of manifest.surfaces) {
	if (sourceFiles.has(surface.sourceFile)) {
		fail(`duplicate sourceFile: ${JSON.stringify(surface.sourceFile)}`);
	}
	sourceFiles.add(surface.sourceFile);
	if (surface.parityStatus === "green") greenSurfaces.push(surface);
}
if (manifest.migratedSurfaceCount !== greenSurfaces.length) {
	fail(
		`migratedSurfaceCount is ${manifest.migratedSurfaceCount}, but ${greenSurfaces.length} green surfaces exist`,
	);
}

for (const surface of greenSurfaces) {
	const targetContents = await readTargetFile(surface);
	if (
		/\bfrom\s+["']bun:test["']|\brequire\(\s*["']bun:test["']\s*\)/.test(
			targetContents,
		)
	) {
		fail(
			`green target still imports bun:test: ${JSON.stringify(surface.targetFile)}`,
		);
	}
	for (const testCaseName of surface.testCaseNames) {
		if (!targetContents.includes(JSON.stringify(testCaseName))) {
			fail(
				`green target ${JSON.stringify(surface.targetFile)} is missing test case ${JSON.stringify(testCaseName)}`,
			);
		}
	}
}

process.stdout.write(
	`Validated ${manifest.surfaces.length} parity surfaces (${greenSurfaces.length} green).\n`,
);
