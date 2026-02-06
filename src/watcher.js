const chokidar = require("chokidar");
const fs = require("node:fs");
const path = require("path");
const esbuild = require("esbuild");
const sass = require("sass");
const csso = require("csso");


function toPosix(p) {
	return p.replace(/\\/g, "/");
}

function normalizePatterns(patterns) {
	return Array.isArray(patterns) ? patterns : [patterns];
}

function globBaseDir(glob) {
	const g = toPosix(glob);
	const idx = g.search(/[*?\[]/);
	if (idx === -1) return g;
	const base = g.slice(0, idx);
	return base.replace(/\/+$/, "") || ".";
}

function globToRegExp(glob) {
	const g = toPosix(glob);

	let re = "^";
	for (let i = 0; i < g.length; i++) {
		const c = g[i];

		if (c === "*" && g[i + 1] === "*") {
			i++;
			if (g[i + 1] === "/") {
				i++;
				re += "(?:.*/)?";
			} else {
				re += ".*";
			}
			continue;
		}

		if (c === "*") { re += "[^/]*"; continue; }
		if (c === "?") { re += "[^/]"; continue; }

		if ("\\.[]{}()+-^$|".includes(c)) re += "\\" + c;
		else re += c;
	}
	re += "$";
	return new RegExp(re);
}

function isIgnoredPosix(relPosix, ignoreMatchers) {
	for (const m of ignoreMatchers) {
		if (m instanceof RegExp) {
			if (m.test(relPosix)) return true;
		} else if (typeof m === "function") {
			// si l'user fournit une fonction ignorée, on lui passe le rel posix
			if (m(relPosix)) return true;
		} else if (typeof m === "string") {
			// strings glob déjà compilées dans ignoreMatchers (voir compileIgnoreMatchers)
			// (fallback: on ne devrait pas arriver ici)
			if (globToRegExp(m).test(relPosix)) return true;
		}
	}
	return false;
}

function compileIgnoreMatchers(ignoreList) {
	return (ignoreList || []).map((ig) => {
		if (ig instanceof RegExp) return ig;
		if (typeof ig === "function") return ig;
		// string glob -> RegExp
		return globToRegExp(ig);
	});
}

/**
 * createWatchers(rules, options)
 * - Watch les dossiers racines (baseDirs)
 * - Filtre include via globs (rule.patterns)
 * - Filtre ignore via globs/regex (globalIgnored + rule.ignored)
 */
function createWatchers(rules, options = {}) {
	const opt = {
		cwd: process.cwd(),

		// Ignorés globaux (appliqués dans queue() — pas dans chokidar)
		globalIgnored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],

		ignoreInitial: true,
		awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 10 },

		// Si FS weird (OneDrive, réseau, WSL/Docker bind mount), mets true:
		usePolling: false,
		interval: 200,
		binaryInterval: 300,

		debug: true,
		...options,
	};

	const handles = [];

	for (const rule of rules) {
		if (!rule || typeof rule.callback !== "function") {
			throw new Error("Each rule must have a callback(events, ctx).");
		}

		const name = rule.name || "rule";
		const patterns = normalizePatterns(rule.patterns);

		// include matchers (relatif à cwd, en posix)
		const includeMatchers = patterns.map(globToRegExp);

		// ignore matchers (relatif à cwd, en posix)
		const ignoreMatchers = compileIgnoreMatchers([
			...(opt.globalIgnored || []),
			...(rule.ignored || []),
		]);

		// baseDirs à watcher
		const baseDirs = Array.from(new Set(patterns.map(globBaseDir).map((d) => d || ".")))
			.map((d) => path.resolve(opt.cwd, d));

		if (opt.debug) {
			console.log(`\n[${name}] starting watcher`);
			console.log("  cwd:", opt.cwd);
			console.log("  patterns:", patterns);
			console.log("  baseDirs:", baseDirs);
			console.log("  ignored (applied in queue):", [...(opt.globalIgnored || []), ...(rule.ignored || [])]);
		}

		const pending = new Map();
		let timer = null;
		let running = false;
		let rerun = false;

		const flush = async () => {
			if (running) { rerun = true; return; }
			running = true;
			try {
				do {
					rerun = false;
					const batch = Array.from(pending.values());
					pending.clear();
					if (batch.length) await rule.callback(batch, { rule });
				} while (rerun);
			} finally {
				running = false;
			}
		};

		const queue = (type, absPath) => {
			const rel = toPosix(path.relative(opt.cwd, absPath));

			// ignore d'abord
			if (isIgnoredPosix(rel, ignoreMatchers)) {
				// if (opt.debug) console.log(`[${name}] ignored`, type, rel);
				return;
			}

			// include ensuite
			const ok = includeMatchers.some((rx) => rx.test(rel));
			if (!ok) return;

			if (opt.debug) console.log(`[${name}] queue`, type, rel);

			pending.set(`${type}:${rel}`, { type, file: rel });
			clearTimeout(timer);
			timer = setTimeout(flush, rule.debounceMs ?? 150);
		};

		// ⚠️ IMPORTANT: on ne met PAS "ignored" ici
		const watcher = chokidar.watch(baseDirs, {
			ignoreInitial: opt.ignoreInitial,
			awaitWriteFinish: opt.awaitWriteFinish,
			persistent: true,
			usePolling: opt.usePolling,
			interval: opt.interval,
			binaryInterval: opt.binaryInterval,
		});

		watcher.on("ready", () => {
			console.log(`[${name}] ready`);
		});

		watcher.on("add", (p) => queue("add", p));
		watcher.on("change", (p) => queue("change", p));
		watcher.on("unlink", (p) => queue("unlink", p));
		watcher.on("error", (err) => console.error(`[${name}] watch error:`, err));

		handles.push({
			watcher,
			stopTimers: () => { clearTimeout(timer); pending.clear(); }
		});
	}

	return {
		close: async () => {
			for (const h of handles) h.stopTimers();
			await Promise.all(handles.map((h) => h.watcher.close()));
		},
	};
}


const buildCSS = async (inputScss, outCssMin) => {
	let compiled;
	try {
		compiled = sass.compile(inputScss, {
			loadPaths: [path.resolve(process.cwd(), "./node_modules")],
			style: "compressed",
			sourceMap: false,
			sourceMapIncludeSources: false,
		});
	} catch (err) {
		console.error("❌ Sass compile error:");
		console.error(err?.formatted || err?.message || err);
	}
	const minified = csso.minify(compiled.css, { restructure: false });
	fs.writeFileSync(outCssMin, minified.css);
	console.log(`✅ CSS generated: ${outCssMin}`);
}


const buildJS = async (entry, outfile) => {
	try {
		await esbuild.build({
			entryPoints: [entry],
			outfile,
			bundle: true,
			platform: "browser",
			logLevel: "error",
			treeShaking: true,
			minify: true,
			supported: { "template-literal": false },
			target: ["es2020"],
			legalComments: "none",
		});
		console.log(`✅ JS generated: ${outfile}`);
	} catch (err) {
		console.error("❌ esbuild build failed.");
		if (err?.errors?.length) {
			const formatted = await esbuild.formatMessages(err.errors, {
				kind: "error",
				color: true,
				terminalWidth: process.stdout.columns || 80,
			});
			console.error(formatted.join("\n"));
		} else {
			console.error(err);
		}
	}
}


module.exports = { createWatchers, buildCSS, buildJS };
