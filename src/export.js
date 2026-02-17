const fsprom = require('fs/promises');
const ignore = require('ignore');
const fs = require("node:fs");
const path = require("path");

const ROOT = process.cwd();


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
	const today = (d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)(new Date());

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
				else if (lower.endsWith('.html')) await fsprom.writeFile(copied, "<!--\n\n" + bannerContent + "\n\n\-->\n" + (await fsprom.readFile(copied, 'utf8'))
					.replaceAll(/###YEAR###/g, (new Date).getFullYear())
					.replaceAll(/###TIMESTAMP###/g, Math.floor(Date.now() / 1000)), "utf8");
				else if (lower.endsWith('sitemap.xml')) await fsprom.writeFile(copied, (await fsprom.readFile(copied, 'utf8')).replaceAll(/###TODAY###/g, today), "utf8");
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


module.exports = { exportDist };