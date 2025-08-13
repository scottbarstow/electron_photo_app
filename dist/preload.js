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