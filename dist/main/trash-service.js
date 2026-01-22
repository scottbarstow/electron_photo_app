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
exports.TrashService = void 0;
exports.getTrashService = getTrashService;
exports.destroyTrashService = destroyTrashService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
class TrashService {
    /**
     * Move a single file to the system trash
     * Uses Electron's shell.trashItem() for safe, recoverable deletion
     */
    async trashFile(filepath) {
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
            await electron_1.shell.trashItem(filepath);
            return {
                filepath,
                success: true
            };
        }
        catch (error) {
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
    async trashFiles(filepaths, onProgress) {
        const successful = [];
        const failed = [];
        const total = filepaths.length;
        for (let i = 0; i < filepaths.length; i++) {
            const filepath = filepaths[i];
            if (onProgress) {
                onProgress(i + 1, total, filepath);
            }
            const result = await this.trashFile(filepath);
            if (result.success) {
                successful.push(filepath);
            }
            else {
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
    async trashDirectory(dirPath) {
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
            await electron_1.shell.trashItem(dirPath);
            return {
                filepath: dirPath,
                success: true
            };
        }
        catch (error) {
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
    async canTrash(filepath) {
        try {
            await fs.promises.access(filepath, fs.constants.R_OK | fs.constants.W_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get file info before trashing (for confirmation dialogs)
     */
    async getFileInfo(filepath) {
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
        }
        catch {
            return {
                exists: false,
                name: path.basename(filepath)
            };
        }
    }
    /**
     * Trash all files in a duplicate group except the first one (keep original)
     */
    async trashDuplicates(duplicateFiles, keepIndex = 0, onProgress) {
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
    async calculateTotalSize(filepaths) {
        let totalSize = 0;
        for (const filepath of filepaths) {
            try {
                const stats = await fs.promises.stat(filepath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            }
            catch {
                // Skip files that can't be accessed
            }
        }
        return totalSize;
    }
    /**
     * Format file size for display
     */
    formatSize(bytes) {
        if (bytes === 0)
            return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
    }
}
exports.TrashService = TrashService;
// Export singleton instance
let serviceInstance = null;
function getTrashService() {
    if (!serviceInstance) {
        serviceInstance = new TrashService();
    }
    return serviceInstance;
}
function destroyTrashService() {
    serviceInstance = null;
}
//# sourceMappingURL=trash-service.js.map