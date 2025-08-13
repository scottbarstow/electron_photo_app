import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog methods
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // Directory methods
  directory: {
    setRoot: (dirPath: string) => ipcRenderer.invoke('directory:setRoot', dirPath),
    getRoot: () => ipcRenderer.invoke('directory:getRoot'),
    clearRoot: () => ipcRenderer.invoke('directory:clearRoot'),
    scan: (dirPath?: string) => ipcRenderer.invoke('directory:scan', dirPath),
    getContents: (dirPath: string) => ipcRenderer.invoke('directory:getContents', dirPath),
    getSubdirectories: (dirPath: string) => ipcRenderer.invoke('directory:getSubdirectories', dirPath),
    isValid: (dirPath: string) => ipcRenderer.invoke('directory:isValid', dirPath),
    isImageFile: (filename: string) => ipcRenderer.invoke('directory:isImageFile', filename),
    
    // Watching methods
    startWatching: () => ipcRenderer.invoke('directory:startWatching'),
    stopWatching: () => ipcRenderer.invoke('directory:stopWatching'),
    isWatching: () => ipcRenderer.invoke('directory:isWatching'),
    
    // Preferences methods
    setWatchEnabled: (enabled: boolean) => ipcRenderer.invoke('directory:setWatchEnabled', enabled),
    isWatchEnabled: () => ipcRenderer.invoke('directory:isWatchEnabled'),
    setScanDepth: (depth: number) => ipcRenderer.invoke('directory:setScanDepth', depth),
    getScanDepth: () => ipcRenderer.invoke('directory:getScanDepth'),
    
    // Event listeners
    onFileAdded: (callback: (filePath: string) => void) => {
      ipcRenderer.on('directory:fileAdded', (event, filePath) => callback(filePath));
    },
    onFileRemoved: (callback: (filePath: string) => void) => {
      ipcRenderer.on('directory:fileRemoved', (event, filePath) => callback(filePath));
    },
    onFileChanged: (callback: (filePath: string) => void) => {
      ipcRenderer.on('directory:fileChanged', (event, filePath) => callback(filePath));
    },
    onDirectoryAdded: (callback: (dirPath: string) => void) => {
      ipcRenderer.on('directory:directoryAdded', (event, dirPath) => callback(dirPath));
    },
    onDirectoryRemoved: (callback: (dirPath: string) => void) => {
      ipcRenderer.on('directory:directoryRemoved', (event, dirPath) => callback(dirPath));
    },
    onWatcherError: (callback: (error: string) => void) => {
      ipcRenderer.on('directory:watcherError', (event, error) => callback(error));
    }
  },
  
  // Database methods
  database: {
    // Image methods
    insertImage: (image: any) => ipcRenderer.invoke('database:insertImage', image),
    updateImage: (id: number, updates: any) => ipcRenderer.invoke('database:updateImage', id, updates),
    getImage: (id: number) => ipcRenderer.invoke('database:getImage', id),
    getImageByPath: (path: string) => ipcRenderer.invoke('database:getImageByPath', path),
    getImagesByHash: (hash: string) => ipcRenderer.invoke('database:getImagesByHash', hash),
    getAllImages: () => ipcRenderer.invoke('database:getAllImages'),
    deleteImage: (id: number) => ipcRenderer.invoke('database:deleteImage', id),
    
    // Duplicate group methods
    insertDuplicateGroup: (group: any) => ipcRenderer.invoke('database:insertDuplicateGroup', group),
    updateDuplicateGroup: (id: number, updates: any) => ipcRenderer.invoke('database:updateDuplicateGroup', id, updates),
    getDuplicateGroup: (id: number) => ipcRenderer.invoke('database:getDuplicateGroup', id),
    getDuplicateGroupByHash: (hash: string) => ipcRenderer.invoke('database:getDuplicateGroupByHash', hash),
    getAllDuplicateGroups: () => ipcRenderer.invoke('database:getAllDuplicateGroups'),
    deleteDuplicateGroup: (id: number) => ipcRenderer.invoke('database:deleteDuplicateGroup', id),
    
    // Preference methods
    setPreference: (key: string, value: string) => ipcRenderer.invoke('database:setPreference', key, value),
    getPreference: (key: string) => ipcRenderer.invoke('database:getPreference', key),
    getAllPreferences: () => ipcRenderer.invoke('database:getAllPreferences'),
    deletePreference: (key: string) => ipcRenderer.invoke('database:deletePreference', key),
    
    // Statistics methods
    getImageCount: () => ipcRenderer.invoke('database:getImageCount'),
    getDuplicateCount: () => ipcRenderer.invoke('database:getDuplicateCount')
  },
  
  // Path utility methods
  path: {
    join: (...paths: string[]) => ipcRenderer.invoke('path:join', ...paths),
    basename: (filePath: string) => ipcRenderer.invoke('path:basename', filePath),
    dirname: (filePath: string) => ipcRenderer.invoke('path:dirname', filePath),
    extname: (filePath: string) => ipcRenderer.invoke('path:extname', filePath)
  }
});

console.log('Preload script loaded successfully');