import { getMetadataFromExistingCask, writeCask } from "../cask";
import type { AppMetadata } from "../dmg";
import { inspectDMG } from "../dmg";
import type { MacOSRelease } from "../releases";
import { fetchAllReleases } from "../releases";
import { parseArgs } from "./config";

async function resolveMetadata(
	releases: MacOSRelease[],
	inspectDmg: boolean,
): Promise<AppMetadata> {
	const existing = getMetadataFromExistingCask();
	if (existing?.appName && existing?.bundleId && !inspectDmg) {
		console.log(
			`Using metadata from existing cask: ${existing.appName} (${existing.bundleId})`,
		);
		return {
			appName: existing.appName,
			bundleId: existing.bundleId,
		};
	}

	console.log("Inspecting latest DMG for metadata...");
	// Pick the first release that has an arm64 DMG (prefer arm64 for inspection)
	const candidate = releases.find((r) => r.arm64);
	if (!candidate) {
		console.warn("No release with arm64 DMG found, trying x64...");
		const x64Candidate = releases.find((r) => r.x64);
		if (!x64Candidate) {
			console.warn("No releases found, using fallback metadata.");
			return { appName: "MicYou", bundleId: "com.lanrhyme.micyou" };
		}
		return await inspectDMG(x64Candidate.x64?.url);
	}

	return await inspectDMG(candidate.arm64?.url);
}

function splitChannels(releases: MacOSRelease[]): {
	stable: MacOSRelease[];
	alpha: MacOSRelease[];
} {
	const stable: MacOSRelease[] = [];
	const alpha: MacOSRelease[] = [];

	for (const r of releases) {
		if (r.prerelease) {
			alpha.push(r);
		} else {
			stable.push(r);
		}
	}

	return { stable, alpha };
}

export async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const config = parseArgs(args);

	console.log(`Mode: ${config.mode}`);
	console.log(`Inspect DMG: ${config.inspectDmg}`);
	console.log(`GITHUB_TOKEN: ${config.token ? "set" : "not set"}`);
	console.log();

	console.log("Fetching releases from GitHub API...");
	const releases = await fetchAllReleases(config.token);
	console.log(`Fetched ${releases.length} macOS releases.\n`);

	const { stable, alpha } = splitChannels(releases);
	console.log(`Stable releases: ${stable.length}`);
	console.log(`Pre-releases: ${alpha.length}`);
	console.log();

	const latestStable = stable[0];
	const latestAlpha = alpha[0];

	if (!latestStable && !latestAlpha) {
		console.log("No macOS releases found. Nothing to do.");
		return;
	}

	const metadata = await resolveMetadata(releases, config.inspectDmg);
	console.log();

	let written = 0;
	let skipped = 0;

	// Write versioned casks for stable releases
	for (const release of stable) {
		const wasWritten = writeCask(
			{
				release,
				metadata,
				isLatest: false,
				channel: "stable",
			},
			config.mode,
		);

		if (wasWritten) {
			written++;
			console.log(`  Wrote micyou@${release.semver}.rb`);
		} else {
			skipped++;
		}
	}

	// Write versioned casks for alpha releases
	for (const release of alpha) {
		const wasWritten = writeCask(
			{
				release,
				metadata,
				isLatest: false,
				channel: "alpha",
			},
			config.mode,
		);

		if (wasWritten) {
			written++;
			console.log(`  Wrote micyou@${release.semver}.rb`);
		} else {
			skipped++;
		}
	}

	// Always rewrite micyou.rb (latest stable)
	if (latestStable) {
		writeCask(
			{
				release: latestStable,
				metadata,
				isLatest: true,
				channel: "stable",
			},
			"full",
		);
		written++;
		console.log("  Wrote micyou.rb (latest stable)");
	}

	// Always rewrite micyou@alpha.rb (latest pre-release)
	if (latestAlpha) {
		writeCask(
			{
				release: latestAlpha,
				metadata,
				isLatest: true,
				channel: "alpha",
			},
			"full",
		);
		written++;
		console.log("  Wrote micyou@alpha.rb (latest pre-release)");
	}

	console.log();
	console.log(
		`Done. Written: ${written}, Skipped: ${skipped}, ` +
			`Stable: ${stable.length}, Pre-release: ${alpha.length}`,
	);
}
