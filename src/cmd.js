#!/usr/bin/env node
"use strict";
const { program } = require("commander");
const chalk = require("chalk");
const packageDotJson = require("../package.json");
const main = require("./index");
const { CONFIG, generateConfig } = require("./configuration");

program.name(packageDotJson.name);
program.description(chalk.yellow.bold("cross-seed"));
program.version(
	packageDotJson.version,
	"-v, --version",
	"output the current version"
);

program
	.command("gen-config")
	.description("Generate a config file")
	.action(generateConfig);

program
	.command("search")
	.description("Search for cross-seeds\n")
	.requiredOption(
		"-u, --jackett-server-url <url>",
		"Your Jackett server url",
		CONFIG.jackettServerUrl
	)
	.requiredOption(
		"-k, --jackett-api-key <key>",
		"Your Jackett API key",
		CONFIG.jackettApiKey
	)
	.requiredOption(
		"-d, --delay <delay>",
		"Pause duration between searches",
		(n) => parseInt(n),
		CONFIG.delay
	)
	.requiredOption(
		"-t, --trackers <tracker>",
		"Comma-separated list of Jackett tracker ids to search",
		CONFIG.trackers && CONFIG.trackers.join(",")
	)
	.requiredOption(
		"-i, --torrent-dir <dir>",
		"Directory with torrent files",
		CONFIG.torrentDir
	)
	.requiredOption(
		"-s, --output-dir <dir>",
		"Directory to save results in",
		CONFIG.outputDir
	)
	.requiredOption(
		"-o, --offset <offset>",
		"Offset to start from",
		(n) => parseInt(n),
		CONFIG.offset
	)
	.action((command) => {
		const options = command.opts();
		options.trackers = options.trackers.split(",");
		try {
			main(options);
		} catch (e) {
			console.error(chalk.bold.red(e.message));
		}
	});

program.parse();
