import chalk from "chalk";
import fs from "fs";
import path from "path";
// @ts-ignore
import packageDotJson from "../package.json.js";
import configTemplate from "./config.template.js";
import { Action, CONFIG_TEMPLATE_URL } from "./constants.js";

interface FileConfig {
	action?: Action;
	configVersion?: number;
	delay?: number;
	includeEpisodes?: boolean;
	jackettApiKey?: string;
	jackettServerUrl?: string;
	outputDir?: string;
	rtorrentRpcUrl?: string;
	searchAll?: boolean;
	excludeOlder?: number;
	excludeRecentSearch?: number;
	torrentDir?: string;
	trackers?: string[];
	qbittorrentUrl?: string;
	notificationWebhookUrl?: string;
}

interface GenerateConfigParams {
	force?: boolean;
	docker?: boolean;
}

export function appDir(): string {
	return (
		process.env.CONFIG_DIR ||
		(process.platform === "win32"
			? path.resolve(process.env.LOCALAPPDATA, packageDotJson.name)
			: path.resolve(process.env.HOME, `.${packageDotJson.name}`))
	);
}

export function createAppDir(): void {
	fs.mkdirSync(path.join(appDir(), "torrent_cache"), { recursive: true });
	fs.mkdirSync(path.join(appDir(), "logs"), { recursive: true });
}

export function generateConfig({
	force = false,
	docker = false,
}: GenerateConfigParams): void {
	createAppDir();
	const dest = path.join(appDir(), "config.js");
	const templatePath = path.join(
		__dirname,
		`config.template${docker ? ".docker" : ""}.js`
	);
	if (!force && fs.existsSync(dest)) {
		console.log("Configuration file already exists.");
		return;
	}
	fs.copyFileSync(templatePath, dest);
	console.log("Configuration file created at", chalk.yellow.bold(dest));
}

function printUpdateInstructions(missingKeys) {
	const configPath = path.join(appDir(), "config.js");
	console.error(chalk.yellow`
 Error: Your configuration file is out of date.
 Missing options:\n\t${missingKeys.join("\n\t")}
 Please update at ${configPath}.
 When you are done, set the configVersion to ${configTemplate.configVersion}.
 It may help to read the template, at ${CONFIG_TEMPLATE_URL}
 `);
}

export function getFileConfig(): FileConfig {
	const configPath = path.join(appDir(), "config.js");

	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fileConfig = require(configPath);
		const { configVersion = 0 } = fileConfig;
		if (configVersion < configVersion) {
			const missingKeys = Object.keys(configTemplate).filter(
				(k) => !(k in fileConfig)
			);
			printUpdateInstructions(missingKeys);
		}
		return fileConfig;
	} catch (e) {
		if (e.code !== "MODULE_NOT_FOUND") throw e;
		return {};
	}
}
