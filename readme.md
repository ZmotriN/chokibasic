# chokibasic

Tiny build & watch helpers for simple static projects.

## Helpers

- `createWatchers(rules, options)`
- `buildCSS(inputScss, outCssMin, options?)`
- `buildJS(entry, outfile, options?)`
- `buildPHP(file)`
- `buildSitemap(file)`
- `exportDist(src, dist, bannerPath?)`

---

## Install

```bash
npm i chokibasic
````

---

## Usage (watch + build) — original example (fixed)

```js
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
  await w.close();
  process.exit(0);
});
```

---

## API

### `createWatchers(rules, options)`

Creates one watcher per rule using `chokidar`, but with:

* **include filtering** using `rule.patterns` (glob)
* **ignore filtering** using `options.globalIgnored` + `rule.ignored` (glob/RegExp/function)
* **debounced batching**: multiple file events are grouped and sent to your callback

Each callback receives:

* `events`: an array like `{ type, file }`
* `ctx`: `{ rule }`

**Important note (current behavior):**
In the current code, only `"change"` events are enabled (`add` and `unlink` listeners are commented out).

#### Rule shape

```js
{
  name?: string,
  patterns: string | string[],
  ignored?: (string | RegExp | ((relPosixPath) => boolean))[],
  debounceMs?: number, // default 150
  callback: async (events, ctx) => {}
}
```

#### Options

```js
{
  cwd: process.cwd(),
  globalIgnored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],

  // chokidar options used internally:
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 10 },
  usePolling: false,
  interval: 200,
  binaryInterval: 300,

  debug: true
}
```

---

### `buildCSS(inputScss, outCssMin, options?)`

Compiles SCSS using `sass.compile()` and minifies using `csso`.

* Defaults include:

  * `loadPaths: ["<cwd>/node_modules"]`
  * `style: "compressed"`
  * no sourcemap
* `options` is forwarded to `sass.compile()` (and can override defaults).

Example:

```js
const { buildCSS } = require("chokibasic");

await buildCSS("src/styles/main.scss", "dist/app.min.css", {
  // any sass.compile options here
});
```

---

### `buildJS(entry, outfile, options?)`

Bundles & minifies JS using `esbuild`.

Defaults include:

* `bundle: true`
* `platform: "browser"`
* `minify: true`
* `treeShaking: true`
* `target: ["es2020"]`
* `legalComments: "none"`

`options` is forwarded to `esbuild.build()` (and can override defaults).

Example:

```js
const { buildJS } = require("chokibasic");

await buildJS("src/scripts/main.js", "dist/app.min.js", {
  // any esbuild.build options here
});
```

---

### `buildPHP(file)`

Runs `pxpros.render(file)` and logs generated HTML files.

Example:

```js
const { buildPHP } = require("chokibasic");

await buildPHP("src/pages/_index.php");
```

---

### `buildSitemap(file)`

Runs `pxpros.sitemap(file)` and logs generated sitemap XML files.

Example:

```js
const { buildSitemap } = require("chokibasic");

await buildSitemap("src/pages/_index.php");
```

---

### `exportDist(src, dist, bannerPath?)`

Copies your `src` folder to `dist`, while:

* respecting `.gitignore` (if present in project root)
* also ignoring `dist/` for safety
* skipping:

  * any file/folder starting with `_`
  * `.scss`
  * `.js` files that are NOT `.min.js`

Then it can prepend a banner to:

* `.js` and `.css` files using `/*! ... */`
* `.html` files using `<!-- ... -->`

It also replaces placeholders:

* in `.html`:

  * `###YEAR###` → current year
  * `###TIMESTAMP###` → unix timestamp (seconds)
* in `sitemap.xml`:

  * `###TODAY###` → `YYYY-MM-DD`
* in the banner text:

  * `###DATE###` → formatted date (fr-CA, America/Toronto)

Example:

```js
const { exportDist } = require("chokibasic");

const stats = await exportDist("src", "dist"); // uses built-in banner.txt
console.log(stats); // { copied: <number>, skipped: <number> }
```

With a custom banner file:

```js
await exportDist("src", "dist", "src/banner.txt");
```

---

## Changelog

### Version 1.1.4
* Update dependancy: pxpros 1.0.5

### Version 1.1.3
* Complete refactor
* Fix buildCSS "style: expanded"

### Version 1.1.2

* exportDist: Add date replacement for sitemap.xml

### Version 1.1.1

* Update dependancy: pxpros 1.0.4

### Version 1.1.0

* Add a sitemap builder with pxpros
