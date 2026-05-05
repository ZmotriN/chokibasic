declare namespace chokibasic {
  // --- NOUVEAUX TYPES POUR buildConf ---

  /** 
   * Callback pour buildConf. 
   * Reçoit le contenu brut (Buffer) et le chemin relatif du fichier.
   * Doit retourner la nouvelle valeur (string, objet, etc.) qui remplacera le chemin dans le JSON final.
   */
  export type BuildConfCallback = (content: Buffer, relPath: string) => any | Promise<any>;

  /** 
   * Dictionnaire de patterns globaux associés à des callbacks de transformation.
   * Exemple: { "** / *.mid": (buf) => processMidi(buf) }
   */
  export interface BuildConfMatchers {
    [glob: string]: BuildConfCallback;
  }

  // --- TYPES EXISTANTS ---

  export type GlobPattern = string;

  export type IgnoreMatcher =
    | string
    | RegExp
    | ((relPosixPath: string) => boolean);

  export type WatchEventType = "add" | "change" | "unlink" | (string & {});

  export interface WatchEvent {
    type: WatchEventType;
    file: string;
  }

  export interface WatchRuleContext {
    rule: WatchRule;
  }

  export interface WatchRule {
    name?: string;
    patterns: GlobPattern | GlobPattern[];
    ignored?: IgnoreMatcher[];
    debounceMs?: number;
    callback: (events: WatchEvent[], ctx: WatchRuleContext) => void | Promise<void>;
  }

  export interface AwaitWriteFinishOptions {
    stabilityThreshold?: number;
    pollInterval?: number;
  }

  export interface CreateWatchersOptions {
    cwd?: string;
    globalIgnored?: string[];
    ignoreInitial?: boolean;
    awaitWriteFinish?: boolean | AwaitWriteFinishOptions;
    usePolling?: boolean;
    interval?: number;
    binaryInterval?: number;
    debug?: boolean;
    [key: string]: unknown;
  }

  export interface WatchersController {
    close: () => Promise<void>;
  }

  export interface ExportDistStats {
    copied: number;
    skipped: number;
  }

  export interface ExportDistOptions {
    ignore?: string[];
    include?: string[];
    debug?: boolean;
    filter?: (relPath: string) => boolean;
  }

  export type BuildJSOptions = Parameters<typeof import("esbuild").build>[0];
  export type BuildCSSOptions = NonNullable<Parameters<typeof import("sass").compile>[1]>;

  // --- FONCTIONS EXPORTÉES ---

  /**
   * Transforme un fichier YAML en JSON en appliquant des transformations sur les fichiers référencés.
   * @param src Chemin vers le fichier source YAML.
   * @param dst Chemin vers le fichier de destination JSON.
   * @param matchers Dictionnaire de patterns et callbacks de transformation.
   */
  export function buildConf(
    src: string,
    dst: string,
    matchers?: BuildConfMatchers
  ): Promise<void>;

  export function createWatchers(
    rules: WatchRule[],
    options?: CreateWatchersOptions
  ): WatchersController;

  export function exportDist(
    src: string,
    dist: string,
    banner?: string | null,
    options?: ExportDistOptions
  ): Promise<ExportDistStats>;

  export function buildCSS(
    inputScss: string,
    outCssMin: string,
    options?: BuildCSSOptions
  ): Promise<void>;

  export function buildJS(
    entry: string,
    outfile: string,
    options?: BuildJSOptions
  ): Promise<void>;

  export function buildPHP(file: string): Promise<void>;

  export function buildSitemap(file: string): Promise<void>;
}

declare const chokibasic: {
  buildConf: typeof chokibasic.buildConf; // Ajouté ici aussi
  createWatchers: typeof chokibasic.createWatchers;
  exportDist: typeof chokibasic.exportDist;
  buildCSS: typeof chokibasic.buildCSS;
  buildJS: typeof chokibasic.buildJS;
  buildPHP: typeof chokibasic.buildPHP;
  buildSitemap: typeof chokibasic.buildSitemap;
};

export = chokibasic;
export as namespace chokibasic;