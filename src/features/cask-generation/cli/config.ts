export type GenerateMode = "full" | "incremental";

export interface RuntimeConfig {
	mode: GenerateMode;
	inspectDmg: boolean;
	token?: string;
}

export function parseArgs(args: string[]): RuntimeConfig {
	const mode = args.includes("--full") ? "full" : "incremental";
	const inspectDmg = args.includes("--inspect-dmg");
	const token = process.env.GITHUB_TOKEN;

	return { mode, inspectDmg, token };
}
