import { dialog, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { watch, FSWatcher } from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { getLogger } from './logger';
import { getDirectoryRepository } from './repositories';

const logger = getLogger();

export interface DirectoryInfo {
  path: string;
  exists: boolean;
  accessible: boolean;
  isDirectory: boolean;
  lastChecked: string;
}

export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  imageFiles: number;
  lastScanned?: string;
}

export interface DirectoryChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: {
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    modified: Date;
  };
}

class DirectoryService {
  private store: Store<Record<string, unknown>>;
  private currentDirectory: string | null = null;
  private watcher: FSWatcher | null = null;
  private eventCallbacks: Set<(event: DirectoryChangeEvent) => void> =
    new Set();
  private isInitialized = false;

  constructor() {
    this.store = new Store({
      name: 'directory-settings',
    });

    logger.info('Directory service initialized');
  }

  /**
   * Initialize the directory service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Directory service already initialized');
      return;
    }

    try {
      logger.info('Initializing directory service...');

      // Load saved directory from store
      const savedDirectory = this.store.get('rootDirectory') as
        | string
        | undefined;
      if (savedDirectory) {
        logger.info('Found saved root directory', { path: savedDirectory });
        await this.setRootDirectory(savedDirectory, false); // Don't save again
      }

      this.isInitialized = true;
      logger.info('Directory service initialization complete');
    } catch (error) {
      logger.error(
        'Failed to initialize directory service',
        undefined,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Show directory selection dialog
   */
  public async selectDirectory(
    parentWindow?: BrowserWindow,
  ): Promise<string | null> {
    logger.info('Opening directory selection dialog');

    try {
      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Select Photo Directory',
        message: 'Choose a directory containing your photos',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      };

      if (this.currentDirectory) {
        dialogOptions.defaultPath = this.currentDirectory;
      }

      const result = parentWindow
        ? await dialog.showOpenDialog(parentWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        logger.info('Directory selection canceled');
        return null;
      }

      const selectedPath = result.filePaths[0];
      if (!selectedPath) {
        logger.info('No directory path selected');
        return null;
      }

      logger.info('Directory selected', { path: selectedPath });

      // Validate the selected directory
      const info = await this.validateDirectory(selectedPath);
      if (!info.accessible) {
        throw new Error(`Directory is not accessible: ${selectedPath}`);
      }

      // Set as root directory
      await this.setRootDirectory(selectedPath);
      return selectedPath;
    } catch (error) {
      logger.error('Failed to select directory', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Set the root directory for photo management
   */
  public async setRootDirectory(
    directoryPath: string,
    save = true,
  ): Promise<void> {
    logger.info('Setting root directory', { path: directoryPath, save });

    try {
      // Validate directory
      const info = await this.validateDirectory(directoryPath);
      if (!info.exists) {
        throw new Error(`Directory does not exist: ${directoryPath}`);
      }
      if (!info.accessible) {
        throw new Error(`Directory is not accessible: ${directoryPath}`);
      }
      if (!info.isDirectory) {
        throw new Error(`Path is not a directory: ${directoryPath}`);
      }

      // Stop watching current directory
      await this.stopWatching();

      // Update current directory
      this.currentDirectory = directoryPath;

      // Save to store if requested
      if (save) {
        this.store.set('rootDirectory', directoryPath);
        logger.info('Root directory saved to store');
      }

      // Add/update in database
      const directoryRepo = getDirectoryRepository();
      await directoryRepo.upsert({
        path: directoryPath,
        is_scanned: false,
      });

      // Start watching new directory
      await this.startWatching();

      logger.info('Root directory set successfully');
    } catch (error) {
      logger.error('Failed to set root directory', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Get current root directory
   */
  public getCurrentDirectory(): string | null {
    return this.currentDirectory;
  }

  /**
   * Get directory information
   */
  public async getDirectoryInfo(
    directoryPath?: string,
  ): Promise<DirectoryInfo | null> {
    const targetPath = directoryPath || this.currentDirectory;
    if (!targetPath) {
      return null;
    }

    return this.validateDirectory(targetPath);
  }

  /**
   * Validate directory accessibility and permissions
   */
  public async validateDirectory(
    directoryPath: string,
  ): Promise<DirectoryInfo> {
    logger.debug('Validating directory', { path: directoryPath });

    const info: DirectoryInfo = {
      path: directoryPath,
      exists: false,
      accessible: false,
      isDirectory: false,
      lastChecked: new Date().toISOString(),
    };

    try {
      const stats = await fs.stat(directoryPath);
      info.exists = true;
      info.isDirectory = stats.isDirectory();

      if (info.isDirectory) {
        // Test read access
        try {
          await fs.access(directoryPath, fs.constants.R_OK);
          info.accessible = true;
        } catch {
          info.accessible = false;
        }

        // Test write access (optional, but good to know)
        try {
          await fs.access(directoryPath, fs.constants.W_OK);
        } catch {
          logger.warn('Directory is read-only', { path: directoryPath });
        }
      }
    } catch (error) {
      logger.debug('Directory validation failed', {
        path: directoryPath,
        error: (error as Error).message,
      });
    }

    return info;
  }

  /**
   * Get directory statistics
   */
  public async getDirectoryStats(
    directoryPath?: string,
  ): Promise<DirectoryStats | null> {
    const targetPath = directoryPath || this.currentDirectory;
    if (!targetPath) {
      return null;
    }

    logger.info('Calculating directory stats', { path: targetPath });

    try {
      const stats: DirectoryStats = {
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        imageFiles: 0,
      };

      await this.calculateStats(targetPath, stats);

      logger.info('Directory stats calculated', { path: targetPath, stats });
      return stats;
    } catch (error) {
      logger.error(
        'Failed to calculate directory stats',
        undefined,
        error as Error,
      );
      return null;
    }
  }

  /**
   * Start watching the current directory for changes
   */
  public async startWatching(): Promise<void> {
    if (!this.currentDirectory) {
      logger.debug('No directory to watch');
      return;
    }

    if (this.watcher) {
      logger.debug('Already watching directory');
      return;
    }

    logger.info('Starting directory watching', { path: this.currentDirectory });

    try {
      this.watcher = watch(this.currentDirectory, {
        ignored: [
          // Ignore system files and directories
          '**/node_modules/**',
          '**/.git/**',
          '**/Thumbs.db',
          '**/.DS_Store',
          '**/desktop.ini',
          // Ignore temporary files
          '**/*.tmp',
          '**/*.temp',
          '**/*~',
        ],
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100,
        },
      });

      // Set up event handlers
      this.watcher
        .on('add', (filePath, stats) => {
          const event: DirectoryChangeEvent = {
            type: 'add',
            path: filePath,
          };

          if (stats) {
            event.stats = {
              size: stats.size,
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              modified: stats.mtime,
            };
          }

          this.emitEvent(event);
        })
        .on('change', (filePath, stats) => {
          const event: DirectoryChangeEvent = {
            type: 'change',
            path: filePath,
          };

          if (stats) {
            event.stats = {
              size: stats.size,
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              modified: stats.mtime,
            };
          }

          this.emitEvent(event);
        })
        .on('unlink', filePath => {
          this.emitEvent({
            type: 'unlink',
            path: filePath,
          });
        })
        .on('addDir', (dirPath, stats) => {
          const event: DirectoryChangeEvent = {
            type: 'addDir',
            path: dirPath,
          };

          if (stats) {
            event.stats = {
              size: stats.size,
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              modified: stats.mtime,
            };
          }

          this.emitEvent(event);
        })
        .on('unlinkDir', dirPath => {
          this.emitEvent({
            type: 'unlinkDir',
            path: dirPath,
          });
        })
        .on('error', error => {
          logger.error('Directory watcher error', undefined, error as Error);
        });

      logger.info('Directory watching started successfully');
    } catch (error) {
      logger.error(
        'Failed to start directory watching',
        undefined,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Stop watching the current directory
   */
  public async stopWatching(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    logger.info('Stopping directory watching');

    try {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Directory watching stopped');
    } catch (error) {
      logger.error(
        'Error stopping directory watcher',
        undefined,
        error as Error,
      );
    }
  }

  /**
   * Subscribe to directory change events
   */
  public onDirectoryChange(
    callback: (event: DirectoryChangeEvent) => void,
  ): () => void {
    this.eventCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Check if directory service is watching
   */
  public isWatching(): boolean {
    return this.watcher !== null;
  }

  /**
   * Clear stored directory (reset to no directory selected)
   */
  public async clearDirectory(): Promise<void> {
    logger.info('Clearing stored directory');

    await this.stopWatching();
    this.currentDirectory = null;
    this.store.delete('rootDirectory');

    logger.info('Directory cleared successfully');
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up directory service');

    await this.stopWatching();
    this.eventCallbacks.clear();
    this.isInitialized = false;

    logger.info('Directory service cleanup complete');
  }

  // Private helper methods

  private emitEvent(event: DirectoryChangeEvent): void {
    logger.debug('Directory change event', {
      type: event.type,
      path: event.path,
    });

    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error(
          'Error in directory change callback',
          undefined,
          error as Error,
        );
      }
    }
  }

  private async calculateStats(
    dirPath: string,
    stats: DirectoryStats,
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          stats.totalDirectories++;
          // Recursively calculate subdirectory stats
          await this.calculateStats(fullPath, stats);
        } else if (entry.isFile()) {
          stats.totalFiles++;

          try {
            const fileStat = await fs.stat(fullPath);
            stats.totalSize += fileStat.size;

            // Check if it's an image file
            const ext = path.extname(entry.name).toLowerCase();
            if (this.isImageFile(ext)) {
              stats.imageFiles++;
            }
          } catch (error) {
            logger.debug('Could not stat file', {
              path: fullPath,
              error: (error as Error).message,
            });
          }
        }
      }
    } catch (error) {
      logger.debug('Could not read directory', {
        path: dirPath,
        error: (error as Error).message,
      });
    }
  }

  private isImageFile(extension: string): boolean {
    const imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.webp',
      '.tiff',
      '.tif',
      '.svg',
      '.ico',
      '.heic',
      '.heif',
      '.avif',
      '.raw',
      '.cr2',
      '.nef',
      '.arw',
      '.dng',
      '.orf',
      '.rw2',
      '.psd',
    ];
    return imageExtensions.includes(extension);
  }
}

// Singleton instance
let directoryService: DirectoryService | null = null;

/**
 * Get the directory service singleton
 */
export function getDirectoryService(): DirectoryService {
  if (!directoryService) {
    directoryService = new DirectoryService();
  }
  return directoryService;
}

/**
 * Initialize directory service (should be called during app startup)
 */
export async function initializeDirectoryService(): Promise<void> {
  const service = getDirectoryService();
  await service.initialize();
}

/**
 * Cleanup directory service (should be called during app shutdown)
 */
export async function cleanupDirectoryService(): Promise<void> {
  if (directoryService) {
    await directoryService.cleanup();
    directoryService = null;
  }
}

export { DirectoryService };
