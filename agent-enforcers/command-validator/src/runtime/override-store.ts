import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STORE_FILE = join(import.meta.dir, "../../data/overrides.json");
const TOKEN_TTL_MS = 15 * 60 * 1000;

interface OverrideEntry {
	token: string;
	sessionId: string;
	commandHash: string;
	command: string;
	createdAt: string;
	approvedAt?: string;
	consumedAt?: string;
}

interface OverrideStore {
	overrides: OverrideEntry[];
}

export function hashCommand(command: string): string {
	return createHash("sha256").update(command).digest("hex");
}

export async function createApprovalToken(
	sessionId: string,
	command: string,
): Promise<string> {
	const store = await readStore();
	const now = Date.now();
	const commandHash = hashCommand(command);
	store.overrides = pruneExpired(store.overrides, now);

	const existing = store.overrides.find(
		(entry) =>
			entry.sessionId === sessionId &&
			entry.commandHash === commandHash &&
			!entry.approvedAt &&
			!entry.consumedAt,
	);

	if (existing) {
		await writeStore(store);
		return existing.token;
	}

	const token = randomBytes(12).toString("hex");
	store.overrides.push({
		token,
		sessionId,
		commandHash,
		command,
		createdAt: new Date(now).toISOString(),
	});
	await writeStore(store);
	return token;
}

export async function approveToken(
	sessionId: string,
	token: string,
): Promise<boolean> {
	const store = await readStore();
	const now = Date.now();
	store.overrides = pruneExpired(store.overrides, now);

	const entry = store.overrides.find(
		(entry) =>
			entry.sessionId === sessionId &&
			entry.token === token &&
			!entry.approvedAt &&
			!entry.consumedAt,
	);

	if (!entry) {
		await writeStore(store);
		return false;
	}

	entry.approvedAt = new Date(now).toISOString();
	await writeStore(store);
	return true;
}

export async function consumeOverride(
	sessionId: string,
	command: string,
): Promise<boolean> {
	const store = await readStore();
	const now = Date.now();
	const commandHash = hashCommand(command);
	store.overrides = pruneExpired(store.overrides, now);

	const entry = store.overrides.find(
		(entry) =>
			entry.sessionId === sessionId &&
			entry.commandHash === commandHash &&
			entry.approvedAt &&
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

async function readStore(): Promise<OverrideStore> {
	try {
		const raw = await readFile(STORE_FILE, "utf8");
		const parsed = JSON.parse(raw) as Partial<OverrideStore>;
		return { overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [] };
	} catch {
		return { overrides: [] };
	}
}

async function writeStore(store: OverrideStore): Promise<void> {
	await mkdir(dirname(STORE_FILE), { recursive: true });
	await writeFile(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

function pruneExpired(entries: OverrideEntry[], now: number): OverrideEntry[] {
	return entries.filter((entry) => {
		const createdAt = Date.parse(entry.createdAt);
		return Number.isFinite(createdAt) && now - createdAt <= TOKEN_TTL_MS;
	});
}
