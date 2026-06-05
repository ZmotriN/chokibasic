import * as sass from 'sass'
import { minify } from 'csso';
import path from "path";
import fs from "node:fs";

const buildCSS = async (inputScss, outCssMin, options = {}) => {
	// let compiled;
	try {
		const compiled = sass.compile(inputScss, {
			loadPaths: [path.resolve(process.cwd(), "./node_modules")],
			style: "compressed",
			sourceMap: false,
			sourceMapIncludeSources: false,
			...options
		});
		if(options?.style == "expanded"){
			fs.writeFileSync(outCssMin, compiled.css);
		} else {
			const minified = minify(compiled.css, { restructure: false });
			fs.writeFileSync(outCssMin, minified.css);
		}
		console.log(`✅ CSS generated: ${outCssMin}`);
	} catch (err) {
		console.error("❌ Sass compile error:");
		console.error(err?.formatted || err?.message || err);
	}
}

export { buildCSS };