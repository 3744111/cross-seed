export const EP_REGEX = /^(?<title>.+)[. ](?<season>S\d+)(?<episode>E\d+)/i;
export const SEASON_REGEX = /^(?<title>.+)[. ](?<season>S\d+)(?:\s?-\s?(?<seasonmax>S?\d+))?(?!E\d+)/i;
export const MOVIE_REGEX = /^(?<title>.+)[. ][[(]?(?<year>\d{4})[)\]]?(?![pi])/i;

export const EXTENSIONS = ["mkv", "mp4", "avi"];

export const CONFIG_TEMPLATE_URL =
	"https://github.com/mmgoodnow/cross-seed/blob/master/src/config.template.js";

export const TORRENTS = "torrents";
export const DECISIONS = "decisions";

export enum Action {
	SAVE = "save",
	INJECT = "inject",
}

export enum InjectionResult {
	SUCCESS = 1,
	FAILURE = -1,
	ALREADY_EXISTS = 0,
}

export enum Decision {
	MATCH = "MATCH",
	SIZE_MISMATCH = "SIZE_MISMATCH",
	NO_DOWNLOAD_LINK = "NO_DOWNLOAD_LINK",
	DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
	INFO_HASH_ALREADY_EXISTS = "INFO_HASH_ALREADY_EXISTS",
	FILE_TREE_MISMATCH = "FILE_TREE_MISMATCH",
	UNKNOWN = "UNKNOWN",
}

export type FailureDecision = Exclude<Decision, Decision.MATCH>;

export const PermanentDecisions: Decision[] = [
	Decision.SIZE_MISMATCH,
	Decision.NO_DOWNLOAD_LINK,
	Decision.FILE_TREE_MISMATCH,
];

// if the user has aggressive caching on, we will skip reassessment.
// Useful for sites that rate limit because it allows you to spend
// your scarce snatches on new torrents rather than the same 30 successes
// Off by default because it makes runs mildly non-deterministic
export const AggressiveCachingPermanentDecisions: Decision[] = [
	Decision.INFO_HASH_ALREADY_EXISTS,
	Decision.MATCH,
];
