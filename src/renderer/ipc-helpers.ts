// IPC Helper functions for common operations in the renderer process

import type { IpcResponse } from '../types/ipc';

// Generic error handler for IPC responses
export const handleIpcResponse = <T>(
  response: IpcResponse<T>,
  errorMessage = 'Operation failed',
): T => {
  if (!response.success) {
    throw new Error(response.error || errorMessage);
  }
  return response.data!;
};

// Helper to safely execute IPC calls with error handling
export const safeIpcCall = async <T>(
  ipcCall: () => Promise<IpcResponse<T>>,
  defaultValue?: T,
  onError?: (error: Error) => void,
): Promise<T | undefined> => {
  try {
    const response = await ipcCall();
    return handleIpcResponse(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (onError) {
      onError(err);
    } else {
      console.error('IPC call failed:', err.message);
    }
    return defaultValue;
  }
};

// Directory selection helper
export const selectDirectory = async (
  title = 'Select Directory',
  defaultPath?: string,
): Promise<string | null> => {
  try {
    const options: Parameters<typeof window.electronAPI.showOpenDialog>[0] = {
      title,
      properties: ['openDirectory', 'createDirectory'],
    };

    if (defaultPath) {
      options.defaultPath = defaultPath;
    }

    const response = await window.electronAPI.showOpenDialog(options);
    const result = handleIpcResponse(response);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  } catch (error) {
    console.error('Failed to select directory:', error);
    return null;
  }
};

// File saving helper
export const saveFile = async (
  content: string,
  defaultPath?: string,
  filters?: Array<{ name: string; extensions: string[] }>,
): Promise<string | null> => {
  try {
    const options: Parameters<typeof window.electronAPI.showSaveDialog>[0] = {};

    if (defaultPath) {
      options.defaultPath = defaultPath;
    }

    if (filters) {
      options.filters = filters;
    }

    const response = await window.electronAPI.showSaveDialog(options);
    const result = handleIpcResponse(response);

    if (result.canceled || !result.filePath) {
      return null;
    }

    await window.electronAPI.writeFile(result.filePath, content);
    return result.filePath;
  } catch (error) {
    console.error('Failed to save file:', error);
    return null;
  }
};

// Show confirmation dialog
export const showConfirmation = async (
  message: string,
  title = 'Confirm',
  type: 'info' | 'warning' | 'error' | 'question' = 'question',
): Promise<boolean> => {
  try {
    const response = await window.electronAPI.showMessageBox({
      type,
      title,
      message,
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
    });

    const result = handleIpcResponse(response);
    return result.response === 0;
  } catch (error) {
    console.error('Failed to show confirmation dialog:', error);
    return false;
  }
};

// Show information message
export const showInfo = async (
  message: string,
  title = 'Information',
  type: 'info' | 'warning' | 'error' = 'info',
): Promise<void> => {
  try {
    await window.electronAPI.showMessageBox({
      type,
      title,
      message,
      buttons: ['OK'],
    });
  } catch (error) {
    console.error('Failed to show info dialog:', error);
  }
};

// Check if directory exists and is accessible
export const isDirectoryAccessible = async (path: string): Promise<boolean> => {
  try {
    const response = await window.electronAPI.checkFileExists(path);
    const result = handleIpcResponse(response);
    return result.exists && result.isDirectory === true;
  } catch (error) {
    console.error('Failed to check directory accessibility:', error);
    return false;
  }
};

// Get directory contents with error handling
export const getDirectoryContents = async (path: string) => {
  return safeIpcCall(
    () => window.electronAPI.getDirectoryContents(path),
    [],
    error =>
      console.error(`Failed to read directory "${path}":`, error.message),
  );
};

// Get app information
export const getAppInfo = async () => {
  try {
    const [versionResponse, systemResponse] = await Promise.all([
      window.electronAPI.getAppVersion(),
      window.electronAPI.getSystemInfo(),
    ]);

    return {
      version: handleIpcResponse(versionResponse),
      system: handleIpcResponse(systemResponse),
    };
  } catch (error) {
    console.error('Failed to get app info:', error);
    return null;
  }
};

// Window control helpers
export const windowControls = {
  minimize: () => safeIpcCall(() => window.electronAPI.minimizeWindow()),
  maximize: () => safeIpcCall(() => window.electronAPI.maximizeWindow()),
  close: () => safeIpcCall(() => window.electronAPI.closeWindow()),
};

// Setup window event listeners
export const setupWindowEventListeners = () => {
  const removeOnFocus = window.electronAPI.onWindowFocus(() => {
    document.dispatchEvent(new CustomEvent('window-focus'));
  });

  const removeOnBlur = window.electronAPI.onWindowBlur(() => {
    document.dispatchEvent(new CustomEvent('window-blur'));
  });

  // Return cleanup function
  return () => {
    removeOnFocus();
    removeOnBlur();
  };
};

// Notify main process that renderer is ready
export const notifyRendererReady = () => {
  try {
    window.electronAPI.notifyRendererReady();
  } catch (error) {
    console.error('Failed to notify renderer ready:', error);
  }
};

// Utility type for IPC error handling
export interface IpcError extends Error {
  ipcChannel?: string;
  originalError?: any;
}

// Create typed IPC error
export const createIpcError = (
  message: string,
  channel?: string,
  originalError?: any,
): IpcError => {
  const error = new Error(message) as IpcError;
  if (channel) {
    error.ipcChannel = channel;
  }
  if (originalError) {
    error.originalError = originalError;
  }
  return error;
};
