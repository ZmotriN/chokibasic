module.exports = {
	...require("./src/buildjs.js"),
	...require("./src/buildcss.js"),
	...require("./src/buildphp.js"),
	...require("./src/export.js"),
	...require("./src/watchers.js"),
};