import { contextBridge, ipcRenderer } from 'electron';
import type { TypedElectronAPI } from './types/ipc';

// Import channels (we need to duplicate this since we can't import the actual object)
const CHANNELS = {
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

// Type-safe IPC API implementation
const electronAPI: TypedElectronAPI = {
  // App information methods
  getAppVersion: () => ipcRenderer.invoke(CHANNELS.GET_APP_VERSION),
  getAppPath: (pathType: string) =>
    ipcRenderer.invoke(CHANNELS.GET_APP_PATH, pathType),

  // Dialog methods
  showOpenDialog: (options = {}) =>
    ipcRenderer.invoke(CHANNELS.SHOW_OPEN_DIALOG, options),
  showSaveDialog: (options = {}) =>
    ipcRenderer.invoke(CHANNELS.SHOW_SAVE_DIALOG, options),
  showMessageBox: options =>
    ipcRenderer.invoke(CHANNELS.SHOW_MESSAGE_BOX, options),

  // File system methods
  readFile: (filePath: string) =>
    ipcRenderer.invoke(CHANNELS.READ_FILE, filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(CHANNELS.WRITE_FILE, filePath, content),
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke(CHANNELS.CHECK_FILE_EXISTS, filePath),
  getDirectoryContents: (dirPath: string) =>
    ipcRenderer.invoke(CHANNELS.GET_DIRECTORY_CONTENTS, dirPath),

  // Window methods
  minimizeWindow: () => ipcRenderer.invoke(CHANNELS.MINIMIZE_WINDOW),
  maximizeWindow: () => ipcRenderer.invoke(CHANNELS.MAXIMIZE_WINDOW),
  closeWindow: () => ipcRenderer.invoke(CHANNELS.CLOSE_WINDOW),

  // System methods
  getSystemInfo: () => ipcRenderer.invoke(CHANNELS.GET_SYSTEM_INFO),

  // Directory methods
  selectDirectory: () => ipcRenderer.invoke(CHANNELS.SELECT_DIRECTORY),
  setRootDirectory: (directoryPath: string) =>
    ipcRenderer.invoke(CHANNELS.SET_ROOT_DIRECTORY, directoryPath),
  getRootDirectory: () => ipcRenderer.invoke(CHANNELS.GET_ROOT_DIRECTORY),
  getDirectoryInfo: (directoryPath?: string) =>
    ipcRenderer.invoke(CHANNELS.GET_DIRECTORY_INFO, directoryPath),
  getDirectoryStats: (directoryPath?: string) =>
    ipcRenderer.invoke(CHANNELS.GET_DIRECTORY_STATS, directoryPath),
  validateDirectory: (directoryPath: string) =>
    ipcRenderer.invoke(CHANNELS.VALIDATE_DIRECTORY, directoryPath),
  clearDirectory: () => ipcRenderer.invoke(CHANNELS.CLEAR_DIRECTORY),
  startWatching: () => ipcRenderer.invoke(CHANNELS.START_WATCHING),
  stopWatching: () => ipcRenderer.invoke(CHANNELS.STOP_WATCHING),
  isWatching: () => ipcRenderer.invoke(CHANNELS.IS_WATCHING),
  onDirectoryChanged: (callback: (event: any) => void) => {
    const listener = (_: any, event: any) => callback(event);
    ipcRenderer.on(CHANNELS.DIRECTORY_CHANGED, listener);
    return () =>
      ipcRenderer.removeListener(CHANNELS.DIRECTORY_CHANGED, listener);
  },

  // Event methods
  notifyRendererReady: () => ipcRenderer.send(CHANNELS.RENDERER_READY),
  onWindowFocus: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(CHANNELS.WINDOW_FOCUS, listener);
    return () => ipcRenderer.removeListener(CHANNELS.WINDOW_FOCUS, listener);
  },
  onWindowBlur: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(CHANNELS.WINDOW_BLUR, listener);
    return () => ipcRenderer.removeListener(CHANNELS.WINDOW_BLUR, listener);
  },

  // Generic IPC methods (for extensibility)
  invoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// Expose the typed API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Expose a simplified electron object for easier access
contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => electronAPI.selectDirectory(),
  setRootDirectory: (path: string) => electronAPI.setRootDirectory(path),
  getRootDirectory: () => electronAPI.getRootDirectory(),
  getDirectoryInfo: (path?: string) => electronAPI.getDirectoryInfo(path),
  getDirectoryStats: (path?: string) => electronAPI.getDirectoryStats(path),
  validateDirectory: (path: string) => electronAPI.validateDirectory(path),
  clearDirectory: () => electronAPI.clearDirectory(),
  startWatching: () => electronAPI.startWatching(),
  stopWatching: () => electronAPI.stopWatching(),
  isWatching: () => electronAPI.isWatching(),
  onDirectoryChanged: (callback: (event: any) => void) =>
    electronAPI.onDirectoryChanged(callback),
});

// Log that preload script has loaded
console.log('Preload script loaded with typed IPC API');
