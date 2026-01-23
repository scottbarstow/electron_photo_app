import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDatabase } from './database';
import { getDirectoryService } from './directory-service';
import { getThumbnailService } from './thumbnail-service';
import { getExifService } from './exif-service';
import { getHashService } from './hash-service';
import { getTrashService } from './trash-service';
import * as path from 'path';

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Helper function to create standardized responses
function createResponse<T>(success: boolean, data?: T, error?: string): IpcResponse<T> {
  return { success, data, error };
}

// Helper function to handle async IPC calls with error handling
async function handleAsyncIpc<T>(
  handler: () => Promise<T>
): Promise<IpcResponse<T>> {
  try {
    const result = await handler();
    return createResponse(true, result);
  } catch (error) {
    console.error('IPC handler error:', error);
    return createResponse<T>(false, undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}

// Helper function to handle sync IPC calls with error handling
function handleSyncIpc<T>(
  handler: () => T
): IpcResponse<T> {
  try {
    const result = handler();
    return createResponse(true, result);
  } catch (error) {
    console.error('IPC handler error:', error);
    return createResponse<T>(false, undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}

// Security: Validate that a file path is within the configured root directory
function isFilePathAllowed(filepath: string): boolean {
  const directoryService = getDirectoryService();
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
  } catch {
    return false;
  }
}

// Validate multiple file paths
function areFilePathsAllowed(filepaths: string[]): boolean {
  return filepaths.every(fp => isFilePathAllowed(fp));
}

export function setupIpcHandlers(): void {
  // Dialog handlers
  ipcMain.handle('dialog:openFile', async () => {
    return handleAsyncIpc(async () => {
      const result = await dialog.showOpenDialog({
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

  ipcMain.handle('dialog:openDirectory', async () => {
    return handleAsyncIpc(async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      
      if (result.canceled) {
        return null;
      }
      
      return result.filePaths[0];
    });
  });

  // Directory service handlers
  ipcMain.handle('directory:setRoot', async (event, dirPath: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      const success = directoryService.setRootDirectory(dirPath);
      
      if (!success) {
        throw new Error('Failed to set root directory. Path may be invalid or inaccessible.');
      }
      
      return directoryService.getRootDirectoryInfo();
    });
  });

  ipcMain.handle('directory:getRoot', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.getRootDirectoryInfo();
    });
  });

  ipcMain.handle('directory:clearRoot', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.clearRootDirectory();
      return true;
    });
  });

  ipcMain.handle('directory:scan', async (event, dirPath?: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.scanDirectory(dirPath);
    });
  });

  ipcMain.handle('directory:getContents', async (event, dirPath: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.getDirectoryContents(dirPath);
    });
  });

  ipcMain.handle('directory:getSubdirectories', async (event, dirPath: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.getSubdirectories(dirPath);
    });
  });

  ipcMain.handle('directory:isValid', async (event, dirPath: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.isValidDirectory(dirPath);
    });
  });

  ipcMain.handle('directory:isImageFile', async (event, filename: string) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.isImageFile(filename);
    });
  });

  // Directory tree handlers
  ipcMain.handle('directory:getTree', async (event, dirPath?: string, maxDepth?: number) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.getDirectoryTree(dirPath, maxDepth);
    });
  });

  ipcMain.handle('directory:expandNode', async (event, dirPath: string, maxDepth?: number) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.expandDirectoryNode(dirPath, maxDepth);
    });
  });

  ipcMain.handle('directory:hasImages', async (event, dirPath: string, maxDepth?: number) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.hasImagesInDirectory(dirPath, maxDepth);
    });
  });

  ipcMain.handle('directory:getImageCount', async (event, dirPath: string, recursive?: boolean) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return await directoryService.getDirectoryImageCount(dirPath, recursive);
    });
  });

  ipcMain.handle('directory:clearTreeCache', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.clearDirectoryTreeCache();
      return true;
    });
  });

  // Directory watching handlers
  ipcMain.handle('directory:startWatching', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.startWatching();
      return directoryService.isWatching();
    });
  });

  ipcMain.handle('directory:stopWatching', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.stopWatching();
      return !directoryService.isWatching();
    });
  });

  ipcMain.handle('directory:isWatching', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.isWatching();
    });
  });

  // Directory preferences handlers
  ipcMain.handle('directory:setWatchEnabled', async (event, enabled: boolean) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.setWatchEnabled(enabled);
      return enabled;
    });
  });

  ipcMain.handle('directory:isWatchEnabled', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.isWatchEnabled();
    });
  });

  ipcMain.handle('directory:setScanDepth', async (event, depth: number) => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      directoryService.setScanDepth(depth);
      return directoryService.getScanDepth();
    });
  });

  ipcMain.handle('directory:getScanDepth', async () => {
    return handleAsyncIpc(async () => {
      const directoryService = getDirectoryService();
      return directoryService.getScanDepth();
    });
  });

  // Database handlers - Images
  ipcMain.handle('database:insertImage', async (event, image) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.insertImage(image);
    });
  });

  ipcMain.handle('database:updateImage', async (event, id: number, updates) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.updateImage(id, updates);
      return true;
    });
  });

  ipcMain.handle('database:getImage', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImage(id);
    });
  });

  ipcMain.handle('database:getImageByPath', async (event, path: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImageByPath(path);
    });
  });

  ipcMain.handle('database:getImagesByHash', async (event, hash: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImagesByHash(hash);
    });
  });

  ipcMain.handle('database:getAllImages', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAllImages();
    });
  });

  ipcMain.handle('database:deleteImage', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.deleteImage(id);
      return true;
    });
  });

  // Database handlers - Duplicate Groups
  ipcMain.handle('database:insertDuplicateGroup', async (event, group) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.insertDuplicateGroup(group);
    });
  });

  ipcMain.handle('database:updateDuplicateGroup', async (event, id: number, updates) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.updateDuplicateGroup(id, updates);
      return true;
    });
  });

  ipcMain.handle('database:getDuplicateGroup', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getDuplicateGroup(id);
    });
  });

  ipcMain.handle('database:getDuplicateGroupByHash', async (event, hash: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getDuplicateGroupByHash(hash);
    });
  });

  ipcMain.handle('database:getAllDuplicateGroups', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAllDuplicateGroups();
    });
  });

  ipcMain.handle('database:deleteDuplicateGroup', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.deleteDuplicateGroup(id);
      return true;
    });
  });

  // Database handlers - Preferences
  ipcMain.handle('database:setPreference', async (event, key: string, value: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.setPreference(key, value);
      return true;
    });
  });

  ipcMain.handle('database:getPreference', async (event, key: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getPreference(key);
    });
  });

  ipcMain.handle('database:getAllPreferences', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAllPreferences();
    });
  });

  ipcMain.handle('database:deletePreference', async (event, key: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.deletePreference(key);
      return true;
    });
  });

  // Database handlers - Statistics
  ipcMain.handle('database:getImageCount', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImageCount();
    });
  });

  ipcMain.handle('database:getDuplicateCount', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getDuplicateCount();
    });
  });

  // Database handlers - Images by directory
  ipcMain.handle('database:getImagesByDirectory', async (event, directory: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImagesByDirectory(directory);
    });
  });

  ipcMain.handle('database:getImageCountByDirectory', async (event, directory: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImageCountByDirectory(directory);
    });
  });

  ipcMain.handle('database:searchImages', async (event, query: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.searchImages(query);
    });
  });

  // Thumbnail service handlers
  ipcMain.handle('thumbnail:get', async (event, imagePath: string) => {
    if (!isFilePathAllowed(imagePath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.getThumbnail(imagePath);
    });
  });

  ipcMain.handle('thumbnail:getAsDataUrl', async (event, imagePath: string) => {
    if (!isFilePathAllowed(imagePath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      console.log('Generating thumbnail for:', imagePath);
      const thumbnailService = getThumbnailService();
      const dataUrl = await thumbnailService.getThumbnailAsDataUrl(imagePath);
      console.log('Thumbnail generated, data URL length:', dataUrl.length);
      return dataUrl;
    });
  });

  ipcMain.handle('thumbnail:generate', async (event, imagePath: string) => {
    if (!isFilePathAllowed(imagePath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.generateThumbnail(imagePath);
    });
  });

  ipcMain.handle('thumbnail:exists', async (event, imagePath: string) => {
    if (!isFilePathAllowed(imagePath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return thumbnailService.thumbnailExists(imagePath);
    });
  });

  ipcMain.handle('thumbnail:delete', async (event, imagePath: string) => {
    if (!isFilePathAllowed(imagePath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.deleteThumbnail(imagePath);
    });
  });

  ipcMain.handle('thumbnail:clearCache', async () => {
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.clearCache();
    });
  });

  ipcMain.handle('thumbnail:getCacheSize', async () => {
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.getCacheSize();
    });
  });

  ipcMain.handle('thumbnail:getCacheCount', async () => {
    return handleAsyncIpc(async () => {
      const thumbnailService = getThumbnailService();
      return await thumbnailService.getCacheCount();
    });
  });

  // EXIF service handlers
  ipcMain.handle('exif:extract', async (event, filepath: string, options?: any) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const exifService = getExifService();
      return await exifService.extractExif(filepath, options);
    });
  });

  ipcMain.handle('exif:getGps', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const exifService = getExifService();
      return await exifService.getGpsCoordinates(filepath);
    });
  });

  ipcMain.handle('exif:getCaptureDate', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const exifService = getExifService();
      return await exifService.getCaptureDate(filepath);
    });
  });

  ipcMain.handle('exif:getCameraInfo', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const exifService = getExifService();
      return await exifService.getCameraInfo(filepath);
    });
  });

  // Hash service handlers
  ipcMain.handle('hash:hashFile', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const hashService = getHashService();
      return await hashService.hashFile(filepath);
    });
  });

  ipcMain.handle('hash:hashFiles', async (event, filepaths: string[]) => {
    if (!areFilePathsAllowed(filepaths)) {
      return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
    }
    return handleAsyncIpc(async () => {
      const hashService = getHashService();
      return await hashService.hashFiles(filepaths);
    });
  });

  ipcMain.handle('hash:findDuplicates', async (event, filepaths: string[]) => {
    if (!areFilePathsAllowed(filepaths)) {
      return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
    }
    return handleAsyncIpc(async () => {
      const hashService = getHashService();
      const { results } = await hashService.hashFiles(filepaths);
      return hashService.findDuplicates(results);
    });
  });

  ipcMain.handle('hash:scanDirectoryForDuplicates', async (event, dirPath: string, recursive?: boolean) => {
    if (!isFilePathAllowed(dirPath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const hashService = getHashService();
      return await hashService.scanDirectoryForDuplicates(dirPath, recursive);
    });
  });

  // Trash service handlers
  ipcMain.handle('trash:trashFile', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const trashService = getTrashService();
      return await trashService.trashFile(filepath);
    });
  });

  ipcMain.handle('trash:trashFiles', async (event, filepaths: string[]) => {
    if (!areFilePathsAllowed(filepaths)) {
      return createResponse(false, undefined, 'Access denied: one or more paths outside root directory');
    }
    return handleAsyncIpc(async () => {
      const trashService = getTrashService();
      return await trashService.trashFiles(filepaths);
    });
  });

  ipcMain.handle('trash:canTrash', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const trashService = getTrashService();
      return await trashService.canTrash(filepath);
    });
  });

  ipcMain.handle('trash:getFileInfo', async (event, filepath: string) => {
    if (!isFilePathAllowed(filepath)) {
      return createResponse(false, undefined, 'Access denied: path outside root directory');
    }
    return handleAsyncIpc(async () => {
      const trashService = getTrashService();
      return await trashService.getFileInfo(filepath);
    });
  });

  // Tag handlers
  ipcMain.handle('tags:create', async (event, name: string, color?: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.createTag(name, color);
    });
  });

  ipcMain.handle('tags:get', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getTag(id);
    });
  });

  ipcMain.handle('tags:getByName', async (event, name: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getTagByName(name);
    });
  });

  ipcMain.handle('tags:getAll', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAllTags();
    });
  });

  ipcMain.handle('tags:update', async (event, id: number, updates: { name?: string; color?: string }) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.updateTag(id, updates);
      return true;
    });
  });

  ipcMain.handle('tags:delete', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.deleteTag(id);
      return true;
    });
  });

  ipcMain.handle('tags:addToImage', async (event, imageId: number, tagId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.addTagToImage(imageId, tagId);
      return true;
    });
  });

  ipcMain.handle('tags:removeFromImage', async (event, imageId: number, tagId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.removeTagFromImage(imageId, tagId);
      return true;
    });
  });

  ipcMain.handle('tags:getForImage', async (event, imageId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getTagsForImage(imageId);
    });
  });

  ipcMain.handle('tags:getImages', async (event, tagId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImagesByTag(tagId);
    });
  });

  // Album handlers
  ipcMain.handle('albums:create', async (event, name: string, description?: string) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.createAlbum(name, description);
    });
  });

  ipcMain.handle('albums:get', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAlbum(id);
    });
  });

  ipcMain.handle('albums:getAll', async () => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAllAlbums();
    });
  });

  ipcMain.handle('albums:update', async (event, id: number, updates: { name?: string; description?: string; coverImageId?: number }) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.updateAlbum(id, updates);
      return true;
    });
  });

  ipcMain.handle('albums:delete', async (event, id: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.deleteAlbum(id);
      return true;
    });
  });

  ipcMain.handle('albums:addImage', async (event, albumId: number, imageId: number, position?: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.addImageToAlbum(albumId, imageId, position);
      return true;
    });
  });

  ipcMain.handle('albums:removeImage', async (event, albumId: number, imageId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.removeImageFromAlbum(albumId, imageId);
      return true;
    });
  });

  ipcMain.handle('albums:getImages', async (event, albumId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getImagesInAlbum(albumId);
    });
  });

  ipcMain.handle('albums:getForImage', async (event, imageId: number) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      return db.getAlbumsForImage(imageId);
    });
  });

  ipcMain.handle('albums:reorderImages', async (event, albumId: number, imageIds: number[]) => {
    return handleAsyncIpc(async () => {
      const db = getDatabase();
      db.reorderAlbumImages(albumId, imageIds);
      return true;
    });
  });

  // Utility handlers
  ipcMain.handle('path:join', async (event, ...paths: string[]) => {
    return handleAsyncIpc(async () => {
      return path.join(...paths);
    });
  });

  ipcMain.handle('path:basename', async (event, filePath: string) => {
    return handleAsyncIpc(async () => {
      return path.basename(filePath);
    });
  });

  ipcMain.handle('path:dirname', async (event, filePath: string) => {
    return handleAsyncIpc(async () => {
      return path.dirname(filePath);
    });
  });

  ipcMain.handle('path:extname', async (event, filePath: string) => {
    return handleAsyncIpc(async () => {
      return path.extname(filePath);
    });
  });

  console.log('IPC handlers registered successfully');
}

// Setup directory service event forwarding to renderer
export function setupDirectoryEventForwarding(): void {
  const directoryService = getDirectoryService();
  
  directoryService.on('fileAdded', (filePath: string) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:fileAdded', filePath);
    });
  });

  directoryService.on('fileRemoved', (filePath: string) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:fileRemoved', filePath);
    });
  });

  directoryService.on('fileChanged', (filePath: string) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:fileChanged', filePath);
    });
  });

  directoryService.on('directoryAdded', (dirPath: string) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:directoryAdded', dirPath);
    });
  });

  directoryService.on('directoryRemoved', (dirPath: string) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:directoryRemoved', dirPath);
    });
  });

  directoryService.on('watcherError', (error: Error) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('directory:watcherError', error.message);
    });
  });

  console.log('Directory event forwarding setup completed');
}

// Cleanup function
export function removeIpcHandlers(): void {
  // Remove all handlers (useful for testing or app shutdown)
  ipcMain.removeAllListeners();
  console.log('All IPC handlers removed');
}