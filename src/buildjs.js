const esbuild = require("esbuild");


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

module.exports = { buildJS };