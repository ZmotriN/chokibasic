
declare namespace chokibasic {
  export type GlobPattern = string;

  export type IgnoreMatcher =
    | string
    | RegExp
    | ((relPosixPath: string) => boolean);

  export type WatchEventType = "add" | "change" | "unlink" | (string & {});

  export interface WatchEvent {
    /** Type d’évènement (dans le code actuel: surtout "change") */
    type: WatchEventType;
    /** Chemin relatif à cwd, normalisé POSIX (slash "/") */
    file: string;
  }

  export interface WatchRuleContext {
    rule: WatchRule;
  }

  export interface WatchRule {
    /** Nom affiché en debug */
    name?: string;

    /** Globs d’inclusion (ex: "src/styles/ ** / *.scss") */
    patterns: GlobPattern | GlobPattern[];

    /** Ignorés additionnels (globs / regex / function) */
    ignored?: IgnoreMatcher[];

    /** Debounce en ms (défaut: 150) */
    debounceMs?: number;

    /**
     * Callback appelé avec un batch d’évènements.
     * Le batch contient des objets { type, file }.
     */
    callback: (events: WatchEvent[], ctx: WatchRuleContext) => void | Promise<void>;
  }

  export interface AwaitWriteFinishOptions {
    stabilityThreshold?: number;
    pollInterval?: number;
  }

  export interface CreateWatchersOptions {
    /** Répertoire racine utilisé pour calculer les chemins relatifs */
    cwd?: string;

    /**
     * Ignorés globaux (appliqués dans queue(), pas via chokidar "ignored")
     * Défaut: ["** /node_modules/ **","** /.git/ **","** /dist/ **"]
     */
    globalIgnored?: string[];

    /** chokidar: ignoreInitial */
    ignoreInitial?: boolean;

    /** chokidar: awaitWriteFinish */
    awaitWriteFinish?: boolean | AwaitWriteFinishOptions;

    /** chokidar: usePolling */
    usePolling?: boolean;

    /** chokidar: interval */
    interval?: number;

    /** chokidar: binaryInterval */
    binaryInterval?: number;

    /** Log console */
    debug?: boolean;

    /** Permet d’accepter d’autres options sans casser les types */
    [key: string]: unknown;
  }

  export interface WatchersController {
    /** Ferme tous les watchers et annule les timers */
    close: () => Promise<void>;
  }

  export interface ExportDistStats {
    copied: number;
    skipped: number;
  }

  /** Options forwardées à esbuild.build() */
  export type BuildJSOptions = Parameters<typeof import("esbuild").build>[0];

  /** Options forwardées à sass.compile() */
  export type BuildCSSOptions = NonNullable<Parameters<typeof import("sass").compile>[1]>;

  /**
   * Crée un ou plusieurs watchers (un par règle).
   */
  export function createWatchers(
    rules: WatchRule[],
    options?: CreateWatchersOptions
  ): WatchersController;

  /**
   * Exporte un dossier `src` vers `dist` en respectant .gitignore + exclusions.
   */
  export function exportDist(
    src: string,
    dist: string,
    banner?: string | null
  ): Promise<ExportDistStats>;

  /**
   * Compile SCSS -> CSS minifié (csso), écrit dans outCssMin.
   */
  export function buildCSS(
    inputScss: string,
    outCssMin: string,
    options?: BuildCSSOptions
  ): Promise<void>;

  /**
   * Bundle/minify JS via esbuild.
   */
  export function buildJS(
    entry: string,
    outfile: string,
    options?: BuildJSOptions
  ): Promise<void>;

  /**
   * Rend un fichier via pxpros.render(file).
   */
  export function buildPHP(file: string): Promise<void>;

  /**
   * Génère un sitemap via pxpros.sitemap(file).
   */
  export function buildSitemap(file: string): Promise<void>;
}

declare const chokibasic: {
  createWatchers: typeof chokibasic.createWatchers;
  exportDist: typeof chokibasic.exportDist;
  buildCSS: typeof chokibasic.buildCSS;
  buildJS: typeof chokibasic.buildJS;
  buildPHP: typeof chokibasic.buildPHP;
  buildSitemap: typeof chokibasic.buildSitemap;
};

export = chokibasic;
export as namespace chokibasic;
