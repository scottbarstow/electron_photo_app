import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { watch, FSWatcher } from 'chokidar';

export interface DirectoryInfo {
  path: string;
  name: string;
  size?: number;
  lastAccessed?: number;
  isValid: boolean;
}

export interface DirectoryStats {
  totalFiles: number;
  totalSize: number;
  imageFiles: number;
  directories: number;
  lastScanned?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: number;
  isImage: boolean;
  extension: string;
}

export interface DirectoryTreeNode {
  path: string;
  name: string;
  type: 'directory' | 'file';
  children?: DirectoryTreeNode[];
  isExpanded?: boolean;
  parent?: string;
  depth: number;
  hasImages?: boolean;
  imageCount?: number;
  isLoaded?: boolean;
}

export class DirectoryService {
  private store: Store<any>;
  private watcher: FSWatcher | null = null;
  private currentRootPath: string | null = null;
  private directoryTreeCache: Map<string, DirectoryTreeNode[]> = new Map();
  
  // Supported image extensions
  private readonly imageExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
    '.webp', '.svg', '.ico', '.heic', '.heif', '.raw', '.dng'
  ]);

  constructor() {
    this.store = new Store({
      name: 'directory-preferences',
      defaults: {
        rootDirectory: null,
        watchEnabled: true,
        scanDepth: 10,
        excludePatterns: [
          'node_modules',
          '.git',
          '.DS_Store',
          'Thumbs.db',
          '.thumbnails'
        ]
      }
    });

    // Load persisted root directory on startup
    this.loadPersistedDirectory();
  }

  private loadPersistedDirectory(): void {
    const savedPath = this.store.get('rootDirectory') as string | null;
    // Use isValidRootCandidate since we're restoring the root, not accessing within it
    if (savedPath && this.isValidRootCandidate(savedPath)) {
      this.currentRootPath = savedPath;
      this.startWatching();
    }
  }

  // Directory validation and access
  isValidDirectory(dirPath: string): boolean {
    try {
      const stats = fs.statSync(dirPath);
      const isDir = stats.isDirectory();
      const hasAccess = this.hasReadAccess(dirPath);
      const isSafe = this.isPathSafe(dirPath);

      if (!isDir || !hasAccess || !isSafe) {
        console.log('isValidDirectory failed for:', dirPath, { isDir, hasAccess, isSafe, currentRoot: this.currentRootPath });
      }

      return isDir && hasAccess && isSafe;
    } catch (err) {
      console.log('isValidDirectory error for:', dirPath, err);
      return false;
    }
  }

  // Validate a directory for use as root (doesn't check against current root)
  private isValidRootCandidate(dirPath: string): boolean {
    try {
      const stats = fs.statSync(dirPath);
      const isDir = stats.isDirectory();
      const hasAccess = this.hasReadAccess(dirPath);

      if (!isDir || !hasAccess) {
        console.log('isValidRootCandidate failed for:', dirPath, { isDir, hasAccess });
      }

      return isDir && hasAccess;
    } catch (err) {
      console.log('isValidRootCandidate error for:', dirPath, err);
      return false;
    }
  }

  private isPathSafe(targetPath: string): boolean {
    if (!this.currentRootPath) {
      return false; // Deny all access when no root is configured (security)
    }

    try {
      // Resolve paths to prevent directory traversal
      const resolvedTarget = path.resolve(targetPath);
      const resolvedRoot = path.resolve(this.currentRootPath);

      // Ensure target is within or equal to root directory
      // Add trailing separator to avoid partial matches like /foo matching /foobar
      const isWithinRoot = resolvedTarget === resolvedRoot ||
                          resolvedTarget.startsWith(resolvedRoot + path.sep);

      return isWithinRoot;
    } catch {
      return false;
    }
  }

  private hasReadAccess(dirPath: string): boolean {
    try {
      fs.accessSync(dirPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  // Root directory management
  setRootDirectory(dirPath: string): boolean {
    // Use isValidRootCandidate instead of isValidDirectory since we're setting
    // a NEW root, not accessing a path within the existing root
    if (!this.isValidRootCandidate(dirPath)) {
      return false;
    }

    // Stop watching previous directory
    this.stopWatching();

    // Clear directory tree cache
    this.clearDirectoryTreeCache();

    // Update current path and persist
    this.currentRootPath = dirPath;
    this.store.set('rootDirectory', dirPath);
    this.store.set('lastAccessed', Date.now());

    // Start watching new directory
    this.startWatching();

    return true;
  }

  getRootDirectory(): string | null {
    return this.currentRootPath;
  }

  getRootDirectoryInfo(): DirectoryInfo | null {
    if (!this.currentRootPath) {
      return null;
    }

    try {
      const stats = fs.statSync(this.currentRootPath);
      return {
        path: this.currentRootPath,
        name: path.basename(this.currentRootPath),
        size: stats.size,
        lastAccessed: this.store.get('lastAccessed') as number,
        isValid: true
      };
    } catch {
      return {
        path: this.currentRootPath,
        name: path.basename(this.currentRootPath),
        isValid: false
      };
    }
  }

  clearRootDirectory(): void {
    this.stopWatching();
    this.clearDirectoryTreeCache();
    this.currentRootPath = null;
    this.store.delete('rootDirectory');
  }

  // Directory scanning and analysis
  async scanDirectory(dirPath?: string): Promise<DirectoryStats> {
    const targetPath = dirPath || this.currentRootPath;
    if (!targetPath || !this.isValidDirectory(targetPath)) {
      throw new Error('Invalid directory path');
    }

    const stats: DirectoryStats = {
      totalFiles: 0,
      totalSize: 0,
      imageFiles: 0,
      directories: 0,
      lastScanned: Date.now()
    };

    await this.scanDirectoryRecursive(targetPath, stats, 0);
    
    // Store scan results
    this.store.set('lastScanStats', stats);
    
    return stats;
  }

  private async scanDirectoryRecursive(
    dirPath: string, 
    stats: DirectoryStats, 
    depth: number
  ): Promise<void> {
    const maxDepth = this.store.get('scanDepth') as number;
    if (depth > maxDepth) return;

    const excludePatterns = this.store.get('excludePatterns') as string[];
    
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip excluded patterns
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          stats.directories++;
          await this.scanDirectoryRecursive(fullPath, stats, depth + 1);
        } else if (entry.isFile()) {
          try {
            const fileStats = await fs.promises.stat(fullPath);
            stats.totalFiles++;
            stats.totalSize += fileStats.size;
            
            if (this.isImageFile(entry.name)) {
              stats.imageFiles++;
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      }
    } catch {
      // Skip directories that can't be accessed
    }
  }

  // Directory tree operations
  async getDirectoryTree(dirPath?: string, maxDepth: number = 3): Promise<DirectoryTreeNode[]> {
    const targetPath = dirPath || this.currentRootPath;
    if (!targetPath || !this.isValidDirectory(targetPath)) {
      throw new Error('Invalid directory path');
    }

    // Check cache first
    const cacheKey = `${targetPath}:${maxDepth}`;
    if (this.directoryTreeCache.has(cacheKey)) {
      return this.directoryTreeCache.get(cacheKey)!;
    }

    const rootNode = await this.buildDirectoryTreeRecursive(targetPath, 0, maxDepth);
    const tree = rootNode ? [rootNode] : [];
    
    // Cache the result
    this.directoryTreeCache.set(cacheKey, tree);
    
    return tree;
  }

  private async buildDirectoryTreeRecursive(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    parent?: string
  ): Promise<DirectoryTreeNode | null> {
    if (currentDepth > maxDepth || !this.isValidDirectory(dirPath)) {
      return null;
    }

    const excludePatterns = this.store.get('excludePatterns') as string[];
    const name = path.basename(dirPath);
    
    // Skip excluded directories
    if (excludePatterns.some(pattern => name.includes(pattern))) {
      return null;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const children: DirectoryTreeNode[] = [];
      let hasImages = false;
      let imageCount = 0;

      // Process directory entries
      for (const entry of entries) {
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively build subdirectory tree
          if (currentDepth < maxDepth) {
            const childNode = await this.buildDirectoryTreeRecursive(
              fullPath,
              currentDepth + 1,
              maxDepth,
              dirPath
            );
            if (childNode) {
              children.push(childNode);
              if (childNode.hasImages) {
                hasImages = true;
                imageCount += childNode.imageCount || 0;
              }
            }
          } else {
            // Create placeholder for unexplored directories
            const hasSubImages = await this.hasImagesInDirectory(fullPath, 1);
            children.push({
              path: fullPath,
              name: entry.name,
              type: 'directory',
              depth: currentDepth + 1,
              parent: dirPath,
              hasImages: hasSubImages,
              isLoaded: false
            });
            if (hasSubImages) {
              hasImages = true;
            }
          }
        } else if (entry.isFile() && this.isImageFile(entry.name)) {
          hasImages = true;
          imageCount++;
        }
      }

      // Sort children: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        path: dirPath,
        name: name,
        type: 'directory',
        children,
        depth: currentDepth,
        parent,
        hasImages,
        imageCount,
        isLoaded: true,
        isExpanded: currentDepth === 0 // Root is expanded by default
      };
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      return null;
    }
  }

  async expandDirectoryNode(dirPath: string, maxDepth: number = 2): Promise<DirectoryTreeNode[]> {
    if (!this.isValidDirectory(dirPath)) {
      throw new Error('Invalid directory path');
    }

    return await this.getDirectoryTree(dirPath, maxDepth);
  }

  async hasImagesInDirectory(dirPath: string, maxDepth: number = 1): Promise<boolean> {
    if (!this.isValidDirectory(dirPath) || maxDepth <= 0) {
      return false;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const excludePatterns = this.store.get('excludePatterns') as string[];

      // Check for images in current directory
      for (const entry of entries) {
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isFile() && this.isImageFile(entry.name)) {
          return true;
        }
      }

      // Recursively check subdirectories if depth allows
      if (maxDepth > 1) {
        for (const entry of entries) {
          if (entry.isDirectory() && 
              !excludePatterns.some(pattern => entry.name.includes(pattern))) {
            const fullPath = path.join(dirPath, entry.name);
            if (await this.hasImagesInDirectory(fullPath, maxDepth - 1)) {
              return true;
            }
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  async getDirectoryImageCount(dirPath: string, recursive: boolean = false): Promise<number> {
    if (!this.isValidDirectory(dirPath)) {
      return 0;
    }

    let count = 0;
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const excludePatterns = this.store.get('excludePatterns') as string[];

      for (const entry of entries) {
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isFile() && this.isImageFile(entry.name)) {
          count++;
        } else if (recursive && entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          count += await this.getDirectoryImageCount(fullPath, true);
        }
      }
    } catch {
      // Return 0 if directory can't be read
    }

    return count;
  }

  clearDirectoryTreeCache(): void {
    this.directoryTreeCache.clear();
  }

  // File operations
  async getDirectoryContents(dirPath: string): Promise<FileInfo[]> {
    if (!this.isValidDirectory(dirPath)) {
      throw new Error('Invalid directory path');
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const fileInfos: FileInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          const fullPath = path.join(dirPath, entry.name);
          const stats = await fs.promises.stat(fullPath);
          const extension = path.extname(entry.name).toLowerCase();
          
          fileInfos.push({
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.getTime(),
            isImage: this.isImageFile(entry.name),
            extension
          });
        } catch {
          // Skip files that can't be accessed
        }
      }
    }

    return fileInfos.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSubdirectories(dirPath: string): Promise<string[]> {
    if (!this.isValidDirectory(dirPath)) {
      throw new Error('Invalid directory path');
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const subdirs: string[] = [];

    // macOS package extensions to exclude
    const packageExtensions = [
      '.photoslibrary', '.photolibrary', '.app', '.bundle',
      '.framework', '.plugin', '.kext', '.xcodeproj', '.xcworkspace'
    ];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        const lowerName = entry.name.toLowerCase();

        // Skip hidden directories
        if (entry.name.startsWith('.')) {
          continue;
        }

        // Skip macOS package directories
        if (packageExtensions.some(ext => lowerName.endsWith(ext))) {
          continue;
        }

        // Skip "Photo Booth Library" specifically (it's a package without extension)
        if (entry.name === 'Photo Booth Library') {
          continue;
        }

        // Skip directories we can't read
        if (!this.hasReadAccess(fullPath)) {
          continue;
        }

        subdirs.push(fullPath);
      }
    }

    return subdirs.sort();
  }

  isImageFile(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    return this.imageExtensions.has(extension);
  }

  // Directory watching
  startWatching(): void {
    if (!this.currentRootPath || this.watcher) {
      return;
    }

    const watchEnabled = this.store.get('watchEnabled') as boolean;
    if (!watchEnabled) {
      return;
    }

    try {
      this.watcher = watch(this.currentRootPath, {
        ignored: [
          /(^|[\/\\])\../,                    // ignore dotfiles
          /\.photoslibrary$/,                  // macOS Photos library
          /\.photolibrary$/,
          /\.app$/,
          /Photo Booth Library$/               // macOS Photo Booth
        ],
        persistent: true,
        depth: 3, // Limit depth for performance
        ignoreInitial: true
      });

      this.watcher
        .on('add', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.emit('fileAdded', filePath);
          }
        })
        .on('unlink', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.emit('fileRemoved', filePath);
          }
        })
        .on('change', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.emit('fileChanged', filePath);
          }
        })
        .on('addDir', (dirPath) => {
          this.emit('directoryAdded', dirPath);
        })
        .on('unlinkDir', (dirPath) => {
          this.emit('directoryRemoved', dirPath);
        })
        .on('error', (error) => {
          console.error('Directory watcher error:', error);
          this.emit('watcherError', error);
        });

      console.log(`Started watching directory: ${this.currentRootPath}`);
    } catch (error) {
      console.error('Failed to start directory watcher:', error);
    }
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('Stopped directory watching');
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  // Event system (simple implementation)
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Preferences management
  setWatchEnabled(enabled: boolean): void {
    this.store.set('watchEnabled', enabled);
    
    if (enabled && this.currentRootPath && !this.watcher) {
      this.startWatching();
    } else if (!enabled && this.watcher) {
      this.stopWatching();
    }
  }

  isWatchEnabled(): boolean {
    return this.store.get('watchEnabled') as boolean;
  }

  setScanDepth(depth: number): void {
    this.store.set('scanDepth', Math.max(1, Math.min(20, depth)));
  }

  getScanDepth(): number {
    return this.store.get('scanDepth') as number;
  }

  setExcludePatterns(patterns: string[]): void {
    this.store.set('excludePatterns', patterns);
  }

  getExcludePatterns(): string[] {
    return this.store.get('excludePatterns') as string[];
  }

  // Utility methods
  getLastScanStats(): DirectoryStats | null {
    return this.store.get('lastScanStats') as DirectoryStats | null;
  }

  getRelativePath(fullPath: string): string {
    if (!this.currentRootPath) {
      return fullPath;
    }
    
    return path.relative(this.currentRootPath, fullPath);
  }

  getFullPath(relativePath: string): string {
    if (!this.currentRootPath) {
      throw new Error('No root directory set');
    }
    
    return path.join(this.currentRootPath, relativePath);
  }

  // Cleanup
  destroy(): void {
    this.stopWatching();
    this.listeners.clear();
  }
}

// Export singleton instance
let serviceInstance: DirectoryService | null = null;

export function getDirectoryService(): DirectoryService {
  if (!serviceInstance) {
    serviceInstance = new DirectoryService();
  }
  return serviceInstance;
}

export function destroyDirectoryService(): void {
  if (serviceInstance) {
    serviceInstance.destroy();
    serviceInstance = null;
  }
}