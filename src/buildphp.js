const pxpros = require("pxpros");


const buildPHP = async (file) => {
	const results = await pxpros.render(file);
	if(results.success) {
		results.files.forEach(file => console.log(`✅ HTML generated: ${file}`));
	} else {
		console.error("❌ pxpros render failed.");
		console.error(results.error);
	}
}


const buildSitemap = async (file) => {
	const results = await pxpros.sitemap(file);
	if(results.success) {
		results.files.forEach(file => console.log(`✅ XML Sitemap generated: ${file}`));
	} else {
		console.error("❌ pxpros sitemap creation failed.");
		console.error(results.error);
	}
}

module.exports = { buildPHP, buildSitemap };