export interface ScanResult {
	clean: boolean;
	findings: Finding[];
}

export interface Finding {
	name: string;
	line: string;
	lineNumber: number;
}
