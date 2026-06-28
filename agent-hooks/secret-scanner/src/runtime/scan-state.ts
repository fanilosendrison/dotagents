import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STORE_FILE = join(import.meta.dir, "../../data/scan-state.json");
const STATE_TTL_MS = 15 * 60 * 1000;

interface CleanScanEntry {
	sessionId: string;
	commandHash: string;
	command: string;
	createdAt: string;
	consumedAt?: string;
}

interface ScanStateStore {
	cleanScans: CleanScanEntry[];
}

export function hashCommand(command: string): string {
	return createHash("sha256").update(command).digest("hex");
}

export async function recordCleanScan(
	sessionId: string,
	command: string,
): Promise<void> {
	const store = await readStore();
	const now = Date.now();
	const commandHash = hashCommand(command);
	store.cleanScans = pruneExpired(store.cleanScans, now).filter(
		(entry) =>
			!(
				entry.sessionId === sessionId &&
				entry.commandHash === commandHash &&
				!entry.consumedAt
			),
	);

	store.cleanScans.push({
		sessionId,
		commandHash,
		command,
		createdAt: new Date(now).toISOString(),
	});
	await writeStore(store);
}

export async function consumeCleanScan(
	sessionId: string,
	command: string,
): Promise<boolean> {
	const store = await readStore();
	const now = Date.now();
	const commandHash = hashCommand(command);
	store.cleanScans = pruneExpired(store.cleanScans, now);

	const entry = store.cleanScans.find(
		(entry) =>
			entry.sessionId === sessionId &&
			entry.commandHash === commandHash &&
			!entry.consumedAt,
	);

	if (!entry) {
		await writeStore(store);
		return false;
	}

	entry.consumedAt = new Date(now).toISOString();
	await writeStore(store);
	return true;
}

async function readStore(): Promise<ScanStateStore> {
	try {
		const raw = await readFile(STORE_FILE, "utf8");
		const parsed = JSON.parse(raw) as Partial<ScanStateStore>;
		return {
			cleanScans: Array.isArray(parsed.cleanScans) ? parsed.cleanScans : [],
		};
	} catch {
		return { cleanScans: [] };
	}
}

async function writeStore(store: ScanStateStore): Promise<void> {
	await mkdir(dirname(STORE_FILE), { recursive: true });
	await writeFile(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

function pruneExpired(entries: CleanScanEntry[], now: number): CleanScanEntry[] {
	return entries.filter((entry) => {
		const createdAt = Date.parse(entry.createdAt);
		return Number.isFinite(createdAt) && now - createdAt <= STATE_TTL_MS;
	});
}
