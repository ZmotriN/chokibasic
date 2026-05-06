const fs = require("fs").promises;
const path = require("path");
const yaml = require("js-yaml");
const pm = require("picomatch");

const ROOT = process.cwd();


async function getMetadata() {
    let version = "0.0.0";
    try {
        const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
        version = pkg.version || version;
    } catch (e) {}

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return { version, date: dateStr };
}


async function walkAndTransform(node, matchers, metadata) {
    if (Array.isArray(node)) {
        return await Promise.all(node.map(item => walkAndTransform(item, matchers, metadata)));
    }

    if (typeof node === 'object' && node !== null) {
        const newNode = {};
        for (const [key, value] of Object.entries(node)) {
            newNode[key] = await walkAndTransform(value, matchers, metadata);
        }
        return newNode;
    }

    if (typeof node === 'string') {
        let processedString = node
            .replace(/__VERSION__/g, metadata.version)
            .replace(/__DATE__/g, metadata.date);

        const fullPath = path.join(ROOT, processedString);
        try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
                for (const [pattern, callback] of Object.entries(matchers)) {
                    if (pm(pattern)(processedString)) {
                        const content = await fs.readFile(fullPath);
                        return await callback(content, processedString);
                    }
                }
            }
        } catch (err) {}
        return processedString;
    }

    return node;
}


async function buildConf(src, dst, matchers = {}) {
    try {
        const metadata = await getMetadata();
        const fileContents = await fs.readFile(src, 'utf8');
        const rawData = yaml.load(fileContents);
        const processedData = await walkAndTransform(rawData, matchers, metadata);
        await fs.writeFile(dst, JSON.stringify(processedData, null, 2), 'utf8');
        console.log(`✅ Build réussi : ${dst} (${metadata.version})`);
    } catch (error) {
        console.error("❌ Erreur :", error);
    }
}

module.exports = { buildConf };