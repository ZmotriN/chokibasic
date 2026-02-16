# chokibasic

Helpers:
- `createWatchers(rules, options)`
- `buildCSS(inputScss, outCssMin)`
- `buildJS(entry, outfile)`

## Install
```bash
npm i chokibasic
```

## Usage
```JS
const { createWatchers, buildCSS, buildJS } = require("chokibasic");

const w = createWatchers(
  [
    {
      name: "css",
      patterns: ["src/styles/**/*.scss"],
      callback: async (events) => {
        console.log("css events:", events);
        await buildCSS("src/styles/main.scss", "dist/app.min.css");
      }
    },
    {
      name: "js",
      patterns: ["src/scripts/**/*.js"],
      ignored: ["**/*.min.js"],
      callback: async (events) => {
        console.log("js events:", events);
        await buildJS("src/scripts/main.js", "dist/app.min.js");
      }
    }
  ],
  { debug: true }
);

// later: await w.close();
process.on("SIGINT", async () => {
	await close();
	process.exit(0);
});

```

## Changelog

### Version 1.1.2
- exportDist: Add date remplacement for sitemap.xml

### Version 1.1.1
- Update dependancy: pxpros 1.0.4

### Version 1.1.0
- Add a sitemap builder with pxpros