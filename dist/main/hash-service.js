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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashService = void 0;
exports.getHashService = getHashService;
exports.destroyHashService = destroyHashService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class HashService {
    constructor() {
        this.algorithm = 'sha256';
        this.chunkSize = 64 * 1024; // 64KB chunks for streaming
    }
    /**
     * Compute hash of a single file
     */
    async hashFile(filepath) {
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
    async hashFiles(filepaths, onProgress) {
        const results = [];
        const errors = new Map();
        const total = filepaths.length;
        for (let i = 0; i < filepaths.length; i++) {
            const filepath = filepaths[i];
            try {
                const result = await this.hashFile(filepath);
                results.push(result);
            }
            catch (error) {
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
    findDuplicates(hashResults) {
        // Group files by hash
        const hashMap = new Map();
        for (const result of hashResults) {
            const existing = hashMap.get(result.hash) || [];
            existing.push(result);
            hashMap.set(result.hash, existing);
        }
        // Filter to only groups with duplicates (more than 1 file)
        const duplicates = [];
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
    async scanDirectoryForDuplicates(dirPath, recursive = true, onProgress) {
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
    async areFilesIdentical(filepath1, filepath2) {
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
    async computeQuickHash(filepath) {
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
        }
        finally {
            await fd.close();
        }
        return hash.digest('hex');
    }
    /**
     * Two-phase duplicate detection (fast pre-filter + full hash)
     * More efficient for large directories
     */
    async findDuplicatesTwoPhase(filepaths, onProgress) {
        // Phase 1: Quick hash to find potential duplicates
        const quickHashes = new Map();
        const total = filepaths.length;
        for (let i = 0; i < filepaths.length; i++) {
            const filepath = filepaths[i];
            try {
                const quickHash = await this.computeQuickHash(filepath);
                const existing = quickHashes.get(quickHash) || [];
                existing.push(filepath);
                quickHashes.set(quickHash, existing);
            }
            catch {
                // Skip files that can't be read
            }
            if (onProgress) {
                onProgress('Quick scan', i + 1, total);
            }
        }
        // Collect files that might be duplicates (same quick hash)
        const potentialDuplicates = [];
        for (const files of quickHashes.values()) {
            if (files.length > 1) {
                potentialDuplicates.push(...files);
            }
        }
        if (potentialDuplicates.length === 0) {
            return [];
        }
        // Phase 2: Full hash only for potential duplicates
        const results = [];
        for (let i = 0; i < potentialDuplicates.length; i++) {
            const filepath = potentialDuplicates[i];
            try {
                const result = await this.hashFile(filepath);
                results.push(result);
            }
            catch {
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
    computeFileHash(filepath) {
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
    async collectFiles(dirPath, recursive) {
        const files = [];
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
                }
                else if (recursive && entry.isDirectory()) {
                    const subFiles = await this.collectFiles(fullPath, true);
                    files.push(...subFiles);
                }
            }
        }
        catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
        return files;
    }
    /**
     * Get hash algorithm being used
     */
    getAlgorithm() {
        return this.algorithm;
    }
    /**
     * Calculate total size of duplicate files (space that could be saved)
     */
    calculateDuplicateSpace(duplicates) {
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
exports.HashService = HashService;
// Export singleton instance
let serviceInstance = null;
function getHashService() {
    if (!serviceInstance) {
        serviceInstance = new HashService();
    }
    return serviceInstance;
}
function destroyHashService() {
    serviceInstance = null;
}
//# sourceMappingURL=hash-service.js.map