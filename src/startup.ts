import { getClient } from "./clients/TorrentClient";
import { validateJackettApi } from "./jackett";
import * as logger from "./logger";

export async function doStartupValidation(): Promise<void> {
	logger.log("Validating your configuration...");
	const downloadClient = getClient();
	await Promise.all<void>(
		[
			validateJackettApi(),
			downloadClient && downloadClient.validateConfig(),
		].filter(Boolean)
	);
	logger.log("Your configuration is valid!");
}
