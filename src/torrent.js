const util = require("util");
const fs = require("fs");
const path = require("path");
const parseTorrent = require("parse-torrent");
const remote = util.promisify(parseTorrent.remote);
const chalk = require("chalk");
const { stripExtension } = require("./utils");

function parseTorrentFromFilename(filename) {
	const data = fs.readFileSync(filename);
	return parseTorrent(data);
}

function parseTorrentFromURL(url) {
	return remote(url).catch((_) => {
		console.error(chalk.red`error parsing torrent at ${url}`);
		return null;
	});
}

function saveTorrentFile(tracker, tag = "", info, outputDir) {
	const buf = parseTorrent.toTorrentFile(info);
	const name = stripExtension(info.name);
	const filename = `[${tag}][${tracker}]${name}.torrent`;
	fs.writeFileSync(path.join(outputDir, filename), buf, { mode: 0o644 });
}

function findAllTorrentFilesInDir(torrentDir) {
	return fs
		.readdirSync(torrentDir)
		.filter((fn) => path.extname(fn) === ".torrent")
		.map((fn) => path.join(torrentDir, fn));
}

function getInfoHashesToExclude(torrentDir) {
	return findAllTorrentFilesInDir(torrentDir).map((pathname) =>
		path.basename(pathname, ".torrent").toLowerCase()
	);
}

function loadTorrentDir(torrentDir) {
	const dirContents = findAllTorrentFilesInDir(torrentDir);
	return dirContents.map(parseTorrentFromFilename);
}

function getTorrentByName(torrentDir, name) {
	const dirContents = findAllTorrentFilesInDir(torrentDir);
	const findResult = dirContents.find((filename) => {
		const meta = parseTorrentFromFilename(filename);
		return meta.name === name;
	});
	if (findResult === undefined) {
		const message = `Error: could not find a torrent with the name ${name}`;
		throw new Error(message);
	}
	return parseTorrentFromFilename(findResult);
}

module.exports = {
	parseTorrentFromFilename,
	parseTorrentFromURL,
	saveTorrentFile,
	loadTorrentDir,
	getTorrentByName,
	getInfoHashesToExclude,
};
