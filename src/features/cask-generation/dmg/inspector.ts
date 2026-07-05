import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AppMetadata } from "./types";

const DOWNLOADS_DIR = "downloads";

function execCommand(command: string, args: string[]): string {
	const proc = Bun.spawnSync([command, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = new TextDecoder().decode(proc.stdout).trim();
	const stderr = new TextDecoder().decode(proc.stderr).trim();

	if (proc.exitCode !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(" ")}\n${stderr}`);
	}

	return stdout;
}

function mountDMG(dmgPath: string): { mountPoint: string } {
	const output = execCommand("hdiutil", [
		"attach",
		dmgPath,
		"-nobrowse",
		"-readonly",
		"-mountrandom",
		"/tmp",
	]);
	console.log(`  hdiutil attach: ${output}`);

	// Parse mount point from output like:
	// /dev/disk4s1  	Apple_HFS	/private/tmp/dmg.XXXXX
	// (macOS resolves /tmp → /private/tmp in hdiutil output)
	const lines = output.split("\n");
	for (const line of lines) {
		// Match any path on a line that contains Apple_HFS
		if (!line.includes("Apple_HFS")) continue;

		// Try tab-separated first
		const parts = line.split("\t");
		if (parts.length >= 3) {
			const candidate = parts[parts.length - 1]?.trim();
			if (candidate?.startsWith("/")) {
				return { mountPoint: candidate };
			}
		}

		// Fallback: regex match a leading-slash path at end of line
		const pathMatch = line.match(/\/(?:private\/)?tmp\/\S+/);
		if (pathMatch) {
			return { mountPoint: pathMatch[0] };
		}
	}

	// Fallback: look for /Volumes/ entries
	for (const line of lines) {
		if (line.includes("/Volumes/")) {
			const match = line.match(/\/Volumes\/[^\s]+/);
			if (match) {
				return { mountPoint: match[0] };
			}
		}
	}

	throw new Error(`Could not determine mount point from output:\n${output}`);
}

function extractPlistValue(
	mountPoint: string,
	appName: string,
	key: string,
): string {
	const plistPath = join(
		mountPoint,
		`${appName}.app`,
		"Contents",
		"Info.plist",
	);
	if (!existsSync(plistPath)) {
		throw new Error(`Info.plist not found at: ${plistPath}`);
	}

	const output = execCommand("/usr/libexec/PlistBuddy", [
		"-c",
		`Print :${key}`,
		plistPath,
	]);

	return output;
}

export async function inspectDMG(dmgUrl: string): Promise<AppMetadata> {
	mkdirSync(DOWNLOADS_DIR, { recursive: true });

	const filename = dmgUrl.split("/").pop() || "latest.dmg";
	const dmgPath = join(DOWNLOADS_DIR, filename);

	console.log(`  Downloading DMG: ${dmgUrl}`);
	const res = await fetch(dmgUrl);
	if (!res.ok) {
		throw new Error(`Failed to download DMG: ${res.status}`);
	}
	const buffer = await res.arrayBuffer();
	Bun.write(dmgPath, buffer);
	console.log(`  Downloaded to: ${dmgPath}`);

	let mountPoint: string | undefined;
	try {
		const result = mountDMG(dmgPath);
		mountPoint = result.mountPoint;
		console.log(`  Mount point: ${mountPoint}`);

		// Find .app name in mount point
		const entries = readdirSync(mountPoint);
		const appEntry = entries.find((e) => e.endsWith(".app"));
		if (!appEntry) {
			throw new Error(`No .app found in ${mountPoint}`);
		}

		const appName = appEntry.replace(/\.app$/, "");
		const bundleId = extractPlistValue(
			mountPoint,
			appName,
			"CFBundleIdentifier",
		);

		console.log(`  App name: ${appName}`);
		console.log(`  Bundle ID: ${bundleId}`);

		return { appName, bundleId };
	} finally {
		if (mountPoint) {
			console.log(`  Unmounting ${mountPoint}...`);
			try {
				execCommand("hdiutil", ["detach", mountPoint, "-force"]);
			} catch {
				console.warn(`  Warning: failed to unmount ${mountPoint}`);
			}
		}

		// Clean up downloaded DMG
		try {
			rmSync(dmgPath, { force: true });
		} catch {
			console.warn(`  Warning: failed to remove ${dmgPath}`);
		}
	}
}
