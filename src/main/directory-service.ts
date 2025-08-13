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

export class DirectoryService {
  private store: Store;
  private watcher: FSWatcher | null = null;
  private currentRootPath: string | null = null;
  
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
    if (savedPath && this.isValidDirectory(savedPath)) {
      this.currentRootPath = savedPath;
      this.startWatching();
    }
  }

  // Directory validation and access
  isValidDirectory(dirPath: string): boolean {
    try {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory() && this.hasReadAccess(dirPath);
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
    if (!this.isValidDirectory(dirPath)) {
      return false;
    }

    // Stop watching previous directory
    this.stopWatching();

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

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip hidden and excluded directories
        if (!entry.name.startsWith('.')) {
          subdirs.push(fullPath);
        }
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
        ignored: /(^|[\/\\])\../, // ignore dotfiles
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