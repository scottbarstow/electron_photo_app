import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import sharp from 'sharp';

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ThumbnailResult {
  thumbnailPath: string;
  originalPath: string;
  width: number;
  height: number;
  size: number;
  cached: boolean;
}

export class ThumbnailService {
  private cacheDir: string;
  private readonly defaultOptions: Required<ThumbnailOptions> = {
    width: 200,
    height: 200,
    quality: 80,
    fit: 'cover'
  };

  // Supported image formats for thumbnail generation
  private readonly supportedExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
    '.webp', '.heic', '.heif'
  ]);

  constructor() {
    // Initialize cache directory in user data folder
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnails');
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create thumbnail cache directory:', error);
    }
  }

  /**
   * Generate a unique cache key for an image path
   * Uses SHA-256 hash of the file path for consistent naming
   */
  private getCacheKey(imagePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(imagePath);
    return hash.digest('hex');
  }

  /**
   * Get the thumbnail file path for a given image
   */
  private getThumbnailPath(imagePath: string): string {
    const cacheKey = this.getCacheKey(imagePath);
    return path.join(this.cacheDir, `${cacheKey}.jpg`);
  }

  /**
   * Check if an image format is supported for thumbnail generation
   */
  isSupported(imagePath: string): boolean {
    const extension = path.extname(imagePath).toLowerCase();
    return this.supportedExtensions.has(extension);
  }

  /**
   * Check if a thumbnail already exists for the given image
   */
  thumbnailExists(imagePath: string): boolean {
    const thumbnailPath = this.getThumbnailPath(imagePath);
    return fs.existsSync(thumbnailPath);
  }

  /**
   * Get thumbnail for an image, generating it if necessary
   */
  async getThumbnail(
    imagePath: string,
    options?: ThumbnailOptions
  ): Promise<ThumbnailResult> {
    // Check if thumbnail already exists
    if (this.thumbnailExists(imagePath)) {
      const thumbnailPath = this.getThumbnailPath(imagePath);
      const stats = await fs.promises.stat(thumbnailPath);
      const metadata = await sharp(thumbnailPath).metadata();

      return {
        thumbnailPath,
        originalPath: imagePath,
        width: metadata.width || this.defaultOptions.width,
        height: metadata.height || this.defaultOptions.height,
        size: stats.size,
        cached: true
      };
    }

    // Generate new thumbnail
    return this.generateThumbnail(imagePath, options);
  }

  /**
   * Generate a thumbnail for the specified image
   */
  async generateThumbnail(
    imagePath: string,
    options?: ThumbnailOptions
  ): Promise<ThumbnailResult> {
    // Validate input file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Validate format is supported
    if (!this.isSupported(imagePath)) {
      throw new Error(`Unsupported image format: ${path.extname(imagePath)}`);
    }

    const opts = { ...this.defaultOptions, ...options };
    const thumbnailPath = this.getThumbnailPath(imagePath);

    try {
      // Read the image and generate thumbnail
      // Sharp automatically handles HEIC/HEIF conversion
      const image = sharp(imagePath);

      // Resize and convert to JPEG
      await image
        .resize(opts.width, opts.height, {
          fit: opts.fit,
          withoutEnlargement: true,
          position: 'centre'
        })
        .jpeg({ quality: opts.quality })
        .toFile(thumbnailPath);

      // Get resulting file stats and metadata
      const stats = await fs.promises.stat(thumbnailPath);
      const metadata = await sharp(thumbnailPath).metadata();

      return {
        thumbnailPath,
        originalPath: imagePath,
        width: metadata.width || opts.width,
        height: metadata.height || opts.height,
        size: stats.size,
        cached: false
      };
    } catch (error) {
      // Clean up partial file if it exists
      try {
        if (fs.existsSync(thumbnailPath)) {
          await fs.promises.unlink(thumbnailPath);
        }
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(`Failed to generate thumbnail for ${imagePath}: ${error}`);
    }
  }

  /**
   * Generate thumbnails for multiple images in batch
   * Returns results for successfully generated thumbnails and errors for failures
   */
  async generateBatch(
    imagePaths: string[],
    options?: ThumbnailOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ results: ThumbnailResult[]; errors: Map<string, Error> }> {
    const results: ThumbnailResult[] = [];
    const errors = new Map<string, Error>();
    const total = imagePaths.length;

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      try {
        const result = await this.getThumbnail(imagePath, options);
        results.push(result);
      } catch (error) {
        errors.set(imagePath, error instanceof Error ? error : new Error(String(error)));
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return { results, errors };
  }

  /**
   * Delete a specific thumbnail from the cache
   */
  async deleteThumbnail(imagePath: string): Promise<boolean> {
    const thumbnailPath = this.getThumbnailPath(imagePath);

    try {
      if (fs.existsSync(thumbnailPath)) {
        await fs.promises.unlink(thumbnailPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete thumbnail for ${imagePath}:`, error);
      return false;
    }
  }

  /**
   * Clear all thumbnails from the cache
   */
  async clearCache(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      const files = await fs.promises.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          try {
            await fs.promises.unlink(path.join(this.cacheDir, file));
            deleted++;
          } catch {
            errors++;
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear thumbnail cache:', error);
    }

    return { deleted, errors };
  }

  /**
   * Get the total size of the thumbnail cache in bytes
   */
  async getCacheSize(): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.promises.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          try {
            const stats = await fs.promises.stat(path.join(this.cacheDir, file));
            totalSize += stats.size;
          } catch {
            // Skip files that can't be accessed
          }
        }
      }
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
    }

    return totalSize;
  }

  /**
   * Get the number of cached thumbnails
   */
  async getCacheCount(): Promise<number> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      return files.filter(f => f.endsWith('.jpg')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get the thumbnail as a base64-encoded data URL
   * Useful for displaying in the renderer process without file:// protocol
   */
  async getThumbnailAsDataUrl(imagePath: string): Promise<string> {
    const result = await this.getThumbnail(imagePath);
    const buffer = await fs.promises.readFile(result.thumbnailPath);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  /**
   * Get the cache directory path
   */
  getCacheDirectory(): string {
    return this.cacheDir;
  }

  /**
   * Clean up orphaned thumbnails (thumbnails for images that no longer exist)
   */
  async cleanupOrphanedThumbnails(
    validImagePaths: string[]
  ): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    // Create a set of valid cache keys for quick lookup
    const validCacheKeys = new Set(
      validImagePaths.map(p => this.getCacheKey(p))
    );

    try {
      const files = await fs.promises.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          const cacheKey = file.replace('.jpg', '');

          if (!validCacheKeys.has(cacheKey)) {
            try {
              await fs.promises.unlink(path.join(this.cacheDir, file));
              deleted++;
            } catch {
              errors++;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned thumbnails:', error);
    }

    return { deleted, errors };
  }
}

// Export singleton instance
let serviceInstance: ThumbnailService | null = null;

export function getThumbnailService(): ThumbnailService {
  if (!serviceInstance) {
    serviceInstance = new ThumbnailService();
  }
  return serviceInstance;
}

export function destroyThumbnailService(): void {
  serviceInstance = null;
}
