import type { CaskContext } from "./types";

const CASK_DESC =
	"Turn your Android device into a high-quality microphone for your PC";
const CASK_DESC_ZH = "将你的 Android 设备变成 PC 的高品质麦克风";
const HOMEPAGE = "https://github.com/LanRhyme/MicYou";
const REPO_OWNER = "LanRhyme";
const REPO_NAME = "MicYou";

function buildArchBlock(ctx: CaskContext, isLatest: boolean): string {
	const { release } = ctx;
	const blocks: string[] = [];

	// arm64 block
	if (release.arm64) {
		const url = isLatest
			? `"https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${release.semver}/${release.arm64.filename}"`
			: `"https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v#{version}/${release.arm64.filename.replace(release.semver, "#{version}")}"`;

		const sha256 = isLatest ? undefined : release.arm64.sha256;

		let block = "  on_arm do\n";
		block += `    url ${url}\n`;
		if (sha256) {
			block += `    sha256 "${sha256}"\n`;
		}
		block += "  end";
		blocks.push(block);
	}

	// x64 block
	if (release.x64) {
		const url = isLatest
			? `"https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${release.semver}/${release.x64.filename}"`
			: `"https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v#{version}/${release.x64.filename.replace(release.semver, "#{version}")}"`;

		const sha256 = isLatest ? undefined : release.x64.sha256;

		let block = "  on_intel do\n";
		block += `    url ${url}\n`;
		if (sha256) {
			block += `    sha256 "${sha256}"\n`;
		}
		block += "  end";
		blocks.push(block);
	}

	return blocks.join("\n\n");
}

function buildVersioned(ctx: CaskContext): string {
	const {
		release: { semver },
		metadata: { appName, bundleId },
	} = ctx;

	const caskName =
		ctx.channel === "alpha" ? `micyou@alpha` : `micyou@${semver}`;
	const versionStr = semver;

	const archBlock = buildArchBlock(ctx, false);

	// For alpha latest, use version :latest approach
	if (ctx.isLatest) {
		return buildLatest(ctx);
	}

	return `cask "${caskName}" do
  version "${versionStr}"

${archBlock}

  name "${appName}"
  desc "${CASK_DESC} / ${CASK_DESC_ZH}"
  homepage "${HOMEPAGE}"

  auto_updates true

  depends_on macos: :catalina

  app "${appName}.app"

  zap trash: [
    "~/Library/Application Support/${bundleId}",
    "~/Library/Preferences/${bundleId}.plist",
    "~/Library/Caches/${bundleId}",
    "~/Library/Saved Application State/${bundleId}.savedState",
  ]
end
`;
}

function buildLatest(ctx: CaskContext): string {
	const {
		metadata: { appName, bundleId },
	} = ctx;

	const caskName = ctx.channel === "alpha" ? "micyou@alpha" : "micyou";

	const archBlock = buildArchBlock(ctx, true);

	return `cask "${caskName}" do
  version :latest
  sha256 :no_check

${archBlock}

  name "${appName}"
  desc "${CASK_DESC} / ${CASK_DESC_ZH}"
  homepage "${HOMEPAGE}"

  auto_updates true

  depends_on macos: :catalina

  app "${appName}.app"

  zap trash: [
    "~/Library/Application Support/${bundleId}",
    "~/Library/Preferences/${bundleId}.plist",
    "~/Library/Caches/${bundleId}",
    "~/Library/Saved Application State/${bundleId}.savedState",
  ]
end
`;
}

export function buildCaskContent(ctx: CaskContext): string {
	return ctx.isLatest ? buildLatest(ctx) : buildVersioned(ctx);
}
