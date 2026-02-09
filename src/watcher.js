const chokidar = require("chokidar");
const fs = require("node:fs");
const fsprom = require('fs/promises');
const path = require("path");
const esbuild = require("esbuild");
const sass = require("sass");
const csso = require("csso");
const pxpros = require("pxpros");
const ignore = require('ignore');

const ROOT = process.cwd();

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
			console.log("");
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

		// watcher.on("ready", () => {
		// 	console.log(`[${name}] ready`);
		// });

		// watcher.on("add", (p) => queue("add", p));
		watcher.on("change", (p) => queue("change", p));
		// watcher.on("unlink", (p) => queue("unlink", p));
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


const buildCSS = async (inputScss, outCssMin, options = {}) => {
	let compiled;
	try {
		compiled = sass.compile(inputScss, {
			loadPaths: [path.resolve(process.cwd(), "./node_modules")],
			style: "compressed",
			sourceMap: false,
			sourceMapIncludeSources: false,
			...options
		});
		const minified = csso.minify(compiled.css, { restructure: false });
		fs.writeFileSync(outCssMin, minified.css);
		console.log(`✅ CSS generated: ${outCssMin}`);
	} catch (err) {
		console.error("❌ Sass compile error:");
		console.error(err?.formatted || err?.message || err);
	}
}


const buildJS = async (entry, outfile, options = {}) => {
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
			...options
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


const buildPHP = async (file) => {
	const results = await pxpros.render(file);
	if(results.success) {
		results.files.forEach(file => console.log(`✅ HTML generated: ${file}`));
	} else {
		console.error("❌ pxpros render failed.");
		console.error(results.error);
	}
}



async function emptyDir(dir) {
	await fsprom.mkdir(dir, { recursive: true });
	const entries = await fsprom.readdir(dir, { withFileTypes: true });
	await Promise.all(entries.map((e) => fsprom.rm(path.join(dir, e.name), { recursive: true, force: true })));
}


function formatFrDate(dateInput = new Date(), timeZone = 'America/Toronto') {
	const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
	const fmt = new Intl.DateTimeFormat('fr-CA', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: false,
		timeZone
	});
	const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
	const weekday = parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1); // "Samedi"
	return `${weekday} le ${parts.day} ${parts.month} ${parts.year} à ${parts.hour} h ${parts.minute}`;
}


function norm(p) {
	// normalise en chemin POSIX pour compat .gitignore
	return p.split(path.sep).join('/');
}

async function loadGitignore() {
	const ig = ignore();
	const giPath = path.join(ROOT, '.gitignore');
	if (fs.existsSync(giPath)) {
		const txt = await fsprom.readFile(giPath, 'utf8');
		ig.add(txt);
	}
	// on ignore aussi le dossier dist par sécurité (pas nécessaire mais sain)
	ig.add('dist/');
	return ig;
}

async function rmDir(dir) {
	await fsprom.rm(dir, { recursive: true, force: true });
	await fsprom.mkdir(dir, { recursive: true });
}

function shouldExcludeFile(relFromRoot, absPath) {
	// Exclusions de type/extension
	const lower = absPath.toLowerCase();
	if (path.basename(lower).startsWith('_')) return true;
	if (lower.endsWith('.scss')) return true;
	if (lower.endsWith('.js') && !lower.endsWith('.min.js')) return true;
	return false;
}

async function copyFilePreserveTree(absSrc, src, dist, ig) {
	const relFromSrc = path.relative(src, absSrc);
	const relFromRoot = path.relative(ROOT, absSrc);
	const relPosix = norm(relFromRoot);

	// 1) Exclusions via .gitignore
	if (ig.ignores(relPosix)) return false;

	// 2) Exclusions spécifiques (scss, js non minifiés)
	if (shouldExcludeFile(relPosix, absSrc)) return false;

	const absDst = path.join(dist, relFromSrc);
	// console.log(absDst);
	await fsprom.mkdir(path.dirname(absDst), { recursive: true });
	await fsprom.copyFile(absSrc, absDst);
	return absDst;
}

async function walkAndCopy(dir, src, dest, ig, stats, banner = null) {
	const entries = await fsprom.readdir(dir, { withFileTypes: true });
	const bannerContent = (await fsprom.readFile(banner || path.join(__dirname, 'banner.txt'), 'utf8')).replace(/###DATE###/, formatFrDate());

	for (const de of entries) {
		const abs = path.join(dir, de.name);
		const relFromRoot = path.relative(ROOT, abs);
		const relPosix = norm(relFromRoot);

		if (de.isDirectory()) {
			// Si le dossier est ignoré par .gitignore, on ne descend pas
			if (ig.ignores(relPosix + '/')) continue;
			if(de.name.startsWith('_')) continue;
			await walkAndCopy(abs, src, dest, ig, stats, banner);
		} else if (de.isFile()) {
			const copied = await copyFilePreserveTree(abs, src, dest, ig);
			if (copied) {
				const lower = abs.toLowerCase();
				if (lower.endsWith('.js')) await fsprom.writeFile(copied, "/*!\n\n" + bannerContent + "\n\n*/\n" + (await fsprom.readFile(copied, 'utf8')), "utf8");
				else if (lower.endsWith('.css')) await fsprom.writeFile(copied, "/*!\n\n" + bannerContent + "\n\n*/\n" + (await fsprom.readFile(copied, 'utf8')), "utf8");
				else if (lower.endsWith('.html')) await fsprom.writeFile(copied, "<!--\n\n" + bannerContent + "\n\n\-->\n" + (await fsprom.readFile(copied, 'utf8')).replaceAll(/###YEAR###/g, (new Date).getFullYear()), "utf8");
				stats.copied++;
			}
			else stats.skipped++;
		}
		// (symlinks & autres: ignorés)
	}
}


const exportDist = async (src, dist, banner = null) => {
	try {
		const ig = await loadGitignore();

		await emptyDir(dist);
		if (!fs.existsSync(src)) throw new error('Folder src is invalid.');

		const stats = { copied: 0, skipped: 0 };
		await walkAndCopy(src, src, dist, ig, stats, banner);

		return stats;
	} catch (err) {
		throw new error(err);
	}
}


module.exports = { createWatchers, exportDist, buildCSS, buildJS, buildPHP };
