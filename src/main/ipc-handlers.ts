import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

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

  // Events (renderer to main)
  RENDERER_READY: 'renderer:ready',

  // Events (main to renderer)
  WINDOW_FOCUS: 'window:focus',
  WINDOW_BLUR: 'window:blur',
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
  // Remove all listeners for our channels
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeAllListeners(channel);
  });
  console.log('IPC handlers cleaned up');
};
