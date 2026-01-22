import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';

export interface TrashResult {
  filepath: string;
  success: boolean;
  error?: string;
}

export interface TrashBatchResult {
  successful: string[];
  failed: TrashResult[];
  totalProcessed: number;
}

export class TrashService {
  /**
   * Move a single file to the system trash
   * Uses Electron's shell.trashItem() for safe, recoverable deletion
   */
  async trashFile(filepath: string): Promise<TrashResult> {
    // Validate file exists
    if (!fs.existsSync(filepath)) {
      return {
        filepath,
        success: false,
        error: 'File not found'
      };
    }

    try {
      // shell.trashItem returns a Promise that resolves when the item is trashed
      await shell.trashItem(filepath);

      return {
        filepath,
        success: true
      };
    } catch (error) {
      return {
        filepath,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Move multiple files to the system trash
   */
  async trashFiles(
    filepaths: string[],
    onProgress?: (completed: number, total: number, current?: string) => void
  ): Promise<TrashBatchResult> {
    const successful: string[] = [];
    const failed: TrashResult[] = [];
    const total = filepaths.length;

    for (let i = 0; i < filepaths.length; i++) {
      const filepath = filepaths[i];

      if (onProgress) {
        onProgress(i + 1, total, filepath);
      }

      const result = await this.trashFile(filepath);

      if (result.success) {
        successful.push(filepath);
      } else {
        failed.push(result);
      }
    }

    return {
      successful,
      failed,
      totalProcessed: total
    };
  }

  /**
   * Move a directory to the system trash
   */
  async trashDirectory(dirPath: string): Promise<TrashResult> {
    // Validate directory exists
    if (!fs.existsSync(dirPath)) {
      return {
        filepath: dirPath,
        success: false,
        error: 'Directory not found'
      };
    }

    try {
      const stats = await fs.promises.stat(dirPath);
      if (!stats.isDirectory()) {
        return {
          filepath: dirPath,
          success: false,
          error: 'Path is not a directory'
        };
      }

      await shell.trashItem(dirPath);

      return {
        filepath: dirPath,
        success: true
      };
    } catch (error) {
      return {
        filepath: dirPath,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if a file can be trashed (exists and is accessible)
   */
  async canTrash(filepath: string): Promise<boolean> {
    try {
      await fs.promises.access(filepath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file info before trashing (for confirmation dialogs)
   */
  async getFileInfo(filepath: string): Promise<{
    exists: boolean;
    name: string;
    size?: number;
    isDirectory?: boolean;
  }> {
    if (!fs.existsSync(filepath)) {
      return {
        exists: false,
        name: path.basename(filepath)
      };
    }

    try {
      const stats = await fs.promises.stat(filepath);
      return {
        exists: true,
        name: path.basename(filepath),
        size: stats.size,
        isDirectory: stats.isDirectory()
      };
    } catch {
      return {
        exists: false,
        name: path.basename(filepath)
      };
    }
  }

  /**
   * Trash all files in a duplicate group except the first one (keep original)
   */
  async trashDuplicates(
    duplicateFiles: string[],
    keepIndex: number = 0,
    onProgress?: (completed: number, total: number) => void
  ): Promise<TrashBatchResult> {
    // Validate keepIndex
    if (keepIndex < 0 || keepIndex >= duplicateFiles.length) {
      throw new Error('Invalid keepIndex');
    }

    // Filter out the file to keep
    const filesToTrash = duplicateFiles.filter((_, index) => index !== keepIndex);

    return this.trashFiles(filesToTrash, onProgress);
  }

  /**
   * Calculate total size of files to be trashed
   */
  async calculateTotalSize(filepaths: string[]): Promise<number> {
    let totalSize = 0;

    for (const filepath of filepaths) {
      try {
        const stats = await fs.promises.stat(filepath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      } catch {
        // Skip files that can't be accessed
      }
    }

    return totalSize;
  }

  /**
   * Format file size for display
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  }
}

// Export singleton instance
let serviceInstance: TrashService | null = null;

export function getTrashService(): TrashService {
  if (!serviceInstance) {
    serviceInstance = new TrashService();
  }
  return serviceInstance;
}

export function destroyTrashService(): void {
  serviceInstance = null;
}
