import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export type PermissionGrantSource = "slash" | "skill-tag" | "none";

export interface PermissionScope {
    agent: string;
    sessionId: string;
}

interface ScopedPermissionState {
    allowed: boolean;
    matchSource: PermissionGrantSource;
    updatedAt: string;
}

interface PermissionStateFile {
    allowed?: boolean;
    scopes?: Record<string, ScopedPermissionState>;
}

export function getInternalStatePath(): string {
    if (process.env.PERMISSION_STATE_PATH) {
        return process.env.PERMISSION_STATE_PATH;
    }
    const homeDir = process.env.HOME || "/tmp";
    return `${homeDir}/.agents/agent-enforcers/permission-enforcer/.state/config.json`;
}

export function detectPermissionGrantSource(promptText: string): PermissionGrantSource {
    if (/(^|\s)\/go(\s|$)/.test(promptText)) return "slash";
    if (/<skill\s+name=["']go["']/.test(promptText)) return "skill-tag";
    return "none";
}

export function updatePermissionState(promptText: string): boolean {
    const isAllowed = detectPermissionGrantSource(promptText) !== "none";
    const state = readPermissionState();
    state.allowed = isAllowed;
    writePermissionState(state);
    return isAllowed;
}

export function isPermissionGranted(): boolean {
    return readPermissionState().allowed === true;
}

export function getPermissionScopeKey(scope: PermissionScope): string {
    const agent = scope.agent.trim() || "unknown-agent";
    const sessionId = scope.sessionId.trim() || "unknown-session";
    return `${agent}:${sessionId}`;
}

export function updatePermissionStateForScope(
    promptText: string,
    scope: PermissionScope,
): boolean {
    const matchSource = detectPermissionGrantSource(promptText);
    const isAllowed = matchSource !== "none";
    const state = readPermissionState();
    const key = getPermissionScopeKey(scope);
    state.scopes = {
        ...(state.scopes ?? {}),
        [key]: {
            allowed: isAllowed,
            matchSource,
            updatedAt: new Date().toISOString(),
        },
    };
    writePermissionState(state);
    return isAllowed;
}

export function isPermissionGrantedForScope(scope: PermissionScope): boolean {
    const state = readPermissionState();
    const scopes = state.scopes;
    const key = getPermissionScopeKey(scope);

    if (scopes && Object.prototype.hasOwnProperty.call(scopes, key)) {
        return scopes[key]?.allowed === true;
    }

    // Migration fallback: sessions authorized before scoped state existed keep
    // working until their next prompt writes an explicit scoped entry.
    if (!scopes || Object.keys(scopes).length === 0) {
        return state.allowed === true;
    }

    return false;
}

function readPermissionState(): PermissionStateFile {
    const statePath = getInternalStatePath();
    if (!existsSync(statePath)) return {};

    try {
        const data = JSON.parse(readFileSync(statePath, "utf-8")) as unknown;
        if (!data || typeof data !== "object") return {};
        return data as PermissionStateFile;
    } catch {
        return {};
    }
}

function writePermissionState(state: PermissionStateFile): void {
    const statePath = getInternalStatePath();
    const dir = dirname(statePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(statePath, JSON.stringify(state), "utf-8");
}
