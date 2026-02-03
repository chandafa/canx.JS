import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class Vite {
  private static instance: Vite;
  private buildDirectory: string = 'build';
  private hotFile: string = 'hot';
  private manifestPath: string | null = null;
  private manifestCache: Record<string, any> | null = null;

  constructor() {}

  public static getInstance(): Vite {
    if (!Vite.instance) {
      Vite.instance = new Vite();
    }
    return Vite.instance;
  }

  /**
   * Set the build directory (relative to public)
   * Default: 'build'
   */
  public useBuildDirectory(dir: string): this {
    this.buildDirectory = dir;
    return this;
  }

  /**
   * Set the hot file path (relative to public)
   * Default: 'hot'
   */
  public useHotFile(path: string): this {
    this.hotFile = path;
    return this;
  }

  /**
   * Manually set manifest path
   */
  public useManifest(path: string): this {
    this.manifestPath = path;
    return this;
  }

  /**
   * Generate tags for entrypoints
   */
  public invoke(entrypoints: string | string[], buildDirectory?: string): string {
    if (buildDirectory) {
      this.buildDirectory = buildDirectory;
    }

    const entries = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    
    if (this.isRunningHot()) {
      return this.hotAsset(entries);
    }

    const manifest = this.getManifest();
    let tags = '';

    for (const entry of entries) {
      tags += this.makeTag(entry, manifest);
      
      // Preload imports and css
      // complex logic omitted for brevity, focusing on main entrypoints
    }

    return tags;
  }

  /**
   * React Refresh Preamble
   */
  public reactRefresh(): string {
    if (!this.isRunningHot()) return '';

    const hotUrl = this.readHotFile().trim();

    return `
<script type="module">
  import RefreshRuntime from "${hotUrl}/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`;
  }

  /**
   * Get path to asset
   */
  public asset(path: string, buildDirectory?: string): string {
    if (buildDirectory) {
      this.buildDirectory = buildDirectory;
    }

    if (this.isRunningHot()) {
      const hotUrl = this.readHotFile().trim();
      return `${hotUrl}/${path}`;
    }

    const manifest = this.getManifest();
    const chunk = manifest[path];

    if (!chunk) {
      return this.publicPath(path);
    }

    return this.publicPath(chunk.file);
  }

  // ============================================
  // Internal Methods
  // ============================================

  private isRunningHot(): boolean {
    return existsSync(this.hotPath());
  }

  private hotPath(): string {
    return join(process.cwd(), 'public', this.hotFile);
  }

  private readHotFile(): string {
    return readFileSync(this.hotPath(), 'utf-8');
  }

  private hotAsset(entries: string[]): string {
    const hotUrl = this.readHotFile().trim();
    let tags = `<script type="module" src="${hotUrl}/@vite/client"></script>`;

    for (const entry of entries) {
      tags += `<script type="module" src="${hotUrl}/${entry}"></script>`;
    }
    return tags;
  }

  private getManifest(): Record<string, any> {
    if (this.manifestCache) return this.manifestCache;

    const path = this.manifestPath || join(process.cwd(), 'public', this.buildDirectory, 'manifest.json');

    if (!existsSync(path)) {
      throw new Error(`Vite manifest not found at: ${path}`);
    }

    this.manifestCache = JSON.parse(readFileSync(path, 'utf-8'));
    return this.manifestCache!;
  }

  private makeTag(entry: string, manifest: any): string {
    const chunk = manifest[entry];
    if (!chunk) {
       // Fallback or error?
       // console.error(`Unable to locate file in Vite manifest: ${entry}`);
       return ''; 
    }

    const url = this.publicPath(chunk.file);
    
    if (chunk.file.match(/\.css$/)) {
        return `<link rel="stylesheet" href="${url}" />`;
    }
    
    let tag = `<script type="module" src="${url}"></script>`;
    
    // CSS imported by JS
    if (chunk.css && Array.isArray(chunk.css)) {
        for (const css of chunk.css) {
            tag += `<link rel="stylesheet" href="${this.publicPath(css)}" />`;
        }
    }
    
    return tag;
  }

  private publicPath(filename: string): string {
    const separator = this.buildDirectory.startsWith('/') ? '' : '/';
    return `${separator}${this.buildDirectory}/${filename}`;
  }
}

export const viteManager = Vite.getInstance();
