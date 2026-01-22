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

    // Image by directory methods
    getImagesByDirectory: (directory: string) => ipcRenderer.invoke('database:getImagesByDirectory', directory),
    getImageCountByDirectory: (directory: string) => ipcRenderer.invoke('database:getImageCountByDirectory', directory),
    searchImages: (query: string) => ipcRenderer.invoke('database:searchImages', query),

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

  // Tag methods
  tags: {
    create: (name: string, color?: string) => ipcRenderer.invoke('tags:create', name, color),
    get: (id: number) => ipcRenderer.invoke('tags:get', id),
    getByName: (name: string) => ipcRenderer.invoke('tags:getByName', name),
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    update: (id: number, updates: { name?: string; color?: string }) => ipcRenderer.invoke('tags:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('tags:delete', id),
    addToImage: (imageId: number, tagId: number) => ipcRenderer.invoke('tags:addToImage', imageId, tagId),
    removeFromImage: (imageId: number, tagId: number) => ipcRenderer.invoke('tags:removeFromImage', imageId, tagId),
    getForImage: (imageId: number) => ipcRenderer.invoke('tags:getForImage', imageId),
    getImages: (tagId: number) => ipcRenderer.invoke('tags:getImages', tagId)
  },

  // Album methods
  albums: {
    create: (name: string, description?: string) => ipcRenderer.invoke('albums:create', name, description),
    get: (id: number) => ipcRenderer.invoke('albums:get', id),
    getAll: () => ipcRenderer.invoke('albums:getAll'),
    update: (id: number, updates: { name?: string; description?: string; coverImageId?: number }) => ipcRenderer.invoke('albums:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('albums:delete', id),
    addImage: (albumId: number, imageId: number, position?: number) => ipcRenderer.invoke('albums:addImage', albumId, imageId, position),
    removeImage: (albumId: number, imageId: number) => ipcRenderer.invoke('albums:removeImage', albumId, imageId),
    getImages: (albumId: number) => ipcRenderer.invoke('albums:getImages', albumId),
    getForImage: (imageId: number) => ipcRenderer.invoke('albums:getForImage', imageId),
    reorderImages: (albumId: number, imageIds: number[]) => ipcRenderer.invoke('albums:reorderImages', albumId, imageIds)
  },

  // Thumbnail service methods
  thumbnail: {
    get: (imagePath: string) => ipcRenderer.invoke('thumbnail:get', imagePath),
    getAsDataUrl: (imagePath: string) => ipcRenderer.invoke('thumbnail:getAsDataUrl', imagePath),
    generate: (imagePath: string) => ipcRenderer.invoke('thumbnail:generate', imagePath),
    exists: (imagePath: string) => ipcRenderer.invoke('thumbnail:exists', imagePath),
    delete: (imagePath: string) => ipcRenderer.invoke('thumbnail:delete', imagePath),
    clearCache: () => ipcRenderer.invoke('thumbnail:clearCache'),
    getCacheSize: () => ipcRenderer.invoke('thumbnail:getCacheSize'),
    getCacheCount: () => ipcRenderer.invoke('thumbnail:getCacheCount')
  },

  // EXIF service methods
  exif: {
    extract: (filepath: string, options?: any) => ipcRenderer.invoke('exif:extract', filepath, options),
    getGps: (filepath: string) => ipcRenderer.invoke('exif:getGps', filepath),
    getCaptureDate: (filepath: string) => ipcRenderer.invoke('exif:getCaptureDate', filepath),
    getCameraInfo: (filepath: string) => ipcRenderer.invoke('exif:getCameraInfo', filepath)
  },

  // Hash service methods
  hash: {
    hashFile: (filepath: string) => ipcRenderer.invoke('hash:hashFile', filepath),
    hashFiles: (filepaths: string[]) => ipcRenderer.invoke('hash:hashFiles', filepaths),
    findDuplicates: (filepaths: string[]) => ipcRenderer.invoke('hash:findDuplicates', filepaths),
    scanDirectoryForDuplicates: (dirPath: string, recursive?: boolean) =>
      ipcRenderer.invoke('hash:scanDirectoryForDuplicates', dirPath, recursive)
  },

  // Trash service methods
  trash: {
    trashFile: (filepath: string) => ipcRenderer.invoke('trash:trashFile', filepath),
    trashFiles: (filepaths: string[]) => ipcRenderer.invoke('trash:trashFiles', filepaths),
    canTrash: (filepath: string) => ipcRenderer.invoke('trash:canTrash', filepath),
    getFileInfo: (filepath: string) => ipcRenderer.invoke('trash:getFileInfo', filepath)
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