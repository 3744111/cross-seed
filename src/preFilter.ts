import { uniqBy } from "lodash";
import { Metafile } from "parse-torrent";
import path from "path";
import { EP_REGEX, EXTENSIONS, TORRENTS } from "./constants";
import db from "./db";
import * as logger from "./logger";
import { getRuntimeConfig } from "./runtimeConfig";
import { Searchee } from "./searchee";
import { nMinutesAgo, partial } from "./utils";

export function filterByContent(searchee: Searchee): boolean {
	const { includeEpisodes, searchAll } = getRuntimeConfig();

	if (searchAll) return true;

	const logReason = partial(
		logger.verbose,
		"[prefilter]",
		`Torrent ${name} was not selected for searching because`
	);
	if (
		!includeEpisodes &&
		searchee.numFiles === 1 &&
		EP_REGEX.test(Object.keys(searchee.fileTree)[0])
	) {
		logReason("it is a single episode");
		return false;
	}

	const allVideos = files.every((file) =>
		EXTENSIONS.map((e) => `.${e}`).includes(path.extname(file.path))
	);
	if (!allVideos) {
		logReason("not all files are videos");
		return false;
	}

	return true;
}

export function filterDupes(searchees: Searchee[]): Searchee[] {
	const filtered = uniqBy<Searchee>(searchees, "name");
	const numDupes = searchees.length - filtered.length;
	if (numDupes > 0) {
		logger.verbose(
			"[prefilter]",
			`${numDupes} duplicates not selected for searching`
		);
	}
	return filtered;
}

export function filterTimestamps(meta: Metafile): boolean {
	const { excludeOlder, excludeRecentSearch } = getRuntimeConfig();
	const timestampData = db.get([TORRENTS, meta.infoHash]).value();
	if (!timestampData) return true;
	const { firstSearched, lastSearched } = timestampData;
	const logReason = partial(
		logger.verbose,
		"[prefilter]",
		`Torrent ${meta.name} was not selected for searching because`
	);

	if (excludeOlder && firstSearched < nMinutesAgo(excludeOlder)) {
		logReason(
			`its first search timestamp ${firstSearched} is older than ${excludeOlder} minutes ago`
		);
		return false;
	}

	if (
		excludeRecentSearch &&
		lastSearched > nMinutesAgo(excludeRecentSearch)
	) {
		logReason(
			`its last search timestamp ${lastSearched} is newer than ${excludeRecentSearch} minutes ago`
		);
		return false;
	}

	return true;
}
