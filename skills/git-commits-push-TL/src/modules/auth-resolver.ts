/**
 * src/modules/auth-resolver.ts — Resolves the LLM API token.
 *
 * Implements NIB-M-AUTH-RESOLVER §3.
 * Reads from ENV, then ~/.pi/agent/auth.json, and supports dynamic command execution.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";

export async function resolveAuthToken(provider: string): Promise<string> {
	const envKey = `${provider.toUpperCase()}_API_KEY`;

	// 1. Check System Environment Variable
	if (process.env[envKey]) {
		return process.env[envKey].trim();
	}

	// 2. Read ~/.pi/agent/auth.json
	const authFilePath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	let authData: Record<string, string>;
	try {
		const raw = fs.readFileSync(authFilePath, "utf-8");
		authData = JSON.parse(raw);
	} catch {
		throw new Error(
			`Authentication token for provider ${provider} not found in env and failed to read auth.json`,
		);
	}

	const tokenConfig = authData[provider];
	if (!tokenConfig) {
		throw new Error(
			`Authentication token for provider ${provider} not found in env or auth.json`,
		);
	}

	const trimmedConfig = tokenConfig.trim();

	// 3. Dynamic Execution (Starts with !)
	if (trimmedConfig.startsWith("!")) {
		const command = trimmedConfig.slice(1);
		// execSync throws if exit code !== 0, which correctly propagates
		const result = execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
		return result.trim();
	}

	// 4. Raw static token
	return trimmedConfig;
}
