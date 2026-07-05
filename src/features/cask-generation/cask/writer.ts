import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { GenerateMode } from "../cli/config";
import { buildCaskContent } from "./template";
import type { CaskContext } from "./types";

const CASKS_DIR = "Casks";

export function writeCask(ctx: CaskContext, mode: GenerateMode): boolean {
	mkdirSync(CASKS_DIR, { recursive: true });

	const {
		release: { semver },
		isLatest,
		channel,
	} = ctx;

	let filename: string;
	if (isLatest) {
		filename = channel === "alpha" ? "micyou@alpha.rb" : "micyou.rb";
	} else {
		filename = `micyou@${semver}.rb`;
	}

	const filepath = join(CASKS_DIR, filename);

	// In incremental mode, skip existing versioned casks. Latest casks always rewrite.
	if (mode === "incremental" && !isLatest && existsSync(filepath)) {
		return false; // skipped, already exists
	}

	const content = buildCaskContent(ctx);
	writeFileSync(filepath, content, "utf-8");
	return true; // written
}

export function getMetadataFromExistingCask(): {
	appName?: string;
	bundleId?: string;
} | null {
	const dir = CASKS_DIR;
	if (!existsSync(dir)) return null;

	const files = readdirSync(dir).filter(
		(f) => f.endsWith(".rb") && f !== "micyou.rb" && f !== "micyou@alpha.rb",
	);

	if (files.length === 0) return null;

	// Try micyou.rb first, fall back to any versioned cask
	const tryPaths = ["micyou.rb", "micyou@alpha.rb", ...files];
	for (const f of tryPaths) {
		const p = join(dir, f);
		if (existsSync(p)) {
			const content = readFileSync(p, "utf-8");
			const meta = extractMetadata(content);
			if (meta.appName && meta.bundleId) return meta;
		}
	}

	return null;
}

function extractMetadata(content: string): {
	appName?: string;
	bundleId?: string;
} {
	const appNameMatch = content.match(/name\s+"([^"]+)"/);
	const bundleIdMatch = content.match(/Application Support\/([^"]+)/);

	return {
		appName: appNameMatch ? appNameMatch[1] : undefined,
		bundleId: bundleIdMatch ? bundleIdMatch[1] : undefined,
	};
}
