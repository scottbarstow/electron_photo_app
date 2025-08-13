import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDatabase } from './database';
import { getDirectoryService } from './directory-service';
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