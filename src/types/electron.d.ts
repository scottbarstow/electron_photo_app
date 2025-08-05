// Enhanced Electron type definitions for better development experience

import type { TypedElectronAPI } from './ipc';

declare global {
  interface Window {
    electronAPI: TypedElectronAPI;
  }
  
  // Environment variables available in renderer process
  const NODE_ENV: string;
}

export {};