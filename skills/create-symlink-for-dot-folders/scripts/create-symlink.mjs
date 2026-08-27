import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readlinkSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

function printStatus(message) {
	process.stdout.write(`[create-symlink] ${message}\n`);
}

function expandHome(filePath) {
	if (filePath.startsWith("~/")) {
		return join(homedir(), filePath.slice(2));
	}
	return filePath;
}

function getEntryStats(entryPath) {
	return lstatSync(entryPath, { throwIfNoEntry: false });
}

function main() {
	const targetArgument = process.argv[2];
	const symlinkArgument = process.argv[3];
	if (!targetArgument || !symlinkArgument) {
		process.stderr.write(
			"Usage: node create-symlink.mjs <physical_target_dir> <symlink_path>\n",
		);
		return 1;
	}

	const targetDirectory = resolve(expandHome(targetArgument));
	const symlinkPath = resolve(expandHome(symlinkArgument));
	printStatus(`Physical Target: ${targetDirectory}`);
	printStatus(`Symlink Path: ${symlinkPath}`);

	const initialStats = getEntryStats(symlinkPath);
	if (initialStats?.isSymbolicLink()) {
		const currentTarget = resolve(readlinkSync(symlinkPath));
		if (currentTarget === targetDirectory) {
			printStatus(
				"Symlink already exists and points to the correct target. Doing nothing.",
			);
			return 0;
		}
	}

	let backupDirectory = null;
	let backupFile = null;
	if (initialStats !== undefined) {
		const timestamp = Date.now();
		if (initialStats.isDirectory() && !initialStats.isSymbolicLink()) {
			backupDirectory = join("/tmp", `backup_dir_${timestamp}`);
			printStatus(`Backing up existing directory to ${backupDirectory}`);
			cpSync(symlinkPath, backupDirectory, { recursive: true });
			rmSync(symlinkPath, { force: true, recursive: true });
		} else if (initialStats.isSymbolicLink()) {
			rmSync(symlinkPath, { force: true });
		} else {
			backupFile = join("/tmp", `backup_file_${timestamp}`);
			printStatus(`Backing up existing file to ${backupFile}`);
			cpSync(symlinkPath, backupFile);
			rmSync(symlinkPath, { force: true });
		}
	}

	const targetIsFile = /\.[a-zA-Z0-9]+$/.test(symlinkPath);
	if (targetIsFile) {
		printStatus("Creating physical target parent directory...");
		mkdirSync(resolve(targetDirectory, ".."), { recursive: true });
		if (backupFile === null && !existsSync(targetDirectory)) {
			writeFileSync(targetDirectory, "");
		}
	} else {
		printStatus("Creating physical target directory...");
		mkdirSync(targetDirectory, { recursive: true });
	}

	printStatus("Creating symlink...");
	symlinkSync(targetDirectory, symlinkPath);

	if (backupDirectory !== null) {
		printStatus("Restoring directory contents into new physical target...");
		for (const item of readdirSync(backupDirectory)) {
			const destination = join(targetDirectory, item);
			if (!existsSync(destination)) {
				renameSync(join(backupDirectory, item), destination);
			}
		}
	} else if (backupFile !== null) {
		printStatus("Restoring file into new physical target...");
		if (targetIsFile) {
			renameSync(backupFile, targetDirectory);
		} else {
			renameSync(backupFile, join(targetDirectory, basename(symlinkPath)));
		}
	}

	printStatus("✅ Symlink creation successful!");
	return 0;
}

process.exitCode = main();
