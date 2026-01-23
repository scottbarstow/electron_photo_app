import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface HashResult {
  filepath: string;
  hash: string;
  algorithm: string;
  filesize: number;
}

export interface DuplicateGroup {
  hash: string;
  filesize: number;
  files: string[];
}

export class HashService {
  private readonly algorithm = 'sha256';
  private readonly chunkSize = 64 * 1024; // 64KB chunks for streaming

  /**
   * Compute hash of a single file
   */
  async hashFile(filepath: string): Promise<HashResult> {
    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    const stats = await fs.promises.stat(filepath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filepath}`);
    }

    const hash = await this.computeFileHash(filepath);

    return {
      filepath,
      hash,
      algorithm: this.algorithm,
      filesize: stats.size
    };
  }

  /**
   * Compute hash of multiple files in batch
   */
  async hashFiles(
    filepaths: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ results: HashResult[]; errors: Map<string, Error> }> {
    const results: HashResult[] = [];
    const errors = new Map<string, Error>();
    const total = filepaths.length;

    for (let i = 0; i < filepaths.length; i++) {
      const filepath = filepaths[i];

      try {
        const result = await this.hashFile(filepath);
        results.push(result);
      } catch (error) {
        errors.set(filepath, error instanceof Error ? error : new Error(String(error)));
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return { results, errors };
  }

  /**
   * Find duplicate files from a list of hash results
   */
  findDuplicates(hashResults: HashResult[]): DuplicateGroup[] {
    // Group files by hash
    const hashMap = new Map<string, HashResult[]>();

    for (const result of hashResults) {
      const existing = hashMap.get(result.hash) || [];
      existing.push(result);
      hashMap.set(result.hash, existing);
    }

    // Filter to only groups with duplicates (more than 1 file)
    const duplicates: DuplicateGroup[] = [];

    for (const [hash, results] of hashMap.entries()) {
      if (results.length > 1) {
        duplicates.push({
          hash,
          filesize: results[0].filesize,
          files: results.map(r => r.filepath)
        });
      }
    }

    // Sort by number of duplicates (most first)
    duplicates.sort((a, b) => b.files.length - a.files.length);

    return duplicates;
  }

  /**
   * Scan a directory for duplicate files
   */
  async scanDirectoryForDuplicates(
    dirPath: string,
    recursive: boolean = true,
    onProgress?: (completed: number, total: number, currentFile?: string) => void
  ): Promise<DuplicateGroup[]> {
    // Collect all files first
    const files = await this.collectFiles(dirPath, recursive);

    if (files.length === 0) {
      return [];
    }

    // Hash all files
    const { results } = await this.hashFiles(files, (completed, total) => {
      if (onProgress) {
        onProgress(completed, total, files[completed - 1]);
      }
    });

    // Find duplicates
    return this.findDuplicates(results);
  }

  /**
   * Check if two files are identical (same hash)
   */
  async areFilesIdentical(filepath1: string, filepath2: string): Promise<boolean> {
    // Quick check: different sizes = definitely different
    const stats1 = await fs.promises.stat(filepath1);
    const stats2 = await fs.promises.stat(filepath2);

    if (stats1.size !== stats2.size) {
      return false;
    }

    // Same size, compute hashes
    const hash1 = await this.computeFileHash(filepath1);
    const hash2 = await this.computeFileHash(filepath2);

    return hash1 === hash2;
  }

  /**
   * Compute a quick hash for pre-filtering (uses first and last chunks)
   * Useful for quickly eliminating non-duplicates before full hash
   */
  async computeQuickHash(filepath: string): Promise<string> {
    const stats = await fs.promises.stat(filepath);
    const fileSize = stats.size;

    if (fileSize === 0) {
      return 'empty';
    }

    const hash = crypto.createHash(this.algorithm);

    // Include file size in hash for additional uniqueness
    hash.update(Buffer.from(fileSize.toString()));

    // Read first chunk
    const fd = await fs.promises.open(filepath, 'r');
    try {
      const firstChunk = Buffer.alloc(Math.min(this.chunkSize, fileSize));
      await fd.read(firstChunk, 0, firstChunk.length, 0);
      hash.update(firstChunk);

      // Read last chunk if file is large enough
      if (fileSize > this.chunkSize * 2) {
        const lastChunk = Buffer.alloc(this.chunkSize);
        await fd.read(lastChunk, 0, this.chunkSize, fileSize - this.chunkSize);
        hash.update(lastChunk);
      }
    } finally {
      await fd.close();
    }

    return hash.digest('hex');
  }

  /**
   * Two-phase duplicate detection (fast pre-filter + full hash)
   * More efficient for large directories
   */
  async findDuplicatesTwoPhase(
    filepaths: string[],
    onProgress?: (phase: string, completed: number, total: number) => void
  ): Promise<DuplicateGroup[]> {
    // Phase 1: Quick hash to find potential duplicates
    const quickHashes = new Map<string, string[]>();
    const total = filepaths.length;

    for (let i = 0; i < filepaths.length; i++) {
      const filepath = filepaths[i];
      try {
        const quickHash = await this.computeQuickHash(filepath);
        const existing = quickHashes.get(quickHash) || [];
        existing.push(filepath);
        quickHashes.set(quickHash, existing);
      } catch {
        // Skip files that can't be read
      }

      if (onProgress) {
        onProgress('Quick scan', i + 1, total);
      }
    }

    // Collect files that might be duplicates (same quick hash)
    const potentialDuplicates: string[] = [];
    for (const files of quickHashes.values()) {
      if (files.length > 1) {
        potentialDuplicates.push(...files);
      }
    }

    if (potentialDuplicates.length === 0) {
      return [];
    }

    // Phase 2: Full hash only for potential duplicates
    const results: HashResult[] = [];
    for (let i = 0; i < potentialDuplicates.length; i++) {
      const filepath = potentialDuplicates[i];
      try {
        const result = await this.hashFile(filepath);
        results.push(result);
      } catch {
        // Skip files that can't be hashed
      }

      if (onProgress) {
        onProgress('Full hash', i + 1, potentialDuplicates.length);
      }
    }

    return this.findDuplicates(results);
  }

  /**
   * Compute full file hash using streaming (memory efficient)
   */
  private computeFileHash(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(this.algorithm);
      const stream = fs.createReadStream(filepath, {
        highWaterMark: this.chunkSize
      });

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Collect all files in a directory
   */
  private async collectFiles(
    dirPath: string,
    recursive: boolean
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files/folders
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          files.push(fullPath);
        } else if (recursive && entry.isDirectory()) {
          const subFiles = await this.collectFiles(fullPath, true);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Get hash algorithm being used
   */
  getAlgorithm(): string {
    return this.algorithm;
  }

  /**
   * Calculate total size of duplicate files (space that could be saved)
   */
  calculateDuplicateSpace(duplicates: DuplicateGroup[]): {
    totalWastedBytes: number;
    totalGroups: number;
    totalDuplicateFiles: number;
  } {
    let totalWastedBytes = 0;
    let totalDuplicateFiles = 0;

    for (const group of duplicates) {
      // All files except one are "wasted" space
      const wastedCopies = group.files.length - 1;
      totalWastedBytes += group.filesize * wastedCopies;
      totalDuplicateFiles += wastedCopies;
    }

    return {
      totalWastedBytes,
      totalGroups: duplicates.length,
      totalDuplicateFiles
    };
  }
}

// Export singleton instance
let serviceInstance: HashService | null = null;

export function getHashService(): HashService {
  if (!serviceInstance) {
    serviceInstance = new HashService();
  }
  return serviceInstance;
}

export function destroyHashService(): void {
  serviceInstance = null;
}
