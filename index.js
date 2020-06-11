#!/usr/bin/env node
"use strict";
const parseTorrent = require("parse-torrent");
const fs = require("fs");
const path = require("path");
const util = require("util");
const querystring = require("querystring");

const axios = require("axios");
const chalk = require("chalk");

const config = require("config");

const EPISODE_REGEX = /S\d\dE\d\d/i;
const jackettPath = "/api/v2.0/indexers/all/results";

let jackettServerUrl;
let jackettApiKey;
let torrentDir;
let outputDir;
let delay = 10000;
let offset = 0;

const parseTorrentRemote = util.promisify(parseTorrent.remote);

function makeJackettRequest(query) {
	const params = querystring.stringify({
		apikey: jackettApiKey,
		Query: query,
	});
	return axios.get(`${jackettServerUrl}${jackettPath}?${params}`);
}

function parseTorrentFromFilename(filename) {
	const data = fs.readFileSync(filename);
	return parseTorrent(data);
}

function filterTorrentFile(info, index, arr) {
	if (info.files.length === 1 && EPISODE_REGEX.test(info.files[0].name)) {
		return false;
	}

	const allMkvs = info.files.every((file) => file.path.endsWith(".mkv"));
	if (!allMkvs) return false;

	const cb = (file) => file.path.split(path.sep).length <= 2;
	const notNested = info.files.every(cb);
	if (!notNested) return false;

	const firstOccurrence = arr.findIndex((e) => e.name === info.name);
	if (index !== firstOccurrence) return false;

	return true;
}

function compareFileTrees(a, b) {
	if (a.length !== b.length) return false;
	const sorter = (m, n) => (m.path < n.path ? -1 : m.path > n.path ? 1 : 0);
	const sortedA = a.slice().sort(sorter);
	const sortedB = b.slice().sort(sorter);

	const cmp = (elOfA, elOfB) => {
		const pathsAreEqual = elOfB.path === elOfA.path;
		const lengthsAreEqual = elOfB.length === elOfA.length;
		return pathsAreEqual && lengthsAreEqual;
	};
	return sortedA.every((elOfA, i) => cmp(elOfA, sortedB[i]));
}

async function assessResult(result, ogInfo, hashesToExclude) {
	const resultInfo = await parseTorrentRemote(result.Link).catch((e) => {
		console.error(chalk.red`error parsing torrent at ${result.Link}`);
		return null;
	});
	if (resultInfo === null) return null;
	if (resultInfo.length !== ogInfo.length) return null;
	const name = resultInfo.name;
	const ogAnnounce = ogInfo.announce[0];
	const newAnnounce = resultInfo.announce[0];

	if (hashesToExclude.includes(resultInfo.infoHash)) {
		console.log(`hash match for ${name} at ${newAnnounce}`);
		return null;
	}

	if (!compareFileTrees(resultInfo.files, ogInfo.files)) {
		console.log(`trees differ for ${name}: ${ogAnnounce}, ${newAnnounce}}`);
		return null;
	}

	const type = resultInfo.files.length === 1 ? "movie" : "packs";

	return {
		tracker: result.TrackerId,
		type,
		info: resultInfo,
	};
}

async function findOnOtherSites(info, hashesToExclude) {
	const response = await makeJackettRequest(info.name.replace(/.mkv$/, ""));
	const results = response.data.Results;
	const mapCb = (result) => assessResult(result, info, hashesToExclude);
	const promises = results.map(mapCb);
	const finished = await Promise.all(promises);
	finished
		.filter((e) => e !== null)
		.forEach(({ tracker, type, info: newInfo }) => {
			const styledName = chalk.green.bold(newInfo.name);
			const styledTracker = chalk.bold(tracker);
			console.log(`Found ${styledName} on ${styledTracker}`);
			saveTorrentFile(tracker, type, newInfo);
		});
}

function saveTorrentFile(tracker, type, info) {
	const buf = parseTorrent.toTorrentFile(info);
	const name = info.name.replace(/.mkv$/, "");
	const filename = `[${type}][${tracker}]${name}.torrent`;
	fs.writeFileSync(path.join("x-seeds", filename), buf, {
		mode: 0o644,
	});
}

async function batchDownloadCrossSeeds(torrentFilenames) {
	const parsedTorrents = torrentFilenames.map(parseTorrentFromFilename);
	const hashesToExclude = parsedTorrents.map((t) => t.infoHash);
	const filteredTorrents = parsedTorrents.filter(filterTorrentFile);

	console.log(
		"Found %d torrents, %d suitable",
		torrentFilenames.length,
		filteredTorrents.length
	);

	fs.mkdirSync(outputDir, { recursive: true });
	const samples = filteredTorrents.slice(offset);

	for (const [i, sample] of samples.entries()) {
		const sleep = new Promise((r) => setTimeout(r, delay));
		const name = sample.name.replace(/.mkv$/, "");
		const progress = chalk.blue(`[${i + 1}/${samples.length}]`);
		console.log(progress, chalk.dim("Searching for"), name);
		await Promise.all([findOnOtherSites(sample, hashesToExclude), sleep]);
	}
}

async function main() {
	const successfulParse = parseCommandLineArgs();
	if (!successfulParse) return;

	const dirContents = fs
		.readdirSync(torrentDir)
		.map((fn) => path.join(torrentDir, fn));
	await batchDownloadCrossSeeds(dirContents);
}

main();
