import { compare } from "semver";
import { parseSemver } from "../../../shared/version";
import type { DMGAsset, GitHubRelease, MacOSRelease } from "./types";

const API_BASE = "https://api.github.com/repos/LanRhyme/MicYou/releases";
const DMG_PATTERN_ARM64 = /macos.+arm64\.dmg$/i;
const DMG_PATTERN_X64 = /macos.+x64\.dmg$/i;

function extractSemver(tag: string): string {
	const cleaned = tag.startsWith("v") ? tag.slice(1) : tag;
	const parsed = parseSemver(cleaned);
	return parsed ?? cleaned;
}

function extractDMGAsset(asset: GitHubRelease["assets"][0]): DMGAsset | null {
	if (!asset.digest) return null;
	const sha256 = asset.digest.replace(/^sha256:/, "");
	return {
		url: asset.browser_download_url,
		filename: asset.name,
		sha256,
	};
}

function findMacOSAssets(release: GitHubRelease): MacOSRelease | null {
	const semver = extractSemver(release.tag_name);

	const arm64Asset = release.assets.find((a) => DMG_PATTERN_ARM64.test(a.name));
	const x64Asset = release.assets.find((a) => DMG_PATTERN_X64.test(a.name));

	const arm64 = arm64Asset ? extractDMGAsset(arm64Asset) : null;
	const x64 = x64Asset ? extractDMGAsset(x64Asset) : null;

	if (!arm64 && !x64) return null;

	return {
		tag_name: release.tag_name,
		semver,
		prerelease: release.prerelease,
		published_at: release.published_at,
		arm64,
		x64,
	};
}

function parseLinkHeader(header: string | null): string | null {
	if (!header) return null;

	const links = header.split(",");
	for (const link of links) {
		const [urlPart, relPart] = link.split(";").map((s) => s.trim());
		if (relPart === 'rel="next"' || relPart === "rel='next'") {
			return urlPart.slice(1, -1);
		}
	}
	return null;
}

export async function fetchAllReleases(
	token?: string,
): Promise<MacOSRelease[]> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": "homebrew-micyou-cask-generator",
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const allReleases: MacOSRelease[] = [];
	let nextUrl: string | null = `${API_BASE}?per_page=100`;
	let page = 0;

	while (nextUrl) {
		page++;
		console.log(`  Fetching page ${page}...`);

		const res = await fetch(nextUrl, { headers });

		if (res.status === 403) {
			throw new Error(
				`GitHub API rate limit exceeded. Set GITHUB_TOKEN in .env or environment to increase limit.\n` +
					`Create one at: https://github.com/settings/tokens`,
			);
		}

		if (!res.ok) {
			throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
		}

		const releases: GitHubRelease[] = await res.json();

		for (const release of releases) {
			if (release.draft) continue;
			const macOS = findMacOSAssets(release);
			if (macOS) {
				allReleases.push(macOS);
			}
		}

		nextUrl = parseLinkHeader(res.headers.get("Link"));
	}

	console.log(`  Total macOS releases found: ${allReleases.length}`);

	allReleases.sort((a, b) => compare(b.semver, a.semver));

	return allReleases;
}
