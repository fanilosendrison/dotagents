import assert from "node:assert/strict";
import { homedir } from "node:os";
import { describe, test } from "node:test";
import { BashValidator } from "../bash-validator.ts";
import { CommandValidator } from "../validator.ts";

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
			assert.strictEqual(validator.validate(cmd).action, "allow");
		}
	});

	test("allows chmod +x (single command only, no chaining)", () => {
		const allowed = [
			"chmod +x script.sh",
			"chmod +x ./bin/tool",
		];
		for (const cmd of allowed) {
			assert.strictEqual(validator.validate(cmd).action, "allow");
		}

		// Chained commands must NOT be allowed — the early return must not skip
		// later checks (e.g. rm -rf after a chmod +x).
		const chained = [
			"chmod +x script.sh; rm -rf /",
			"chmod +x script.sh && echo ok",
		];
		for (const cmd of chained) {
			const result = validator.validate(cmd);
			assert.notStrictEqual(result.action, "allow");
		}
	});

	test("allows invalid/non-string input", () => {
		assert.strictEqual(validator.validate(null).action, "deny");
		assert.strictEqual(validator.validate(undefined).action, "deny");
		assert.strictEqual(validator.validate(42).action, "deny");
		assert.strictEqual(validator.validate("").action, "deny");
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
			assert.strictEqual(validator.containsRmRf(cmd), true);
		}
	});

	test("catches rm --recursive --force (long and mixed flags)", () => {
		assert.strictEqual(validator.containsRmRf("rm --recursive --force /tmp/x"), true);
		assert.strictEqual(validator.containsRmRf("rm --force --recursive /tmp/x"), true);
		assert.strictEqual(validator.containsRmRf("rm -r --force /tmp/x"), true);
		assert.strictEqual(validator.containsRmRf("rm --recursive -f /tmp/x"), true);
	});

	test("rm --recursive alone is NOT caught (no force)", () => {
		assert.strictEqual(validator.containsRmRf("rm --recursive /tmp/x"), false);
	});

	test("rm --force alone is NOT caught (no recursive)", () => {
		assert.strictEqual(validator.containsRmRf("rm --force /tmp/x"), false);
	});

	test("denies command with rm -rf verified by validate", () => {
		const result = validator.validate("rm -rf /tmp/stuff");
		assert.strictEqual(result.action, "deny");
		assert.strictEqual(result.severity, "CRITICAL");
		assert.ok((result.violations).includes("❌ rm -rf is forbidden - use trash instead"));
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
		];
		for (const cmd of dangerous) {
			const result = validator.validate(cmd);
			assert.strictEqual(result.action, "ask");
			assert.strictEqual(result.severity, "HIGH");
		}
	});

	test("denies destructive patterns like mkfs to /dev", () => {
		const destructive = [
			"mkfs.ext4 /dev/sdb1",
			"shred -z -n 1 /dev/sda",
			"dd if=/dev/zero of=/dev/sda",
			"rm -rf /usr",
			":(){ :|:& };:",
		];
		for (const cmd of destructive) {
			const result = validator.validate(cmd);
			assert.strictEqual(result.action, "deny");
			assert.strictEqual(result.severity, "CRITICAL");
		}
	});

	test("network commands ask for confirmation", () => {
		assert.strictEqual(validator.validate("nc -l 8080").action, "ask");
		assert.strictEqual(validator.validate("nmap localhost").action, "ask");
		assert.strictEqual(validator.validate("iptables -L").action, "ask");
	});

	test("detects dangerous command in pipeline", () => {
		const results = [
			validator.validate("echo ok; sudo ls"),
			validator.validate("true && kill 1234"),
		];
		for (const r of results) {
			assert.strictEqual(r.action, "ask");
		}
	});

	test("containsRmRf edge cases", () => {
		assert.strictEqual(validator.containsRmRf("git rm file.txt"), false);
		assert.strictEqual(validator.containsRmRf("npm rm package"), false);
		assert.strictEqual(validator.containsRmRf("echo 'rm -rf is bad'"), true);
	});

	test("containsDangerousCommand returns null for safe", () => {
		assert.strictEqual(validator.containsDangerousCommand("ls -la"), null);
		assert.strictEqual(validator.containsDangerousCommand("git status"), null);
	});

	test("containsDangerousCommand returns command name", () => {
		assert.strictEqual(validator.containsDangerousCommand("sudo rm file"), "sudo");
		assert.strictEqual(validator.containsDangerousCommand("kill -9 123"), "kill");
	});

	describe("Modifying tools permission validation", () => {
		test("blocks modifying tools when permission is false", () => {
			const deniedValidator = new CommandValidator({
				isPermissionGranted: () => false,
			});
			const result = deniedValidator.validate("some-content", "write_to_file");
			assert.strictEqual(result.action, "deny");
			assert.strictEqual(result.severity, "CRITICAL");
			assert.ok((result.violations[0]).includes("Permission denied. You cannot implement code"));
		});

		test("allows modifying tools when permission is true, without applying bash rules", () => {
			const allowedValidator = new CommandValidator({
				isPermissionGranted: () => true,
			});
			// Si un outil de modification contient une chaîne de commande bash dangereuse,
			// il ne doit PAS être bloqué (ex: écrire un script contenant rm -rf)
			const result = allowedValidator.validate("rm -rf /", "write_to_file");
			assert.strictEqual(result.action, "allow");
		});

		test("allows non-modifying tools even when permission is false", () => {
			const deniedValidator = new CommandValidator({
				isPermissionGranted: () => false,
			});
			const result = deniedValidator.validate("ls", "Bash");
			assert.strictEqual(result.action, "allow");
		});

		test("supports an injected permission checker for scoped runtimes", () => {
			const allowedValidator = new CommandValidator({
				isPermissionGranted: () => true,
			});
			assert.strictEqual(allowedValidator.validate("content", "write_to_file").action, "allow");

			const deniedValidator = new CommandValidator({
				isPermissionGranted: () => false,
			});
			assert.strictEqual(deniedValidator.validate("content", "write_to_file").action, "deny");
		});
	});

	describe("Protected path write blocking", () => {
		const bashValidator = new BashValidator();

		test("denies writeFileSync to protected path", () => {
			const protectedPath = `${homedir()}/.agents/agent-enforcers/permission-enforcer/.state/config.json`;
			const result = bashValidator.validate(
				`node -e "writeFileSync('${protectedPath}', ...)"`,
			);
			assert.strictEqual(result.action, "deny");
			assert.ok((result.violations[0]).includes("Writing to protected paths is strictly forbidden"));
		});

		test("denies write to protected path with tilde", () => {
			const result = bashValidator.validate(
				'echo test > ~/.agents/agent-enforcers/permission-enforcer/.state/config.json',
			);
			assert.strictEqual(result.action, "deny");
		});

		test("denies write to protected path with $HOME", () => {
			const result = bashValidator.validate(
				'echo test > $HOME/.agents/agent-enforcers/permission-enforcer/.state/config.json',
			);
			assert.strictEqual(result.action, "deny");
		});

		test("denies write to protected path with ${HOME}", () => {
			const result = bashValidator.validate(
				'echo test > ${HOME}/.agents/agent-enforcers/permission-enforcer/.state/config.json',
			);
			assert.strictEqual(result.action, "deny");
		});

		test("denies P=~ tee variant", () => {
			const result = bashValidator.validate(
				'P=~/.agents/agent-enforcers/permission-enforcer/.state/config.json && echo ok | tee "$P"',
			);
			assert.strictEqual(result.action, "deny");
		});

		test("allows tilde to non-protected path", () => {
			assert.strictEqual(bashValidator.validate("echo test > ~/Desktop/test.txt").action, "allow");
		});

		test("allows $HOME to non-protected path", () => {
			assert.strictEqual(bashValidator.validate("echo test > $HOME/Documents/notes.txt").action, "allow");
		});

		test("allows writes to /dev/null (harmless data sink)", () => {
			assert.strictEqual(bashValidator.validate("grep -i 'ideal-review' session_index.jsonl 2>/dev/null").action, "allow");
			assert.strictEqual(bashValidator.validate("find /tmp -name '*.log' -type f 2>/dev/null | head -50").action, "allow");
			assert.strictEqual(bashValidator.validate("npm install 2>/dev/null").action, "allow");
		});

		test("still denies writes to /dev/sda (not /dev/null)", () => {
			assert.strictEqual(bashValidator.validate("echo bad > /dev/sda").action, "deny");
		});

		test("allows read-only access to protected path (cat, ls)", () => {
			assert.strictEqual(bashValidator.validate(
					"cat ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				).action, "allow");
			assert.strictEqual(bashValidator.validate(
					"ls ~/.agents/agent-enforcers/permission-enforcer/.state/",
				).action, "allow");
		});

		test("allows chained commands: harmless write (2>/dev/null) in one segment, read-only protected path in another", () => {
			assert.strictEqual(bashValidator.validate(
					"cat ~/.agents/agent-enforcers/permission-enforcer/.gitignore 2>/dev/null; echo '---'; ls ~/.agents/agent-enforcers/permission-enforcer/.state/",
				).action, "allow");
		});

		test("allows chained commands: write to safe path, read-only protected path in another segment", () => {
			assert.strictEqual(bashValidator.validate(
					"echo ok > /tmp/safe.txt && ls ~/.agents/agent-enforcers/permission-enforcer/.state/",
				).action, "allow");
		});

		test("denies chained commands: write AND protected path in the same segment", () => {
			assert.strictEqual(bashValidator.validate(
					"ls /tmp; echo bad > ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				).action, "deny");
		});

		test("denies mixed /dev/sda + /dev/null in same segment (not all refs are /dev/null)", () => {
			assert.strictEqual(bashValidator.validate("echo bad > /dev/sda 2>/dev/null").action, "deny");
		});

		test("allows chained: tee to safe path, ls of protected path in separate segment", () => {
			assert.strictEqual(bashValidator.validate(
					"echo ok | tee /tmp/log.txt; ls ~/.agents/agent-enforcers/permission-enforcer/.state/",
				).action, "allow");
		});

		test("blocks new write patterns on protected path (touch, truncate, sed -i, install, rsync)", () => {
			const blocked = [
				"touch ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				"truncate -s 0 ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				"sed -i 's/old/new/' ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				"install /tmp/src ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				"rsync /tmp/src ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
			];
			for (const cmd of blocked) {
				assert.strictEqual(bashValidator.validate(cmd).action, "deny");
			}
		});

		test("allows new write patterns on safe path", () => {
			assert.strictEqual(bashValidator.validate("touch /tmp/safe.txt").action, "allow");
			assert.strictEqual(bashValidator.validate("sed -i 's/a/b/' /tmp/safe.txt").action, "allow");
		});

		test("cp from protected source to safe destination is allowed (source not flagged)", () => {
			assert.strictEqual(bashValidator.validate("cp /usr/bin/foo /tmp/foo").action, "allow");
		});

		test("cp to protected destination is denied", () => {
			assert.strictEqual(bashValidator.validate(
					"cp /tmp/src ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				).action, "deny");
		});

		test("mv from protected source to safe destination is allowed", () => {
			assert.strictEqual(bashValidator.validate("mv /etc/hosts.old /tmp/hosts.old").action, "allow");
		});

		test("mv to protected destination is denied", () => {
			assert.strictEqual(bashValidator.validate(
					"mv /tmp/src ~/.agents/agent-enforcers/permission-enforcer/.state/config.json",
				).action, "deny");
		});
	});
});
