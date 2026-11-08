import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";
import { CommandValidator } from "../validator.ts";

const validator = new CommandValidator({ isPermissionGranted: () => false });
const oid = "50b8527b58e5519c23dd430ddede008adaf183bc";

function expectAction(command: string, action: "allow" | "deny") {
	const result = validator.validate(command, "bash");
	assert.equal(result.action, action, JSON.stringify(command));
	if (action === "deny") assert.equal(result.severity, "CRITICAL");
	else {
		const syntax = spawnSync("bash", ["-n"], { input: command, encoding: "utf8", timeout: 5_000 });
		assert.ifError(syntax.error);
		assert.equal(syntax.status, 0, syntax.stderr);
	}
}

describe("command substitution policy through the public validator", () => {
	test("does not join independent substitutions across a Git object identity", () => {
		expectAction(
			`git -C /workspace/product merge --ff-only ${oid}; ` +
			`test "$(git -C /workspace/product rev-parse HEAD)" = ${oid}; ` +
			`git -C /workspace/strategy merge --ff-only ${oid}; ` +
			`test "$(git -C /workspace/strategy rev-parse HEAD)" = ${oid}`,
			"allow",
		);
	});

	test("allows command names and arguments containing rm or dd substrings", () => {
		for (const command of [
			'echo "$(git log --format=%H)"',
			'echo "$(printf %s dd)"',
			'echo "$(printf %s rm)"',
			'echo "$(printf %s /tmp/address)"',
			'echo "$(printf %s $(printf dd))"',
			'echo `printf %s format`',
			'echo `printf %s dd` dd `printf ok`',
			'echo "$(command -v rm)"',
			'echo "$(env -u dd printf ok)"',
		]) expectAction(command, "allow");
	});

	test("does not execute quoted, escaped or quoted-heredoc source text", () => {
		for (const command of [
			"printf %s '$(rm file)'",
			"printf %s '`dd if=input of=output`'",
			String.raw`printf %s "\$(dd)"`,
			"python3 - <<'PY'\ntext = '$(rm file)'\nprint(text)\nPY",
		]) expectAction(command, "allow");
	});

	test("retains denial of actual rm and dd invocations in substitutions", () => {
		for (const command of [
			'echo "$(rm file)"',
			'echo "$(dd if=input of=output)"',
			'echo `rm file`',
			'echo `dd if=input of=output`',
			'echo "$(printf ok; rm file)"',
			'echo "$(printf ok | dd of=output)"',
			'echo "$(printf %s "$(rm file)")"',
			'echo "$(/bin/rm file)"',
			'echo "$(\'rm\' file)"',
			'echo "$(r\'\'m file)"',
			String.raw`echo "$(r\m file)"`,
			'cat <<EOF\n$(rm file)\nEOF',
			'echo "$((1 + $(dd if=input of=output)))"',
		]) expectAction(command, "deny");
	});

	test("retains denial through statically recognized execution wrappers", () => {
		for (const command of [
			'echo "$(env FLAG=yes rm file)"',
			'echo "$(env -u NAME /bin/dd if=input of=output)"',
			'echo "$(command -- rm file)"',
			'echo "$(exec -a alias dd if=input of=output)"',
			'echo "$(nohup rm file)"',
			'echo "$(sudo -u nobody rm file)"',
			'echo "$(busybox rm file)"',
			'echo "$(bash -c \'dd if=input of=output\')"',
			'echo "$(eval \'rm file\')"',
		]) expectAction(command, "deny");
	});

	test("fails closed for unparseable or dynamic executable substitutions", () => {
		for (const command of [
			'echo "$(printf ok"',
			'echo "$(\"$tool\" file)"',
			'echo "$(bash -c \"$code\")"',
			'echo "$(eval \"$code\")"',
			"echo \"$($'r\\155' file)\"",
		]) expectAction(command, "deny");
	});

	test("does not let safe substitution bypass unrelated critical protection", () => {
		expectAction('echo "$(printf ok)"; dd if=/dev/zero of=/dev/sda', "deny");
		expectAction('echo "$(printf ok)"; echo bad > /etc/hosts', "deny");
		assert.equal(validator.validate("content", "write").action, "deny");
	});

	test("does not mistake interpreter options for executed source", () => {
		for (const command of [
			'echo "$(eval -- \'rm file\')"',
			'echo "$(bash -c -- \'dd if=input of=output\')"',
			'echo "$(bash -c -c \'dd if=input of=output\')"',
			'echo "$(bash -c -- \"$code\")"',
		]) expectAction(command, "deny");
	});

	test("rejects expansion-capable executable words", () => {
		expectAction('echo "$({rm,printf} file)"', "deny");
		expectAction('echo "$(r{m,n} file)"', "deny");
		expectAction('echo "$(printf %s \'{rm,printf}\')"', "allow");
	});

	test("inspects the builtin dispatcher without converting query arguments into calls", () => {
		expectAction('echo "$(builtin command rm file)"', "deny");
		expectAction('echo "$(builtin -- command rm file)"', "deny");
		expectAction('echo "$(builtin eval \'rm file\')"', "deny");
		expectAction('echo "$(builtin command -v rm)"', "allow");
	});

	test("finds substitutions in executed sources outside another substitution", () => {
		for (const command of [
			"bash -c 'echo \"$(rm file)\"'",
			"eval 'echo \"$(rm file)\"'",
			"env bash -c 'echo \"$(dd if=input of=output)\"'",
		]) expectAction(command, "deny");
		expectAction("printf %s 'echo \"$(rm file)\"'", "allow");
		expectAction("bash -c 'echo \"$(printf rm)\"'", "allow");
	});

	test("rejects env split-string rather than pretending it is Bash source", () => {
		expectAction(String.raw`echo "$(env -S '\_rm file')"`, "deny");
		expectAction('echo "$(env -S \'bash -c\' \'eval rm file\')"', "deny");
	});

	test("rejects unsupported shell dialects and multicall shell applets", () => {
		for (const command of [
			'echo "$(zsh -c \'noglob rm file\')"',
			'echo "$(zsh -c \'nocorrect rm file\')"',
			'echo "$(busybox ash -c \'rm file\')"',
			'echo "$(toybox mksh -c \'rm file\')"',
		]) expectAction(command, "deny");
	});

	test("rejects plus-option layouts instead of validating the option as source", () => {
		for (const command of [
			'echo "$(bash -c +x \'dd if=input of=output\')"',
			'echo "$(bash -c +v \'rm file\')"',
			'echo "$(bash -c +o posix \'rm file\')"',
			'echo "$(bash -lc +x \'rm file\')"',
		]) expectAction(command, "deny");
	});

	test("does not let sudo environment assignments hide its command", () => {
		for (const command of [
			'echo "$(sudo TERM=dumb rm file)"',
			'echo "$(sudo -u nobody TERM=dumb dd if=input of=output)"',
			'echo "$(sudo -- TERM=dumb rm file)"',
		]) expectAction(command, "deny");
	});

	test("does not abandon interpreted-source inspection at unresolved outer dispatch", () => {
		for (const command of [
			"sudo TERM=\"$TERM\" bash -c 'echo \"$(dd if=input of=output)\"'",
			"sudo -- TERM=\"$TERM\" bash -c 'echo \"$(dd if=input of=output)\"'",
			"builtin \"$dispatcher\" 'echo \"$(rm file)\"'",
			"\"$shell\" -c 'echo \"$(rm file)\"'",
		]) expectAction(command, "deny");
	});

	test("preserves HIGH classification without treating arguments as executables", () => {
		assert.equal(validator.validate("dd if=input of=output").action, "ask");
		assert.equal(validator.validate("true; sudo ls").action, "ask");
		assert.equal(validator.validate("echo 'unterminated sudo").action, "ask");
		expectAction('echo "$(bash -c \'printf %s rm\')"', "allow");
	});

	test("permits the regression source through validation and a real Bash process", () => {
		const source = `test "$(printf ready)" = ready; oid=${oid}; ` +
			'test "$(printf ready)" = ready; printf %s "$oid"';
		expectAction(source, "allow");
		const child = spawnSync("bash", ["-c", source], {
			encoding: "utf8", timeout: 5_000,
		});
		assert.ifError(child.error);
		assert.equal(child.status, 0, child.stderr);
		assert.equal(child.stdout, oid);
	});
});
