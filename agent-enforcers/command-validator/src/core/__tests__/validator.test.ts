import { describe, expect, test, spyOn, beforeEach, afterEach } from "bun:test";
import { CommandValidator } from "../validator.ts";
import * as state from "../../../../permission-enforcer/src/core/state.ts";

const validator = new CommandValidator();

describe("CommandValidator Core Unit Tests", () => {
	test("allows safe commands", () => {
		const safeCmds = [
			"ls -la",
			"git status",
			"npm install",
			"bun test",
			"echo hello",
			"cat file.txt",
			"find . -name '*.ts'",
			"mkdir /tmp/test",
		];
		for (const cmd of safeCmds) {
			expect(validator.validate(cmd).action).toBe("allow");
		}
	});

	test("allows chmod +x", () => {
		expect(validator.validate("chmod +x script.sh").action).toBe("allow");
		expect(validator.validate("chmod +x ./bin/tool").action).toBe("allow");
	});

	test("allows invalid/non-string input", () => {
		expect(validator.validate(null).action).toBe("deny");
		expect(validator.validate(undefined).action).toBe("deny");
		expect(validator.validate(42).action).toBe("deny");
		expect(validator.validate("").action).toBe("deny");
	});

	test("denies rm -rf variants", () => {
		const blocked = [
			"rm -rf /",
			"rm -rf /etc",
			"rm -r -f /tmp/stuff",
			"rm -f -r /tmp/stuff",
			"rm -rf /usr",
			"rm -rf /home/user",
			"rm -rf ../..",
			"rm -rf $HOME",
			"rm -rf *",
		];
		for (const cmd of blocked) {
			expect(validator.containsRmRf(cmd)).toBe(true);
		}
	});

	test("long flags like --recursive --force are NOT caught by containsRmRf", () => {
		expect(validator.containsRmRf("rm --recursive --force /tmp/x")).toBe(false);
	});

	test("denies command with rm -rf verified by validate", () => {
		const result = validator.validate("rm -rf /tmp/stuff");
		expect(result.action).toBe("deny");
		expect(result.severity).toBe("CRITICAL");
		expect(result.violations).toContain("❌ rm -rf is forbidden - use trash instead");
	});

	test("asks for dangerous commands", () => {
		const dangerous = [
			"sudo ls",
			"su -",
			"passwd user",
			"chmod 755 file",
			"chown user file",
			"kill 1234",
			"systemctl restart nginx",
			"mount /dev/sda1 /mnt",
			"dd if=/dev/zero of=test bs=1M count=10",
			"shred file.txt",
			"mkfs.ext4 /dev/sdb1",
		];
		for (const cmd of dangerous) {
			const result = validator.validate(cmd);
			expect(result.action).toBe("ask");
			expect(result.severity).toBe("HIGH");
		}
	});

	test("network commands are allowed by shared validator", () => {
		expect(validator.validate("nc -l 8080").action).toBe("allow");
		expect(validator.validate("nmap localhost").action).toBe("allow");
		expect(validator.validate("iptables -L").action).toBe("allow");
	});

	test("detects dangerous command in pipeline", () => {
		const results = [
			validator.validate("echo ok; sudo ls"),
			validator.validate("true && kill 1234"),
		];
		for (const r of results) {
			expect(r.action).toBe("ask");
		}
	});

	test("containsRmRf edge cases", () => {
		expect(validator.containsRmRf("git rm file.txt")).toBe(false);
		expect(validator.containsRmRf("npm rm package")).toBe(false);
		expect(validator.containsRmRf("echo 'rm -rf is bad'")).toBe(true);
	});

	test("containsDangerousCommand returns null for safe", () => {
		expect(validator.containsDangerousCommand("ls -la")).toBeNull();
		expect(validator.containsDangerousCommand("git status")).toBeNull();
	});

	test("containsDangerousCommand returns command name", () => {
		expect(validator.containsDangerousCommand("sudo rm file")).toBe("sudo");
		expect(validator.containsDangerousCommand("kill -9 123")).toBe("kill");
	});

	describe("Modifying tools permission validation", () => {
		let isPermissionGrantedSpy: any;

		beforeEach(() => {
			isPermissionGrantedSpy = spyOn(state, "isPermissionGranted");
		});

		afterEach(() => {
			isPermissionGrantedSpy.mockRestore();
		});

		test("blocks modifying tools when permission is false", () => {
			isPermissionGrantedSpy.mockReturnValue(false);
			const result = validator.validate("some-content", "write_to_file");
			expect(result.action).toBe("deny");
			expect(result.severity).toBe("CRITICAL");
			expect(result.violations[0]).toContain("Permission denied. You cannot implement code");
		});

		test("allows modifying tools when permission is true, without applying bash rules", () => {
			isPermissionGrantedSpy.mockReturnValue(true);
			// Si un outil de modification contient une chaîne de commande bash dangereuse, 
			// il ne doit PAS être bloqué (ex: écrire un script contenant rm -rf)
			const result = validator.validate("rm -rf /", "write_to_file");
			expect(result.action).toBe("allow");
		});

		test("allows non-modifying tools even when permission is false", () => {
			isPermissionGrantedSpy.mockReturnValue(false);
			const result = validator.validate("ls", "Bash");
			expect(result.action).toBe("allow");
		});
	});
});
