export interface FacadeEntry {
	readonly source: string;
	readonly destination: string;
	readonly kind: "file" | "directory";
}

export type CheckStatus =
	| "OK"
	| "SOURCE_MISSING"
	| "DESTINATION_MISSING"
	| "DESTINATION_NOT_SYMLINK"
	| "BROKEN_SYMLINK"
	| "WRONG_TARGET";

export interface CheckResult {
	entry: FacadeEntry;
	status: CheckStatus;
	detail?: string;
}

export interface FacadeReport {
	results: CheckResult[];
	okCount: number;
	failCount: number;
}
