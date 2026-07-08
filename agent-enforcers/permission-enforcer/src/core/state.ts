import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export function getInternalStatePath(): string {
    if (process.env.PERMISSION_STATE_PATH) {
        return process.env.PERMISSION_STATE_PATH;
    }
    const homeDir = process.env.HOME || "/tmp";
    return `${homeDir}/.agents/agent-enforcers/permission-enforcer/.state/config.json`;
}

export function updatePermissionState(promptText: string): void {
    const isAllowed = /(^|\s)\/go(\s|$)/.test(promptText);
    const statePath = getInternalStatePath();
    const dir = dirname(statePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(statePath, JSON.stringify({ allowed: isAllowed }), "utf-8");
}

export function isPermissionGranted(): boolean {
    const statePath = getInternalStatePath();
    if (!existsSync(statePath)) return false;
    try {
        const data = JSON.parse(readFileSync(statePath, "utf-8"));
        return data.allowed === true;
    } catch {
        return false;
    }
}
