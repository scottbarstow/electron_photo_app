"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailService = void 0;
exports.getThumbnailService = getThumbnailService;
exports.destroyThumbnailService = destroyThumbnailService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const electron_1 = require("electron");
const sharp_1 = __importDefault(require("sharp"));
class ThumbnailService {
    constructor() {
        this.defaultOptions = {
            width: 200,
            height: 200,
            quality: 80,
            fit: 'cover'
        };
        // Supported image formats for thumbnail generation
        this.supportedExtensions = new Set([
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
            '.webp', '.heic', '.heif'
        ]);
        // Initialize cache directory in user data folder
        this.cacheDir = path.join(electron_1.app.getPath('userData'), 'thumbnails');
        this.ensureCacheDirectory();
    }
    ensureCacheDirectory() {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Failed to create thumbnail cache directory:', error);
        }
    }
    /**
     * Generate a unique cache key for an image path
     * Uses SHA-256 hash of the file path for consistent naming
     */
    getCacheKey(imagePath) {
        const hash = crypto.createHash('sha256');
        hash.update(imagePath);
        return hash.digest('hex');
    }
    /**
     * Get the thumbnail file path for a given image
     */
    getThumbnailPath(imagePath) {
        const cacheKey = this.getCacheKey(imagePath);
        return path.join(this.cacheDir, `${cacheKey}.jpg`);
    }
    /**
     * Check if an image format is supported for thumbnail generation
     */
    isSupported(imagePath) {
        const extension = path.extname(imagePath).toLowerCase();
        return this.supportedExtensions.has(extension);
    }
    /**
     * Check if a thumbnail already exists for the given image
     */
    thumbnailExists(imagePath) {
        const thumbnailPath = this.getThumbnailPath(imagePath);
        return fs.existsSync(thumbnailPath);
    }
    /**
     * Get thumbnail for an image, generating it if necessary
     */
    async getThumbnail(imagePath, options) {
        // Check if thumbnail already exists
        if (this.thumbnailExists(imagePath)) {
            const thumbnailPath = this.getThumbnailPath(imagePath);
            const stats = await fs.promises.stat(thumbnailPath);
            const metadata = await (0, sharp_1.default)(thumbnailPath).metadata();
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
    async generateThumbnail(imagePath, options) {
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
            const image = (0, sharp_1.default)(imagePath);
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
            const metadata = await (0, sharp_1.default)(thumbnailPath).metadata();
            return {
                thumbnailPath,
                originalPath: imagePath,
                width: metadata.width || opts.width,
                height: metadata.height || opts.height,
                size: stats.size,
                cached: false
            };
        }
        catch (error) {
            // Clean up partial file if it exists
            try {
                if (fs.existsSync(thumbnailPath)) {
                    await fs.promises.unlink(thumbnailPath);
                }
            }
            catch {
                // Ignore cleanup errors
            }
            throw new Error(`Failed to generate thumbnail for ${imagePath}: ${error}`);
        }
    }
    /**
     * Generate thumbnails for multiple images in batch
     * Returns results for successfully generated thumbnails and errors for failures
     */
    async generateBatch(imagePaths, options, onProgress) {
        const results = [];
        const errors = new Map();
        const total = imagePaths.length;
        for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            try {
                const result = await this.getThumbnail(imagePath, options);
                results.push(result);
            }
            catch (error) {
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
    async deleteThumbnail(imagePath) {
        const thumbnailPath = this.getThumbnailPath(imagePath);
        try {
            if (fs.existsSync(thumbnailPath)) {
                await fs.promises.unlink(thumbnailPath);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`Failed to delete thumbnail for ${imagePath}:`, error);
            return false;
        }
    }
    /**
     * Clear all thumbnails from the cache
     */
    async clearCache() {
        let deleted = 0;
        let errors = 0;
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.jpg')) {
                    try {
                        await fs.promises.unlink(path.join(this.cacheDir, file));
                        deleted++;
                    }
                    catch {
                        errors++;
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to clear thumbnail cache:', error);
        }
        return { deleted, errors };
    }
    /**
     * Get the total size of the thumbnail cache in bytes
     */
    async getCacheSize() {
        let totalSize = 0;
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.jpg')) {
                    try {
                        const stats = await fs.promises.stat(path.join(this.cacheDir, file));
                        totalSize += stats.size;
                    }
                    catch {
                        // Skip files that can't be accessed
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to calculate cache size:', error);
        }
        return totalSize;
    }
    /**
     * Get the number of cached thumbnails
     */
    async getCacheCount() {
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            return files.filter(f => f.endsWith('.jpg')).length;
        }
        catch {
            return 0;
        }
    }
    /**
     * Get the thumbnail as a base64-encoded data URL
     * Useful for displaying in the renderer process without file:// protocol
     */
    async getThumbnailAsDataUrl(imagePath) {
        const result = await this.getThumbnail(imagePath);
        const buffer = await fs.promises.readFile(result.thumbnailPath);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    /**
     * Get the cache directory path
     */
    getCacheDirectory() {
        return this.cacheDir;
    }
    /**
     * Clean up orphaned thumbnails (thumbnails for images that no longer exist)
     */
    async cleanupOrphanedThumbnails(validImagePaths) {
        let deleted = 0;
        let errors = 0;
        // Create a set of valid cache keys for quick lookup
        const validCacheKeys = new Set(validImagePaths.map(p => this.getCacheKey(p)));
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.jpg')) {
                    const cacheKey = file.replace('.jpg', '');
                    if (!validCacheKeys.has(cacheKey)) {
                        try {
                            await fs.promises.unlink(path.join(this.cacheDir, file));
                            deleted++;
                        }
                        catch {
                            errors++;
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to cleanup orphaned thumbnails:', error);
        }
        return { deleted, errors };
    }
}
exports.ThumbnailService = ThumbnailService;
// Export singleton instance
let serviceInstance = null;
function getThumbnailService() {
    if (!serviceInstance) {
        serviceInstance = new ThumbnailService();
    }
    return serviceInstance;
}
function destroyThumbnailService() {
    serviceInstance = null;
}
//# sourceMappingURL=thumbnail-service.js.map