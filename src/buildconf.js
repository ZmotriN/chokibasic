const fs = require("fs").promises;
const path = require("path");
const yaml = require("js-yaml");
const pm = require("picomatch");

const ROOT = process.cwd();

/**
 * Parcourt récursivement la configuration et transforme les valeurs
 * si elles correspondent à un fichier existant et à un pattern défini.
 */
async function walkAndTransform(node, matchers) {
    if (Array.isArray(node)) {
        return await Promise.all(node.map(item => walkAndTransform(item, matchers)));
    }

    if (typeof node === 'object' && node !== null) {
        const newNode = {};
        for (const [key, value] of Object.entries(node)) {
            newNode[key] = await walkAndTransform(value, matchers);
        }
        return newNode;
    }

    if (typeof node === 'string') {
        const fullPath = path.join(ROOT, node);
        try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
                for (const [pattern, callback] of Object.entries(matchers)) {
                    const isMatch = pm(pattern);
                    if (isMatch(node)) {
                        const content = await fs.readFile(fullPath);
                        return await callback(content, node);
                    }
                }
            }
        } catch (err) {
        }
    }

    return node;
}

/**
 * Fonction principale buildConf
 */
async function buildConf(src, dst, matchers = {}) {
    try {
        const fileContents = await fs.readFile(src, 'utf8');
        const rawData = yaml.load(fileContents);
        const processedData = await walkAndTransform(rawData, matchers);
        const jsonContent = JSON.stringify(processedData, null, 2);
        await fs.writeFile(dst, jsonContent, 'utf8');
        console.log(`✅ Build de la configuration réussi : ${dst}`);
    } catch (error) {
        console.error("❌ Erreur lors du buildConf :", error);
    }
}

module.exports = { buildConf };