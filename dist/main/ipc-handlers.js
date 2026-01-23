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
exports.setupIpcHandlers = setupIpcHandlers;
exports.setupDirectoryEventForwarding = setupDirectoryEventForwarding;
exports.removeIpcHandlers = removeIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
const directory_service_1 = require("./directory-service");
const thumbnail_service_1 = require("./thumbnail-service");
const exif_service_1 = require("./exif-service");
const hash_service_1 = require("./hash-service");
const trash_service_1 = require("./trash-service");
const path = __importStar(require("path"));
// Helper function to create standardized responses
function createResponse(success, data, error) {
    return { success, data, error };
}
// Helper function to handle async IPC calls with error handling
async function handleAsyncIpc(handler) {
    try {
        const result = await handler();
        return createResponse(true, result);
    }
    catch (error) {
        console.error('IPC handler error:', error);
        return createResponse(false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
}
// Helper function to handle sync IPC calls with error handling
function handleSyncIpc(handler) {
    try {
        const result = handler();
        return createResponse(true, result);
    }
    catch (error) {
        console.error('IPC handler error:', error);
        return createResponse(false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
}
// Security: Validate that a file path is within the configured root directory
function isFilePathAllowed(filepath) {
    const directoryService = (0, directory_service_1.getDirectoryService)();
    const rootPath = directoryService.getRootDirectory();
    if (!rootPath) {
        return false; // No root configured = deny all file access
    }
    try {
        const resolvedPath = path.resolve(filepath);
        const resolvedRoot = path.resolve(rootPath);
        // Ensure the path is within the root directory
        return resolvedPath === resolvedRoot ||
            resolvedPath.startsWith(resolvedRoot + path.sep);
    }
    catch {
        return false;
    }
}
// Validate multiple file paths
function areFilePathsAllowed(filepaths) {
    return filepaths.every(fp => isFilePathAllowed(fp));
}
function setupIpcHandlers() {
    // Dialog handlers
    electron_1.ipcMain.handle('dialog:openFile', async () => {
        return handleAsyncIpc(async () => {
            const result = await electron_1.dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            if (result.canceled) {
                return null;
            }
            return result.filePaths[0];
        });
    });
    electron_1.ipcMain.handle('dialog:openDirectory', async () => {
        return handleAsyncIpc(async () => {
            const result = await electron_1.dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (result.canceled) {
                return null;
            }
            return result.filePaths[0];
        });
    });
    // Directory service handlers
    electron_1.ipcMain.handle('directory:setRoot', async (event, dirPath) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            const success = directoryService.setRootDirectory(dirPath);
            if (!success) {
                throw new Error('Failed to set root directory. Path may be invalid or inaccessible.');
            }
            return directoryService.getRootDirectoryInfo();
        });
    });
    electron_1.ipcMain.handle('directory:getRoot', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.getRootDirectoryInfo();
        });
    });
    electron_1.ipcMain.handle('directory:clearRoot', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.clearRootDirectory();
            return true;
        });
    });
    electron_1.ipcMain.handle('directory:scan', async (event, dirPath) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.scanDirectory(dirPath);
        });
    });
    electron_1.ipcMain.handle('directory:getContents', async (event, dirPath) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.getDirectoryContents(dirPath);
        });
    });
    electron_1.ipcMain.handle('directory:getSubdirectories', async (event, dirPath) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.getSubdirectories(dirPath);
        });
    });
    electron_1.ipcMain.handle('directory:isValid', async (event, dirPath) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.isValidDirectory(dirPath);
        });
    });
    electron_1.ipcMain.handle('directory:isImageFile', async (event, filename) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.isImageFile(filename);
        });
    });
    // Directory tree handlers
    electron_1.ipcMain.handle('directory:getTree', async (event, dirPath, maxDepth) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.getDirectoryTree(dirPath, maxDepth);
        });
    });
    electron_1.ipcMain.handle('directory:expandNode', async (event, dirPath, maxDepth) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.expandDirectoryNode(dirPath, maxDepth);
        });
    });
    electron_1.ipcMain.handle('directory:hasImages', async (event, dirPath, maxDepth) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.hasImagesInDirectory(dirPath, maxDepth);
        });
    });
    electron_1.ipcMain.handle('directory:getImageCount', async (event, dirPath, recursive) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return await directoryService.getDirectoryImageCount(dirPath, recursive);
        });
    });
    electron_1.ipcMain.handle('directory:clearTreeCache', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.clearDirectoryTreeCache();
            return true;
        });
    });
    // Directory watching handlers
    electron_1.ipcMain.handle('directory:startWatching', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.startWatching();
            return directoryService.isWatching();
        });
    });
    electron_1.ipcMain.handle('directory:stopWatching', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.stopWatching();
            return !directoryService.isWatching();
        });
    });
    electron_1.ipcMain.handle('directory:isWatching', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.isWatching();
        });
    });
    // Directory preferences handlers
    electron_1.ipcMain.handle('directory:setWatchEnabled', async (event, enabled) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.setWatchEnabled(enabled);
            return enabled;
        });
    });
    electron_1.ipcMain.handle('directory:isWatchEnabled', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.isWatchEnabled();
        });
    });
    electron_1.ipcMain.handle('directory:setScanDepth', async (event, depth) => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            directoryService.setScanDepth(depth);
            return directoryService.getScanDepth();
        });
    });
    electron_1.ipcMain.handle('directory:getScanDepth', async () => {
        return handleAsyncIpc(async () => {
            const directoryService = (0, directory_service_1.getDirectoryService)();
            return directoryService.getScanDepth();
        });
    });
    // Database handlers - Images
    electron_1.ipcMain.handle('database:insertImage', async (event, image) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.insertImage(image);
        });
    });
    electron_1.ipcMain.handle('database:updateImage', async (event, id, updates) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.updateImage(id, updates);
            return true;
        });
    });
    electron_1.ipcMain.handle('database:getImage', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImage(id);
        });
    });
    electron_1.ipcMain.handle('database:getImageByPath', async (event, path) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImageByPath(path);
        });
    });
    electron_1.ipcMain.handle('database:getImagesByHash', async (event, hash) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImagesByHash(hash);
        });
    });
    electron_1.ipcMain.handle('database:getAllImages', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAllImages();
        });
    });
    electron_1.ipcMain.handle('database:deleteImage', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.deleteImage(id);
            return true;
        });
    });
    // Database handlers - Duplicate Groups
    electron_1.ipcMain.handle('database:insertDuplicateGroup', async (event, group) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.insertDuplicateGroup(group);
        });
    });
    electron_1.ipcMain.handle('database:updateDuplicateGroup', async (event, id, updates) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.updateDuplicateGroup(id, updates);
            return true;
        });
    });
    electron_1.ipcMain.handle('database:getDuplicateGroup', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getDuplicateGroup(id);
        });
    });
    electron_1.ipcMain.handle('database:getDuplicateGroupByHash', async (event, hash) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getDuplicateGroupByHash(hash);
        });
    });
    electron_1.ipcMain.handle('database:getAllDuplicateGroups', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAllDuplicateGroups();
        });
    });
    electron_1.ipcMain.handle('database:deleteDuplicateGroup', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.deleteDuplicateGroup(id);
            return true;
        });
    });
    // Database handlers - Preferences
    electron_1.ipcMain.handle('database:setPreference', async (event, key, value) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.setPreference(key, value);
            return true;
        });
    });
    electron_1.ipcMain.handle('database:getPreference', async (event, key) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getPreference(key);
        });
    });
    electron_1.ipcMain.handle('database:getAllPreferences', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAllPreferences();
        });
    });
    electron_1.ipcMain.handle('database:deletePreference', async (event, key) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.deletePreference(key);
            return true;
        });
    });
    // Database handlers - Statistics
    electron_1.ipcMain.handle('database:getImageCount', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImageCount();
        });
    });
    electron_1.ipcMain.handle('database:getDuplicateCount', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getDuplicateCount();
        });
    });
    // Database handlers - Images by directory
    electron_1.ipcMain.handle('database:getImagesByDirectory', async (event, directory) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImagesByDirectory(directory);
        });
    });
    electron_1.ipcMain.handle('database:getImageCountByDirectory', async (event, directory) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImageCountByDirectory(directory);
        });
    });
    electron_1.ipcMain.handle('database:searchImages', async (event, query) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.searchImages(query);
        });
    });
    // Thumbnail service handlers
    electron_1.ipcMain.handle('thumbnail:get', async (event, imagePath) => {
        if (!isFilePathAllowed(imagePath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.getThumbnail(imagePath);
        });
    });
    electron_1.ipcMain.handle('thumbnail:getAsDataUrl', async (event, imagePath) => {
        if (!isFilePathAllowed(imagePath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            console.log('Generating thumbnail for:', imagePath);
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            const dataUrl = await thumbnailService.getThumbnailAsDataUrl(imagePath);
            console.log('Thumbnail generated, data URL length:', dataUrl.length);
            return dataUrl;
        });
    });
    electron_1.ipcMain.handle('thumbnail:generate', async (event, imagePath) => {
        if (!isFilePathAllowed(imagePath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.generateThumbnail(imagePath);
        });
    });
    electron_1.ipcMain.handle('thumbnail:exists', async (event, imagePath) => {
        if (!isFilePathAllowed(imagePath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return thumbnailService.thumbnailExists(imagePath);
        });
    });
    electron_1.ipcMain.handle('thumbnail:delete', async (event, imagePath) => {
        if (!isFilePathAllowed(imagePath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.deleteThumbnail(imagePath);
        });
    });
    electron_1.ipcMain.handle('thumbnail:clearCache', async () => {
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.clearCache();
        });
    });
    electron_1.ipcMain.handle('thumbnail:getCacheSize', async () => {
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.getCacheSize();
        });
    });
    electron_1.ipcMain.handle('thumbnail:getCacheCount', async () => {
        return handleAsyncIpc(async () => {
            const thumbnailService = (0, thumbnail_service_1.getThumbnailService)();
            return await thumbnailService.getCacheCount();
        });
    });
    // EXIF service handlers
    electron_1.ipcMain.handle('exif:extract', async (event, filepath, options) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const exifService = (0, exif_service_1.getExifService)();
            return await exifService.extractExif(filepath, options);
        });
    });
    electron_1.ipcMain.handle('exif:getGps', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const exifService = (0, exif_service_1.getExifService)();
            return await exifService.getGpsCoordinates(filepath);
        });
    });
    electron_1.ipcMain.handle('exif:getCaptureDate', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const exifService = (0, exif_service_1.getExifService)();
            return await exifService.getCaptureDate(filepath);
        });
    });
    electron_1.ipcMain.handle('exif:getCameraInfo', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const exifService = (0, exif_service_1.getExifService)();
            return await exifService.getCameraInfo(filepath);
        });
    });
    // Hash service handlers
    electron_1.ipcMain.handle('hash:hashFile', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const hashService = (0, hash_service_1.getHashService)();
            return await hashService.hashFile(filepath);
        });
    });
    electron_1.ipcMain.handle('hash:hashFiles', async (event, filepaths) => {
        if (!areFilePathsAllowed(filepaths)) {
            return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
        }
        return handleAsyncIpc(async () => {
            const hashService = (0, hash_service_1.getHashService)();
            return await hashService.hashFiles(filepaths);
        });
    });
    electron_1.ipcMain.handle('hash:findDuplicates', async (event, filepaths) => {
        if (!areFilePathsAllowed(filepaths)) {
            return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
        }
        return handleAsyncIpc(async () => {
            const hashService = (0, hash_service_1.getHashService)();
            const { results } = await hashService.hashFiles(filepaths);
            return hashService.findDuplicates(results);
        });
    });
    electron_1.ipcMain.handle('hash:scanDirectoryForDuplicates', async (event, dirPath, recursive) => {
        if (!isFilePathAllowed(dirPath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const hashService = (0, hash_service_1.getHashService)();
            return await hashService.scanDirectoryForDuplicates(dirPath, recursive);
        });
    });
    // Trash service handlers
    electron_1.ipcMain.handle('trash:trashFile', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const trashService = (0, trash_service_1.getTrashService)();
            return await trashService.trashFile(filepath);
        });
    });
    electron_1.ipcMain.handle('trash:trashFiles', async (event, filepaths) => {
        if (!areFilePathsAllowed(filepaths)) {
            return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
        }
        return handleAsyncIpc(async () => {
            const trashService = (0, trash_service_1.getTrashService)();
            return await trashService.trashFiles(filepaths);
        });
    });
    electron_1.ipcMain.handle('trash:canTrash', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const trashService = (0, trash_service_1.getTrashService)();
            return await trashService.canTrash(filepath);
        });
    });
    electron_1.ipcMain.handle('trash:getFileInfo', async (event, filepath) => {
        if (!isFilePathAllowed(filepath)) {
            return createResponse(false, undefined, 'Access denied: path outside root directory');
        }
        return handleAsyncIpc(async () => {
            const trashService = (0, trash_service_1.getTrashService)();
            return await trashService.getFileInfo(filepath);
        });
    });
    // Tag handlers
    electron_1.ipcMain.handle('tags:create', async (event, name, color) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.createTag(name, color);
        });
    });
    electron_1.ipcMain.handle('tags:get', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getTag(id);
        });
    });
    electron_1.ipcMain.handle('tags:getByName', async (event, name) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getTagByName(name);
        });
    });
    electron_1.ipcMain.handle('tags:getAll', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAllTags();
        });
    });
    electron_1.ipcMain.handle('tags:update', async (event, id, updates) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.updateTag(id, updates);
            return true;
        });
    });
    electron_1.ipcMain.handle('tags:delete', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.deleteTag(id);
            return true;
        });
    });
    electron_1.ipcMain.handle('tags:addToImage', async (event, imageId, tagId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.addTagToImage(imageId, tagId);
            return true;
        });
    });
    electron_1.ipcMain.handle('tags:removeFromImage', async (event, imageId, tagId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.removeTagFromImage(imageId, tagId);
            return true;
        });
    });
    electron_1.ipcMain.handle('tags:getForImage', async (event, imageId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getTagsForImage(imageId);
        });
    });
    electron_1.ipcMain.handle('tags:getImages', async (event, tagId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImagesByTag(tagId);
        });
    });
    // Album handlers
    electron_1.ipcMain.handle('albums:create', async (event, name, description) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.createAlbum(name, description);
        });
    });
    electron_1.ipcMain.handle('albums:get', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAlbum(id);
        });
    });
    electron_1.ipcMain.handle('albums:getAll', async () => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAllAlbums();
        });
    });
    electron_1.ipcMain.handle('albums:update', async (event, id, updates) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.updateAlbum(id, updates);
            return true;
        });
    });
    electron_1.ipcMain.handle('albums:delete', async (event, id) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.deleteAlbum(id);
            return true;
        });
    });
    electron_1.ipcMain.handle('albums:addImage', async (event, albumId, imageId, position) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.addImageToAlbum(albumId, imageId, position);
            return true;
        });
    });
    electron_1.ipcMain.handle('albums:removeImage', async (event, albumId, imageId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.removeImageFromAlbum(albumId, imageId);
            return true;
        });
    });
    electron_1.ipcMain.handle('albums:getImages', async (event, albumId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getImagesInAlbum(albumId);
        });
    });
    electron_1.ipcMain.handle('albums:getForImage', async (event, imageId) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            return db.getAlbumsForImage(imageId);
        });
    });
    electron_1.ipcMain.handle('albums:reorderImages', async (event, albumId, imageIds) => {
        return handleAsyncIpc(async () => {
            const db = (0, database_1.getDatabase)();
            db.reorderAlbumImages(albumId, imageIds);
            return true;
        });
    });
    // Utility handlers
    electron_1.ipcMain.handle('path:join', async (event, ...paths) => {
        return handleAsyncIpc(async () => {
            return path.join(...paths);
        });
    });
    electron_1.ipcMain.handle('path:basename', async (event, filePath) => {
        return handleAsyncIpc(async () => {
            return path.basename(filePath);
        });
    });
    electron_1.ipcMain.handle('path:dirname', async (event, filePath) => {
        return handleAsyncIpc(async () => {
            return path.dirname(filePath);
        });
    });
    electron_1.ipcMain.handle('path:extname', async (event, filePath) => {
        return handleAsyncIpc(async () => {
            return path.extname(filePath);
        });
    });
    console.log('IPC handlers registered successfully');
}
// Setup directory service event forwarding to renderer
function setupDirectoryEventForwarding() {
    const directoryService = (0, directory_service_1.getDirectoryService)();
    directoryService.on('fileAdded', (filePath) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:fileAdded', filePath);
        });
    });
    directoryService.on('fileRemoved', (filePath) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:fileRemoved', filePath);
        });
    });
    directoryService.on('fileChanged', (filePath) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:fileChanged', filePath);
        });
    });
    directoryService.on('directoryAdded', (dirPath) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:directoryAdded', dirPath);
        });
    });
    directoryService.on('directoryRemoved', (dirPath) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:directoryRemoved', dirPath);
        });
    });
    directoryService.on('watcherError', (error) => {
        electron_1.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('directory:watcherError', error.message);
        });
    });
    console.log('Directory event forwarding setup completed');
}
// Cleanup function
function removeIpcHandlers() {
    // Remove all handlers (useful for testing or app shutdown)
    electron_1.ipcMain.removeAllListeners();
    console.log('All IPC handlers removed');
}
//# sourceMappingURL=ipc-handlers.js.map