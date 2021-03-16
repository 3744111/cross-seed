#!/usr/bin/env node
import "./signalHandlers";

import { Command, Option, program } from "commander";
import chalk from "chalk";
import packageDotJson from "../package.json";
import { main } from "./pipeline";
import { generateConfig, getFileConfig } from "./configuration";
import { setRuntimeConfig } from "./runtimeConfig";
import { clear as clearCache } from "./cache";
import { serve } from "./server";
import logger from "./logger";
import { doStartupValidation } from "./startup";
import { CrossSeedError } from "./errors";
import { Action } from "./constants";

async function run() {
	const fileConfig = getFileConfig();

	function fallback(...args) {
		for (const arg of args) {
			if (arg !== undefined) return arg;
		}
		return undefined;
	}

	function processOptions(options) {
		options.trackers = options.trackers.split(",").filter((e) => e !== "");
		if (options.action === "inject" && !options.rtorrentRpcUrl) {
			throw new CrossSeedError(
				"You need to specify --rtorrent-rpc-url when using '-A inject'."
			);
		}
		return options;
	}

	function addSharedOptions() {
		return this.requiredOption(
			"-u, --jackett-server-url <url>",
			"Your Jackett server url",
			fileConfig.jackettServerUrl
		)
			.requiredOption(
				"-k, --jackett-api-key <key>",
				"Your Jackett API key",
				fileConfig.jackettApiKey
			)
			.requiredOption(
				"-t, --trackers <tracker1>,<tracker2>",
				"Comma-separated list of Jackett tracker ids to search  (Tracker ids can be found in their Torznab feed paths)",
				fallback(
					fileConfig.trackers && fileConfig.trackers.join(","),
					""
				)
			)
			.requiredOption(
				"-i, --torrent-dir <dir>",
				"Directory with torrent files",
				fileConfig.torrentDir
			)
			.requiredOption(
				"-s, --output-dir <dir>",
				"Directory to save results in",
				fileConfig.outputDir
			)
			.requiredOption(
				"-a, --search-all",
				"Search for all torrents regardless of their contents",
				fallback(fileConfig.searchAll, false)
			)
			.requiredOption("-v, --verbose", "Log verbose output", false)
			.addOption(
				new Option(
					"-A, --action <action>",
					"If set to 'inject', cross-seed will attempt to add the found torrents to your torrent client."
				)
					.default(fallback(fileConfig.action, Action.SAVE))
					.choices(Object.values(Action))
					.makeOptionMandatory()
			)
			.option(
				"--rtorrent-rpc-url <url>",
				"The url of your rtorrent XMLRPC interface. Requires '-A inject'. See the docs for more information.",
				fileConfig.rtorrentRpcUrl
			);
	}

	// monkey patch Command with this addSharedOptions function
	Command.prototype.addSharedOptions = addSharedOptions;

	program.name(packageDotJson.name);
	program.description(chalk.yellow.bold("cross-seed"));
	program.version(
		packageDotJson.version,
		"-V, --version",
		"output the current version"
	);

	program
		.command("gen-config")
		.description("Generate a config file")
		.option(
			"-d, --docker",
			"Generate the docker config instead of the normal one"
		)
		.action((command) => {
			const options = command.opts();
			generateConfig(options);
		});

	program
		.command("clear-cache")
		.description("Clear the cache of downloaded-and-rejected torrents")
		.action(clearCache);

	program
		.command("daemon")
		.description("Start the cross-serve daemon")
		.addSharedOptions()
		.action(async (options, _command) => {
			try {
				setRuntimeConfig(processOptions(options));
				if (process.env.DOCKER_ENV === "true") {
					generateConfig({ docker: true });
				}
				await doStartupValidation();
				await serve();
			} catch (e) {
				if (e instanceof CrossSeedError) {
					e.print();
					process.exitCode = 1;
					return;
				}
				throw e;
			}
		});

	program
		.command("search")
		.description("Search for cross-seeds\n")
		.addSharedOptions()
		.requiredOption(
			"-o, --offset <offset>",
			"Offset to start from",
			(n) => parseInt(n),
			0
		)
		.requiredOption(
			"-d, --delay <delay>",
			"Pause duration (seconds) between searches",
			parseFloat,
			fallback(fileConfig.delay, 10)
		)
		.option(
			"-e, --include-episodes",
			"Include single-episode torrents in the search",
			fallback(fileConfig.includeEpisodes, false)
		)
		.option(
			"-x, --exclude-older <cutoff>",
			"Exclude torrents first seen more than x minutes ago. Overrides the -a flag.",
			(n) => parseInt(n)
		)
		.option(
			"-r, --exclude-recent-search <cutoff>",
			"Exclude torrents which have been searched more recently than x minutes ago. Overrides the -a flag.",
			(n) => parseInt(n)
		)
		.action(async (options, _command) => {
			try {
				setRuntimeConfig(processOptions(options));
				await doStartupValidation();
				await main();
			} catch (e) {
				if (e instanceof CrossSeedError) {
					e.print();
					process.exitCode = 1;
					return;
				}
				throw e;
			}
		});
	await program.parseAsync();
}

if (require.main === module) {
	run().catch((e) => {
		logger.error(e);
	});
}

module.exports = { run };
