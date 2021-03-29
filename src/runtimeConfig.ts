import { Action } from "./constants";

interface RuntimeConfig {
	offset: number;
	jackettServerUrl: string;
	jackettApiKey: string;
	delay: number;
	trackers: string[];
	torrentDir: string;
	outputDir: string;
	includeEpisodes: boolean;
	verbose: boolean;
	searchAll: boolean;
	excludeOlder: number;
	excludeRecentSearch: number;
	action: Action;
	rtorrentRpcUrl: string;
	qBittorrentUrl: string;
}

let runtimeConfig: RuntimeConfig;

export function setRuntimeConfig(configObj: RuntimeConfig): void {
	runtimeConfig = configObj;
}

export function getRuntimeConfig(): RuntimeConfig {
	return runtimeConfig;
}
