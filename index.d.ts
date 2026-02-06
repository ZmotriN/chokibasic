export type WatchEventType = "add" | "change" | "unlink";

export interface WatchEvent {
	type: WatchEventType;
	file: string; // chemin relatif (posix) comme dans ton code
}

export interface WatchRule {
	name?: string;
	patterns: string | string[];
	ignored?: (string | RegExp | ((relPosix: string) => boolean))[];
	debounceMs?: number;
	callback: (events: WatchEvent[], ctx: { rule: WatchRule }) => void | Promise<void>;
}

export interface WatchOptions {
	cwd?: string;
	globalIgnored?: string[];

	ignoreInitial?: boolean;
	awaitWriteFinish?: { stabilityThreshold: number; pollInterval: number };

	usePolling?: boolean;
	interval?: number;
	binaryInterval?: number;

	debug?: boolean;
}

export function createWatchers(
	rules: WatchRule[],
	options?: WatchOptions
): {
	close: () => Promise<void>;
};

export function buildCSS(inputScss: string, outCssMin: string): Promise<void>;
export function buildJS(entry: string, outfile: string): Promise<void>;
