import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDirectoryService } from './directory-service';

// IPC channel constants
export const IPC_CHANNELS = {
  // App information
  GET_APP_VERSION: 'app:get-version',
  GET_APP_PATH: 'app:get-path',

  // Dialog operations
  SHOW_OPEN_DIALOG: 'dialog:show-open',
  SHOW_SAVE_DIALOG: 'dialog:show-save',
  SHOW_MESSAGE_BOX: 'dialog:show-message',

  // File system operations
  READ_FILE: 'fs:read-file',
  WRITE_FILE: 'fs:write-file',
  CHECK_FILE_EXISTS: 'fs:check-exists',
  GET_DIRECTORY_CONTENTS: 'fs:get-directory-contents',

  // Window operations
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',

  // System operations
  GET_SYSTEM_INFO: 'system:get-info',

  // Directory operations
  SELECT_DIRECTORY: 'directory:select',
  SET_ROOT_DIRECTORY: 'directory:set-root',
  GET_ROOT_DIRECTORY: 'directory:get-root',
  GET_DIRECTORY_INFO: 'directory:get-info',
  GET_DIRECTORY_STATS: 'directory:get-stats',
  VALIDATE_DIRECTORY: 'directory:validate',
  CLEAR_DIRECTORY: 'directory:clear',
  START_WATCHING: 'directory:start-watching',
  STOP_WATCHING: 'directory:stop-watching',
  IS_WATCHING: 'directory:is-watching',

  // Events (renderer to main)
  RENDERER_READY: 'renderer:ready',

  // Events (main to renderer)
  WINDOW_FOCUS: 'window:focus',
  WINDOW_BLUR: 'window:blur',
  DIRECTORY_CHANGED: 'directory:changed',
} as const;

// Type definitions for IPC responses
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Helper function to create success response
const createSuccessResponse = <T>(data: T): IpcResponse<T> => ({
  success: true,
  data,
});

// Helper function to create error response
const createErrorResponse = (error: string): IpcResponse => ({
  success: false,
  error,
});

// Setup all IPC handlers
export const setupIpcHandlers = (): void => {
  // App information handlers
  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, async () => {
    try {
      return createSuccessResponse(app.getVersion());
    } catch (error) {
      return createErrorResponse(`Failed to get app version: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_PATH, async (_, pathType: string) => {
    try {
      const appPath = app.getPath(pathType as any);
      return createSuccessResponse(appPath);
    } catch (error) {
      return createErrorResponse(`Failed to get app path: ${error}`);
    }
  });

  // Dialog handlers
  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, async (_, options = {}) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(focusedWindow!, {
        properties: ['openDirectory', 'createDirectory'],
        ...options,
      });
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(`Failed to show open dialog: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_SAVE_DIALOG, async (_, options = {}) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(focusedWindow!, options);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(`Failed to show save dialog: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_MESSAGE_BOX, async (_, options) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showMessageBox(focusedWindow!, options);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(`Failed to show message box: ${error}`);
    }
  });

  // File system handlers
  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_, filePath: string) => {
    try {
      // Security: Validate file path is not trying to access restricted areas
      const resolvedPath = path.resolve(filePath);
      if (
        !resolvedPath.startsWith(process.cwd()) &&
        !resolvedPath.startsWith(app.getPath('userData'))
      ) {
        throw new Error(
          'Access denied: File path is outside allowed directories',
        );
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      return createSuccessResponse(content);
    } catch (error) {
      return createErrorResponse(`Failed to read file: ${error}`);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.WRITE_FILE,
    async (_, filePath: string, content: string) => {
      try {
        // Security: Validate file path is not trying to access restricted areas
        const resolvedPath = path.resolve(filePath);
        if (
          !resolvedPath.startsWith(process.cwd()) &&
          !resolvedPath.startsWith(app.getPath('userData'))
        ) {
          throw new Error(
            'Access denied: File path is outside allowed directories',
          );
        }

        await fs.writeFile(resolvedPath, content, 'utf-8');
        return createSuccessResponse(true);
      } catch (error) {
        return createErrorResponse(`Failed to write file: ${error}`);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.CHECK_FILE_EXISTS,
    async (_, filePath: string) => {
      try {
        const resolvedPath = path.resolve(filePath);
        const stats = await fs.stat(resolvedPath);
        return createSuccessResponse({
          exists: true,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return createSuccessResponse({ exists: false });
        }
        return createErrorResponse(`Failed to check file: ${error}`);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_DIRECTORY_CONTENTS,
    async (_, dirPath: string) => {
      try {
        const resolvedPath = path.resolve(dirPath);
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

        const contents = await Promise.all(
          entries.map(async entry => {
            const fullPath = path.join(resolvedPath, entry.name);
            const stats = await fs.stat(fullPath);

            return {
              name: entry.name,
              path: fullPath,
              isFile: entry.isFile(),
              isDirectory: entry.isDirectory(),
              size: stats.size,
              modified: stats.mtime,
            };
          }),
        );

        return createSuccessResponse(contents);
      } catch (error) {
        return createErrorResponse(`Failed to read directory: ${error}`);
      }
    },
  );

  // Window operation handlers
  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      focusedWindow?.minimize();
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to minimize window: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow?.isMaximized()) {
        focusedWindow.unmaximize();
      } else {
        focusedWindow?.maximize();
      }
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to maximize window: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      focusedWindow?.close();
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to close window: ${error}`);
    }
  });

  // System information handler
  ipcMain.handle(IPC_CHANNELS.GET_SYSTEM_INFO, async () => {
    try {
      const info = {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
      };
      return createSuccessResponse(info);
    } catch (error) {
      return createErrorResponse(`Failed to get system info: ${error}`);
    }
  });

  // Directory operation handlers
  const directoryService = getDirectoryService();

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const selectedPath = await directoryService.selectDirectory(
        focusedWindow || undefined,
      );
      return createSuccessResponse(selectedPath);
    } catch (error) {
      return createErrorResponse(`Failed to select directory: ${error}`);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_ROOT_DIRECTORY,
    async (_, directoryPath: string) => {
      try {
        await directoryService.setRootDirectory(directoryPath);
        return createSuccessResponse(true);
      } catch (error) {
        return createErrorResponse(`Failed to set root directory: ${error}`);
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.GET_ROOT_DIRECTORY, async () => {
    try {
      const rootDirectory = directoryService.getCurrentDirectory();
      return createSuccessResponse(rootDirectory);
    } catch (error) {
      return createErrorResponse(`Failed to get root directory: ${error}`);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.GET_DIRECTORY_INFO,
    async (_, directoryPath?: string) => {
      try {
        const info = await directoryService.getDirectoryInfo(directoryPath);
        return createSuccessResponse(info);
      } catch (error) {
        return createErrorResponse(`Failed to get directory info: ${error}`);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_DIRECTORY_STATS,
    async (_, directoryPath?: string) => {
      try {
        const stats = await directoryService.getDirectoryStats(directoryPath);
        return createSuccessResponse(stats);
      } catch (error) {
        return createErrorResponse(`Failed to get directory stats: ${error}`);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.VALIDATE_DIRECTORY,
    async (_, directoryPath: string) => {
      try {
        const info = await directoryService.validateDirectory(directoryPath);
        return createSuccessResponse(info);
      } catch (error) {
        return createErrorResponse(`Failed to validate directory: ${error}`);
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.CLEAR_DIRECTORY, async () => {
    try {
      await directoryService.clearDirectory();
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to clear directory: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.START_WATCHING, async () => {
    try {
      await directoryService.startWatching();
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to start watching: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.STOP_WATCHING, async () => {
    try {
      await directoryService.stopWatching();
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(`Failed to stop watching: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.IS_WATCHING, async () => {
    try {
      const isWatching = directoryService.isWatching();
      return createSuccessResponse(isWatching);
    } catch (error) {
      return createErrorResponse(`Failed to check watching status: ${error}`);
    }
  });

  // Set up directory change event forwarding
  const unsubscribeFromDirectoryChanges = directoryService.onDirectoryChange(
    event => {
      // Send directory change events to all windows
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send(IPC_CHANNELS.DIRECTORY_CHANGED, event);
      });
    },
  );

  // Store the unsubscribe function for cleanup
  (global as any).__directoryChangeUnsubscribe =
    unsubscribeFromDirectoryChanges;

  // Event handlers (one-way communication)
  ipcMain.on(IPC_CHANNELS.RENDERER_READY, event => {
    console.log('Renderer process is ready');
    // Could emit an event back to renderer if needed
    event.reply('main:renderer-acknowledged');
  });

  console.log('IPC handlers registered successfully');
};

// Setup window event forwarding to renderer
export const setupWindowEventForwarding = (window: BrowserWindow): void => {
  window.on('focus', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW_FOCUS);
  });

  window.on('blur', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW_BLUR);
  });
};

// Cleanup IPC handlers
export const cleanupIpcHandlers = (): void => {
  // Cleanup directory change subscription
  if ((global as any).__directoryChangeUnsubscribe) {
    (global as any).__directoryChangeUnsubscribe();
    delete (global as any).__directoryChangeUnsubscribe;
  }

  // Remove all listeners for our channels
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeAllListeners(channel);
  });
  console.log('IPC handlers cleaned up');
};
