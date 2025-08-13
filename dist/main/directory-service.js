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
exports.DirectoryService = void 0;
exports.getDirectoryService = getDirectoryService;
exports.destroyDirectoryService = destroyDirectoryService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const chokidar_1 = require("chokidar");
class DirectoryService {
    constructor() {
        this.watcher = null;
        this.currentRootPath = null;
        // Supported image extensions
        this.imageExtensions = new Set([
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
            '.webp', '.svg', '.ico', '.heic', '.heif', '.raw', '.dng'
        ]);
        // Event system (simple implementation)
        this.listeners = new Map();
        this.store = new electron_store_1.default({
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
    loadPersistedDirectory() {
        const savedPath = this.store.get('rootDirectory');
        if (savedPath && this.isValidDirectory(savedPath)) {
            this.currentRootPath = savedPath;
            this.startWatching();
        }
    }
    // Directory validation and access
    isValidDirectory(dirPath) {
        try {
            const stats = fs.statSync(dirPath);
            return stats.isDirectory() && this.hasReadAccess(dirPath);
        }
        catch {
            return false;
        }
    }
    hasReadAccess(dirPath) {
        try {
            fs.accessSync(dirPath, fs.constants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    // Root directory management
    setRootDirectory(dirPath) {
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
    getRootDirectory() {
        return this.currentRootPath;
    }
    getRootDirectoryInfo() {
        if (!this.currentRootPath) {
            return null;
        }
        try {
            const stats = fs.statSync(this.currentRootPath);
            return {
                path: this.currentRootPath,
                name: path.basename(this.currentRootPath),
                size: stats.size,
                lastAccessed: this.store.get('lastAccessed'),
                isValid: true
            };
        }
        catch {
            return {
                path: this.currentRootPath,
                name: path.basename(this.currentRootPath),
                isValid: false
            };
        }
    }
    clearRootDirectory() {
        this.stopWatching();
        this.currentRootPath = null;
        this.store.delete('rootDirectory');
    }
    // Directory scanning and analysis
    async scanDirectory(dirPath) {
        const targetPath = dirPath || this.currentRootPath;
        if (!targetPath || !this.isValidDirectory(targetPath)) {
            throw new Error('Invalid directory path');
        }
        const stats = {
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
    async scanDirectoryRecursive(dirPath, stats, depth) {
        const maxDepth = this.store.get('scanDepth');
        if (depth > maxDepth)
            return;
        const excludePatterns = this.store.get('excludePatterns');
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
                }
                else if (entry.isFile()) {
                    try {
                        const fileStats = await fs.promises.stat(fullPath);
                        stats.totalFiles++;
                        stats.totalSize += fileStats.size;
                        if (this.isImageFile(entry.name)) {
                            stats.imageFiles++;
                        }
                    }
                    catch {
                        // Skip files that can't be accessed
                    }
                }
            }
        }
        catch {
            // Skip directories that can't be accessed
        }
    }
    // File operations
    async getDirectoryContents(dirPath) {
        if (!this.isValidDirectory(dirPath)) {
            throw new Error('Invalid directory path');
        }
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const fileInfos = [];
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
                }
                catch {
                    // Skip files that can't be accessed
                }
            }
        }
        return fileInfos.sort((a, b) => a.name.localeCompare(b.name));
    }
    async getSubdirectories(dirPath) {
        if (!this.isValidDirectory(dirPath)) {
            throw new Error('Invalid directory path');
        }
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const subdirs = [];
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
    isImageFile(filename) {
        const extension = path.extname(filename).toLowerCase();
        return this.imageExtensions.has(extension);
    }
    // Directory watching
    startWatching() {
        if (!this.currentRootPath || this.watcher) {
            return;
        }
        const watchEnabled = this.store.get('watchEnabled');
        if (!watchEnabled) {
            return;
        }
        try {
            this.watcher = (0, chokidar_1.watch)(this.currentRootPath, {
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
        }
        catch (error) {
            console.error('Failed to start directory watcher:', error);
        }
    }
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('Stopped directory watching');
        }
    }
    isWatching() {
        return this.watcher !== null;
    }
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
    }
    off(event, listener) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }
    emit(event, ...args) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => {
                try {
                    listener(...args);
                }
                catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    // Preferences management
    setWatchEnabled(enabled) {
        this.store.set('watchEnabled', enabled);
        if (enabled && this.currentRootPath && !this.watcher) {
            this.startWatching();
        }
        else if (!enabled && this.watcher) {
            this.stopWatching();
        }
    }
    isWatchEnabled() {
        return this.store.get('watchEnabled');
    }
    setScanDepth(depth) {
        this.store.set('scanDepth', Math.max(1, Math.min(20, depth)));
    }
    getScanDepth() {
        return this.store.get('scanDepth');
    }
    setExcludePatterns(patterns) {
        this.store.set('excludePatterns', patterns);
    }
    getExcludePatterns() {
        return this.store.get('excludePatterns');
    }
    // Utility methods
    getLastScanStats() {
        return this.store.get('lastScanStats');
    }
    getRelativePath(fullPath) {
        if (!this.currentRootPath) {
            return fullPath;
        }
        return path.relative(this.currentRootPath, fullPath);
    }
    getFullPath(relativePath) {
        if (!this.currentRootPath) {
            throw new Error('No root directory set');
        }
        return path.join(this.currentRootPath, relativePath);
    }
    // Cleanup
    destroy() {
        this.stopWatching();
        this.listeners.clear();
    }
}
exports.DirectoryService = DirectoryService;
// Export singleton instance
let serviceInstance = null;
function getDirectoryService() {
    if (!serviceInstance) {
        serviceInstance = new DirectoryService();
    }
    return serviceInstance;
}
function destroyDirectoryService() {
    if (serviceInstance) {
        serviceInstance.destroy();
        serviceInstance = null;
    }
}
//# sourceMappingURL=directory-service.js.map