#!/usr/bin/env node

const parseTorrent = require("parse-torrent");
const fs = require("fs");
const path = require("path");
const util = require("util");
const querystring = require("querystring");

const axios = require("axios");
const minimist = require("minimist");

const jackettPath = "/api/v2.0/indexers/all/results";
let jackettServerUrl;
let jackettApiKey;
let torrentDir;
let outputDir;
let delay = 10000;

const parseTorrentRemote = util.promisify(parseTorrent.remote);

function parseCommandLineArgs() {
	const options = minimist(process.argv.slice(2));
	
	if (!options._[0]) console.error("specify a directory containing torrents");
	if (!options.o) console.error("specify an output directory with -o");
	if (!options.u) console.error("specify jackett url with -u");
	if (!options.k) console.error("specify jackett api key with -k");
	if (!(options.k && options.u && options.o && options._[0])) return false;
	
	jackettServerUrl = options.u;
	jackettApiKey = options.k;
	torrentDir = options._[0];
	outputDir = options.o
	delay = (options.d || 10) * 1000
	
	return true;
}

function makeJackettRequest(query) {
	const params = querystring.stringify({
		apikey: jackettApiKey,
		Query: query,
	});
	return axios.get(`${jackettServerUrl}${jackettPath}?${params}`);
}

function parseTorrentFromFilename(filename) {
	const data = fs.readFileSync(filename);
	const torrentInfo = parseTorrent(data);
	return torrentInfo;
}

function filterTorrentFile(info, index, arr) {
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

async function assessJackettResult(result, ogInfo) {
	const resultInfo = await parseTorrentRemote(result.Link);
	if (resultInfo.length !== ogInfo.length) return null;
	const name = ogInfo.name;
	const announce1 = ogInfo.announce[0];
	const announce2 = resultInfo.announce[0];

	if (resultInfo.infoHash === ogInfo.infoHash) {
		console.log(`hash match for ${name}: ${announce1}, ${announce2}`);
		return null;
	}

	if (!compareFileTrees(resultInfo.files, ogInfo.files)) {
		console.log(`trees differ for ${name}: ${announce1}, ${announce2}}`);
		return null;
	}

	return {
		tracker: result.TrackerId,
		info: resultInfo,
	};
}

async function findOnOtherSites(info) {
	const response = await makeJackettRequest(info.name);
	const results = response.data.Results;
	const promises = results.map((result) => assessJackettResult(result, info));
	const finished = await Promise.all(promises);
	finished
		.filter((e) => e !== null)
		.forEach(({ tracker, info: { name } }) => {
			console.log(`Found ${name} on ${tracker}`);
			saveTorrentFile(tracker, info);
		});
}

function saveTorrentFile(tracker, info) {
	const buf = parseTorrent.toTorrentFile(info);
	const filename = `[${tracker}]${info.name}.torrent`;
	fs.writeFileSync(path.join("x-seeds", filename), buf, {
		mode: 0o644,
	});
}

async function main() {
	
	const successfulParse = parseCommandLineArgs();
	if (!successfulParse) return;
	
	const dirContents = fs
		.readdirSync(torrentDir)
		.map((fn) => path.join(torrentDir, fn));
	const parsedTorrents = dirContents.map(parseTorrentFromFilename);
	const filteredTorrents = parsedTorrents.filter(filterTorrentFile);

	console.log(
		"Found %d torrents, %d suitable",
		dirContents.length,
		filteredTorrents.length
	);

	fs.mkdirSync(outputDir, {
		recursive: true,
	});
	const samples = filteredTorrents.slice(0, 16);
	for (sample of samples) {
		console.log(`Searching for ${sample.name}...`);
		await new Promise((r) => setTimeout(r, delay));
		await findOnOtherSites(sample);
	}
}

main();
