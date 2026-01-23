"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Dialog methods
    openFile: () => electron_1.ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    // Directory methods
    directory: {
        setRoot: (dirPath) => electron_1.ipcRenderer.invoke('directory:setRoot', dirPath),
        getRoot: () => electron_1.ipcRenderer.invoke('directory:getRoot'),
        clearRoot: () => electron_1.ipcRenderer.invoke('directory:clearRoot'),
        scan: (dirPath) => electron_1.ipcRenderer.invoke('directory:scan', dirPath),
        getContents: (dirPath) => electron_1.ipcRenderer.invoke('directory:getContents', dirPath),
        getSubdirectories: (dirPath) => electron_1.ipcRenderer.invoke('directory:getSubdirectories', dirPath),
        isValid: (dirPath) => electron_1.ipcRenderer.invoke('directory:isValid', dirPath),
        isImageFile: (filename) => electron_1.ipcRenderer.invoke('directory:isImageFile', filename),
        // Watching methods
        startWatching: () => electron_1.ipcRenderer.invoke('directory:startWatching'),
        stopWatching: () => electron_1.ipcRenderer.invoke('directory:stopWatching'),
        isWatching: () => electron_1.ipcRenderer.invoke('directory:isWatching'),
        // Preferences methods
        setWatchEnabled: (enabled) => electron_1.ipcRenderer.invoke('directory:setWatchEnabled', enabled),
        isWatchEnabled: () => electron_1.ipcRenderer.invoke('directory:isWatchEnabled'),
        setScanDepth: (depth) => electron_1.ipcRenderer.invoke('directory:setScanDepth', depth),
        getScanDepth: () => electron_1.ipcRenderer.invoke('directory:getScanDepth'),
        // Event listeners
        onFileAdded: (callback) => {
            electron_1.ipcRenderer.on('directory:fileAdded', (event, filePath) => callback(filePath));
        },
        onFileRemoved: (callback) => {
            electron_1.ipcRenderer.on('directory:fileRemoved', (event, filePath) => callback(filePath));
        },
        onFileChanged: (callback) => {
            electron_1.ipcRenderer.on('directory:fileChanged', (event, filePath) => callback(filePath));
        },
        onDirectoryAdded: (callback) => {
            electron_1.ipcRenderer.on('directory:directoryAdded', (event, dirPath) => callback(dirPath));
        },
        onDirectoryRemoved: (callback) => {
            electron_1.ipcRenderer.on('directory:directoryRemoved', (event, dirPath) => callback(dirPath));
        },
        onWatcherError: (callback) => {
            electron_1.ipcRenderer.on('directory:watcherError', (event, error) => callback(error));
        }
    },
    // Database methods
    database: {
        // Image methods
        insertImage: (image) => electron_1.ipcRenderer.invoke('database:insertImage', image),
        updateImage: (id, updates) => electron_1.ipcRenderer.invoke('database:updateImage', id, updates),
        getImage: (id) => electron_1.ipcRenderer.invoke('database:getImage', id),
        getImageByPath: (path) => electron_1.ipcRenderer.invoke('database:getImageByPath', path),
        getImagesByHash: (hash) => electron_1.ipcRenderer.invoke('database:getImagesByHash', hash),
        getAllImages: () => electron_1.ipcRenderer.invoke('database:getAllImages'),
        deleteImage: (id) => electron_1.ipcRenderer.invoke('database:deleteImage', id),
        // Image by directory methods
        getImagesByDirectory: (directory) => electron_1.ipcRenderer.invoke('database:getImagesByDirectory', directory),
        getImageCountByDirectory: (directory) => electron_1.ipcRenderer.invoke('database:getImageCountByDirectory', directory),
        searchImages: (query) => electron_1.ipcRenderer.invoke('database:searchImages', query),
        // Duplicate group methods
        insertDuplicateGroup: (group) => electron_1.ipcRenderer.invoke('database:insertDuplicateGroup', group),
        updateDuplicateGroup: (id, updates) => electron_1.ipcRenderer.invoke('database:updateDuplicateGroup', id, updates),
        getDuplicateGroup: (id) => electron_1.ipcRenderer.invoke('database:getDuplicateGroup', id),
        getDuplicateGroupByHash: (hash) => electron_1.ipcRenderer.invoke('database:getDuplicateGroupByHash', hash),
        getAllDuplicateGroups: () => electron_1.ipcRenderer.invoke('database:getAllDuplicateGroups'),
        deleteDuplicateGroup: (id) => electron_1.ipcRenderer.invoke('database:deleteDuplicateGroup', id),
        // Preference methods
        setPreference: (key, value) => electron_1.ipcRenderer.invoke('database:setPreference', key, value),
        getPreference: (key) => electron_1.ipcRenderer.invoke('database:getPreference', key),
        getAllPreferences: () => electron_1.ipcRenderer.invoke('database:getAllPreferences'),
        deletePreference: (key) => electron_1.ipcRenderer.invoke('database:deletePreference', key),
        // Statistics methods
        getImageCount: () => electron_1.ipcRenderer.invoke('database:getImageCount'),
        getDuplicateCount: () => electron_1.ipcRenderer.invoke('database:getDuplicateCount')
    },
    // Tag methods
    tags: {
        create: (name, color) => electron_1.ipcRenderer.invoke('tags:create', name, color),
        get: (id) => electron_1.ipcRenderer.invoke('tags:get', id),
        getByName: (name) => electron_1.ipcRenderer.invoke('tags:getByName', name),
        getAll: () => electron_1.ipcRenderer.invoke('tags:getAll'),
        update: (id, updates) => electron_1.ipcRenderer.invoke('tags:update', id, updates),
        delete: (id) => electron_1.ipcRenderer.invoke('tags:delete', id),
        addToImage: (imageId, tagId) => electron_1.ipcRenderer.invoke('tags:addToImage', imageId, tagId),
        removeFromImage: (imageId, tagId) => electron_1.ipcRenderer.invoke('tags:removeFromImage', imageId, tagId),
        getForImage: (imageId) => electron_1.ipcRenderer.invoke('tags:getForImage', imageId),
        getImages: (tagId) => electron_1.ipcRenderer.invoke('tags:getImages', tagId)
    },
    // Album methods
    albums: {
        create: (name, description) => electron_1.ipcRenderer.invoke('albums:create', name, description),
        get: (id) => electron_1.ipcRenderer.invoke('albums:get', id),
        getAll: () => electron_1.ipcRenderer.invoke('albums:getAll'),
        update: (id, updates) => electron_1.ipcRenderer.invoke('albums:update', id, updates),
        delete: (id) => electron_1.ipcRenderer.invoke('albums:delete', id),
        addImage: (albumId, imageId, position) => electron_1.ipcRenderer.invoke('albums:addImage', albumId, imageId, position),
        removeImage: (albumId, imageId) => electron_1.ipcRenderer.invoke('albums:removeImage', albumId, imageId),
        getImages: (albumId) => electron_1.ipcRenderer.invoke('albums:getImages', albumId),
        getForImage: (imageId) => electron_1.ipcRenderer.invoke('albums:getForImage', imageId),
        reorderImages: (albumId, imageIds) => electron_1.ipcRenderer.invoke('albums:reorderImages', albumId, imageIds)
    },
    // Thumbnail service methods
    thumbnail: {
        get: (imagePath) => electron_1.ipcRenderer.invoke('thumbnail:get', imagePath),
        getAsDataUrl: (imagePath) => electron_1.ipcRenderer.invoke('thumbnail:getAsDataUrl', imagePath),
        generate: (imagePath) => electron_1.ipcRenderer.invoke('thumbnail:generate', imagePath),
        exists: (imagePath) => electron_1.ipcRenderer.invoke('thumbnail:exists', imagePath),
        delete: (imagePath) => electron_1.ipcRenderer.invoke('thumbnail:delete', imagePath),
        clearCache: () => electron_1.ipcRenderer.invoke('thumbnail:clearCache'),
        getCacheSize: () => electron_1.ipcRenderer.invoke('thumbnail:getCacheSize'),
        getCacheCount: () => electron_1.ipcRenderer.invoke('thumbnail:getCacheCount')
    },
    // EXIF service methods
    exif: {
        extract: (filepath, options) => electron_1.ipcRenderer.invoke('exif:extract', filepath, options),
        getGps: (filepath) => electron_1.ipcRenderer.invoke('exif:getGps', filepath),
        getCaptureDate: (filepath) => electron_1.ipcRenderer.invoke('exif:getCaptureDate', filepath),
        getCameraInfo: (filepath) => electron_1.ipcRenderer.invoke('exif:getCameraInfo', filepath)
    },
    // Hash service methods
    hash: {
        hashFile: (filepath) => electron_1.ipcRenderer.invoke('hash:hashFile', filepath),
        hashFiles: (filepaths) => electron_1.ipcRenderer.invoke('hash:hashFiles', filepaths),
        findDuplicates: (filepaths) => electron_1.ipcRenderer.invoke('hash:findDuplicates', filepaths),
        scanDirectoryForDuplicates: (dirPath, recursive) => electron_1.ipcRenderer.invoke('hash:scanDirectoryForDuplicates', dirPath, recursive)
    },
    // Trash service methods
    trash: {
        trashFile: (filepath) => electron_1.ipcRenderer.invoke('trash:trashFile', filepath),
        trashFiles: (filepaths) => electron_1.ipcRenderer.invoke('trash:trashFiles', filepaths),
        canTrash: (filepath) => electron_1.ipcRenderer.invoke('trash:canTrash', filepath),
        getFileInfo: (filepath) => electron_1.ipcRenderer.invoke('trash:getFileInfo', filepath)
    },
    // Path utility methods
    path: {
        join: (...paths) => electron_1.ipcRenderer.invoke('path:join', ...paths),
        basename: (filePath) => electron_1.ipcRenderer.invoke('path:basename', filePath),
        dirname: (filePath) => electron_1.ipcRenderer.invoke('path:dirname', filePath),
        extname: (filePath) => electron_1.ipcRenderer.invoke('path:extname', filePath)
    }
});
console.log('Preload script loaded successfully');
//# sourceMappingURL=preload.js.map