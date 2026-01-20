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
        this.directoryTreeCache = new Map();
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
            return stats.isDirectory() && this.hasReadAccess(dirPath) && this.isPathSafe(dirPath);
        }
        catch {
            return false;
        }
    }
    isPathSafe(targetPath) {
        if (!this.currentRootPath) {
            return true; // Allow any path if no root is set
        }
        try {
            // Resolve paths to prevent directory traversal
            const resolvedTarget = path.resolve(targetPath);
            const resolvedRoot = path.resolve(this.currentRootPath);
            // Ensure target is within or equal to root directory
            return resolvedTarget.startsWith(resolvedRoot);
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
        this.clearDirectoryTreeCache();
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
    // Directory tree operations
    async getDirectoryTree(dirPath, maxDepth = 3) {
        const targetPath = dirPath || this.currentRootPath;
        if (!targetPath || !this.isValidDirectory(targetPath)) {
            throw new Error('Invalid directory path');
        }
        // Check cache first
        const cacheKey = `${targetPath}:${maxDepth}`;
        if (this.directoryTreeCache.has(cacheKey)) {
            return this.directoryTreeCache.get(cacheKey);
        }
        const rootNode = await this.buildDirectoryTreeRecursive(targetPath, 0, maxDepth);
        const tree = rootNode ? [rootNode] : [];
        // Cache the result
        this.directoryTreeCache.set(cacheKey, tree);
        return tree;
    }
    async buildDirectoryTreeRecursive(dirPath, currentDepth, maxDepth, parent) {
        if (currentDepth > maxDepth || !this.isValidDirectory(dirPath)) {
            return null;
        }
        const excludePatterns = this.store.get('excludePatterns');
        const name = path.basename(dirPath);
        // Skip excluded directories
        if (excludePatterns.some(pattern => name.includes(pattern))) {
            return null;
        }
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const children = [];
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
                        const childNode = await this.buildDirectoryTreeRecursive(fullPath, currentDepth + 1, maxDepth, dirPath);
                        if (childNode) {
                            children.push(childNode);
                            if (childNode.hasImages) {
                                hasImages = true;
                                imageCount += childNode.imageCount || 0;
                            }
                        }
                    }
                    else {
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
                }
                else if (entry.isFile() && this.isImageFile(entry.name)) {
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
        }
        catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return null;
        }
    }
    async expandDirectoryNode(dirPath, maxDepth = 2) {
        if (!this.isValidDirectory(dirPath)) {
            throw new Error('Invalid directory path');
        }
        return await this.getDirectoryTree(dirPath, maxDepth);
    }
    async hasImagesInDirectory(dirPath, maxDepth = 1) {
        if (!this.isValidDirectory(dirPath) || maxDepth <= 0) {
            return false;
        }
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const excludePatterns = this.store.get('excludePatterns');
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
        }
        catch {
            return false;
        }
    }
    async getDirectoryImageCount(dirPath, recursive = false) {
        if (!this.isValidDirectory(dirPath)) {
            return 0;
        }
        let count = 0;
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const excludePatterns = this.store.get('excludePatterns');
            for (const entry of entries) {
                if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
                    continue;
                }
                if (entry.isFile() && this.isImageFile(entry.name)) {
                    count++;
                }
                else if (recursive && entry.isDirectory()) {
                    const fullPath = path.join(dirPath, entry.name);
                    count += await this.getDirectoryImageCount(fullPath, true);
                }
            }
        }
        catch {
            // Return 0 if directory can't be read
        }
        return count;
    }
    clearDirectoryTreeCache() {
        this.directoryTreeCache.clear();
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