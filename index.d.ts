import type { BuildOptions } from "esbuild";
import type { Options as SassOptions } from "sass";

// ─── buildConf ────────────────────────────────────────────────────────────────

/**
 * Callback pour buildConf.
 * Reçoit le contenu brut (Buffer) et le chemin relatif du fichier.
 * Doit retourner la nouvelle valeur (string, objet, etc.) qui remplacera
 * le chemin dans le JSON final.
 */
export type BuildConfCallback = (content: Buffer, relPath: string) => any | Promise<any>;

/**
 * Dictionnaire de patterns globaux associés à des callbacks de transformation.
 * Exemple : { "**\/*.mid": (buf) => processMidi(buf) }
 */
export interface BuildConfMatchers {
  [glob: string]: BuildConfCallback;
}

/**
 * Transforme un fichier YAML en JSON en appliquant des transformations
 * sur les fichiers référencés dans les valeurs.
 * Les tokens __VERSION__ et __DATE__ sont remplacés automatiquement.
 *
 * @param src     Chemin vers le fichier source YAML.
 * @param dst     Chemin vers le fichier de destination JSON.
 * @param matchers Dictionnaire de patterns et callbacks de transformation.
 */
export function buildConf(
  src: string,
  dst: string,
  matchers?: BuildConfMatchers
): Promise<void>;

// ─── buildCSS ─────────────────────────────────────────────────────────────────

export type BuildCSSOptions = SassOptions<"sync">;

/**
 * Compile un fichier SCSS en CSS minifié via Sass + csso.
 * Si `options.style === "expanded"`, csso est ignoré et le CSS est écrit tel quel.
 *
 * @param inputScss  Chemin vers le fichier SCSS source.
 * @param outCssMin  Chemin vers le fichier CSS de sortie.
 * @param options    Options Sass (style, loadPaths, sourceMap, …).
 */
export function buildCSS(
  inputScss: string,
  outCssMin: string,
  options?: BuildCSSOptions
): Promise<void>;

// ─── buildJS ──────────────────────────────────────────────────────────────────

export type BuildJSOptions = BuildOptions;

/**
 * Bundle et minifie un fichier JavaScript via esbuild.
 *
 * @param entry    Chemin vers le fichier d'entrée.
 * @param outfile  Chemin vers le fichier de sortie.
 * @param options  Options esbuild (target, format, loader, plugins, …).
 */
export function buildJS(
  entry: string,
  outfile: string,
  options?: BuildJSOptions
): Promise<void>;

// ─── buildPHP / buildSitemap ──────────────────────────────────────────────────

/**
 * Génère du HTML à partir d'un fichier PHP via pxpros.
 *
 * @param file Chemin vers le fichier PHP source.
 */
export function buildPHP(file: string): Promise<void>;

/**
 * Génère un sitemap XML via pxpros.
 *
 * @param file Chemin vers le fichier de configuration du sitemap.
 */
export function buildSitemap(file: string): Promise<void>;

// ─── exportDist ───────────────────────────────────────────────────────────────

export interface ExportDistOptions {
  /** Patterns glob supplémentaires à ignorer (en plus du .gitignore et de dist/). */
  ignore?: string[];
}

export interface ExportDistStats {
  copied: number;
  skipped: number;
}

/**
 * Copie les fichiers de `src` vers `dist` en respectant le .gitignore,
 * en excluant les fichiers SCSS, JS non-minifiés et les fichiers/dossiers
 * préfixés par `_`.
 * Injecte automatiquement un banner dans les fichiers .js, .css et .html,
 * et remplace les tokens ###YEAR###, ###TIMESTAMP### et ###TODAY###.
 *
 * @param src     Dossier source.
 * @param dist    Dossier de destination (vidé avant la copie).
 * @param banner  Chemin vers un fichier texte de banner personnalisé (optionnel).
 * @param options Options supplémentaires.
 */
export function exportDist(
  src: string,
  dist: string,
  banner?: string | null,
  options?: ExportDistOptions
): Promise<ExportDistStats>;

// ─── createWatchers ───────────────────────────────────────────────────────────

export type GlobPattern = string;

export type IgnoreMatcher =
  | string
  | RegExp
  | ((relPosixPath: string) => boolean);

export type WatchEventType = "add" | "change" | "unlink" | (string & {});

export interface WatchEvent {
  type: WatchEventType;
  /** Chemin relatif au cwd, en format posix. */
  file: string;
}

export interface WatchRuleContext {
  rule: WatchRule;
}

export interface WatchRule {
  /** Nom de la règle (utilisé dans les logs). */
  name?: string;
  /** Un ou plusieurs patterns glob à surveiller. */
  patterns: GlobPattern | GlobPattern[];
  /** Patterns/regex/fonctions à ignorer pour cette règle. */
  ignored?: IgnoreMatcher[];
  /** Délai de debounce en ms avant de déclencher le callback (défaut : 150). */
  debounceMs?: number;
  /** Appelé avec le batch d'événements déclencheurs. */
  callback: (events: WatchEvent[], ctx: WatchRuleContext) => void | Promise<void>;
}

export interface AwaitWriteFinishOptions {
  stabilityThreshold?: number;
  pollInterval?: number;
}

export interface CreateWatchersOptions {
  /** Répertoire de travail (défaut : process.cwd()). */
  cwd?: string;
  /** Patterns ignorés globalement, appliqués à toutes les règles (défaut : node_modules, .git, dist). */
  globalIgnored?: string[];
  /** Ignorer les événements au démarrage du watcher (défaut : true). */
  ignoreInitial?: boolean;
  awaitWriteFinish?: boolean | AwaitWriteFinishOptions;
  /** Activer le polling (utile sous WSL, OneDrive, montages réseau). */
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  /** Activer les logs de debug (défaut : true). */
  debug?: boolean;
  [key: string]: unknown;
}

export interface WatchersController {
  /** Arrête proprement tous les watchers et vide les queues. */
  close: () => Promise<void>;
}

/**
 * Crée un ou plusieurs watchers chokidar avec filtrage par patterns glob,
 * debounce, et exécution sérialisée des callbacks.
 *
 * @param rules   Liste des règles de surveillance.
 * @param options Options globales des watchers.
 */
export function createWatchers(
  rules: WatchRule[],
  options?: CreateWatchersOptions
): WatchersController;