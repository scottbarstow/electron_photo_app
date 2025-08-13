// IPC Types and Interface Definitions for Photo Management App

import {
  OpenDialogOptions,
  SaveDialogOptions,
  MessageBoxOptions,
} from 'electron';

// IPC Response wrapper
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// File system types
export interface FileInfo {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export interface FileExistsInfo {
  exists: boolean;
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number;
  modified?: Date;
}

// System information type
export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
}

// IPC Channel definitions
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

// Type-safe IPC API interface
export interface TypedElectronAPI {
  // App information methods
  getAppVersion(): Promise<IpcResponse<string>>;
  getAppPath(pathType: string): Promise<IpcResponse<string>>;

  // Dialog methods
  showOpenDialog(
    options?: Partial<OpenDialogOptions>,
  ): Promise<IpcResponse<Electron.OpenDialogReturnValue>>;
  showSaveDialog(
    options?: SaveDialogOptions,
  ): Promise<IpcResponse<Electron.SaveDialogReturnValue>>;
  showMessageBox(
    options: MessageBoxOptions,
  ): Promise<IpcResponse<Electron.MessageBoxReturnValue>>;

  // File system methods
  readFile(filePath: string): Promise<IpcResponse<string>>;
  writeFile(filePath: string, content: string): Promise<IpcResponse<boolean>>;
  checkFileExists(filePath: string): Promise<IpcResponse<FileExistsInfo>>;
  getDirectoryContents(dirPath: string): Promise<IpcResponse<FileInfo[]>>;

  // Window methods
  minimizeWindow(): Promise<IpcResponse<boolean>>;
  maximizeWindow(): Promise<IpcResponse<boolean>>;
  closeWindow(): Promise<IpcResponse<boolean>>;

  // System methods
  getSystemInfo(): Promise<IpcResponse<SystemInfo>>;

  // Directory methods
  selectDirectory(): Promise<IpcResponse<string | null>>;
  setRootDirectory(directoryPath: string): Promise<IpcResponse<boolean>>;
  getRootDirectory(): Promise<IpcResponse<string | null>>;
  getDirectoryInfo(
    directoryPath?: string,
  ): Promise<IpcResponse<DirectoryInfo | null>>;
  getDirectoryStats(
    directoryPath?: string,
  ): Promise<IpcResponse<DirectoryStats | null>>;
  validateDirectory(directoryPath: string): Promise<IpcResponse<DirectoryInfo>>;
  clearDirectory(): Promise<IpcResponse<boolean>>;
  startWatching(): Promise<IpcResponse<boolean>>;
  stopWatching(): Promise<IpcResponse<boolean>>;
  isWatching(): Promise<IpcResponse<boolean>>;
  onDirectoryChanged(
    callback: (event: DirectoryChangeEvent) => void,
  ): () => void;

  // Event methods
  notifyRendererReady(): void;
  onWindowFocus(callback: () => void): () => void;
  onWindowBlur(callback: () => void): () => void;

  // Generic IPC methods (for extensibility)
  invoke<T = any>(channel: string, ...args: any[]): Promise<T>;
  send(channel: string, ...args: any[]): void;
  on(channel: string, listener: (...args: any[]) => void): () => void;
}

// Helper type for IPC method parameters
export type IpcMethodParams<T extends keyof TypedElectronAPI> =
  TypedElectronAPI[T] extends (...args: infer P) => any ? P : never;

// Helper type for IPC method return types
export type IpcMethodReturn<T extends keyof TypedElectronAPI> =
  TypedElectronAPI[T] extends (...args: any[]) => infer R ? R : never;

// Photo app specific types (for future use)
export interface PhotoMetadata {
  path: string;
  name: string;
  size: number;
  width: number;
  height: number;
  format: string;
  dateCreated: Date;
  dateModified: Date;
  hash?: string;
  perceptualHash?: string;
}

export interface DuplicateGroup {
  id: string;
  files: PhotoMetadata[];
  duplicateType: 'exact' | 'similar';
  similarity?: number;
}

// Directory selection result
export interface DirectorySelectionResult {
  path: string;
  cancelled: boolean;
}

// Progress information for long-running operations
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
}

// Directory types
export interface DirectoryInfo {
  path: string;
  exists: boolean;
  accessible: boolean;
  isDirectory: boolean;
  lastChecked: string;
}

export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  imageFiles: number;
  lastScanned?: string;
}

export interface DirectoryChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: {
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    modified: Date;
  };
}
