import { BrowserWindow, screen, app } from 'electron';
import Store from 'electron-store';

// Window state interface
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

// Default window state
const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
  isFullScreen: false,
};

// Store for persistent window state
const windowStateStore = new Store<{ windowState: WindowState }>({
  name: 'window-state',
  defaults: {
    windowState: DEFAULT_WINDOW_STATE,
  },
});

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private windowState: WindowState;
  private isQuitting = false;

  constructor() {
    this.windowState = this.loadWindowState();
    this.setupAppEventHandlers();
  }

  /**
   * Create the main application window
   */
  createMainWindow(): BrowserWindow {
    // Ensure window fits on screen
    this.ensureWindowFitsScreen();

    // Prepare window options
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: this.windowState.width,
      height: this.windowState.height,
      minWidth: 800,
      minHeight: 600,
      show: false, // Don't show until ready-to-show
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    };

    // Add position if available
    if (this.windowState.x !== undefined && this.windowState.y !== undefined) {
      windowOptions.x = this.windowState.x;
      windowOptions.y = this.windowState.y;
    }

    // Add icon if available
    const icon = this.getAppIcon();
    if (icon) {
      windowOptions.icon = icon;
    }

    // Create the browser window
    this.mainWindow = new BrowserWindow(windowOptions);

    // Restore window state
    if (this.windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    if (this.windowState.isFullScreen) {
      this.mainWindow.setFullScreen(true);
    }

    // Setup window event handlers
    this.setupWindowEventHandlers();

    // Load the application
    this.loadApplication();

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();

      // Focus window on creation
      if (process.platform === 'darwin') {
        this.mainWindow?.focus();
      }
    });

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Close the main window
   */
  closeMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  /**
   * Toggle DevTools
   */
  toggleDevTools(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.toggleDevTools();
    }
  }

  /**
   * Reload the application
   */
  reloadApplication(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.reload();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullScreen(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const isFullScreen = this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(!isFullScreen);
    }
  }

  /**
   * Center window on screen
   */
  centerWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.center();
    }
  }

  /**
   * Load window state from persistent storage
   */
  private loadWindowState(): WindowState {
    const state = windowStateStore.get('windowState');
    return { ...DEFAULT_WINDOW_STATE, ...state };
  }

  /**
   * Save current window state to persistent storage
   */
  private saveWindowState(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const bounds = this.mainWindow.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: this.mainWindow.isMaximized(),
      isFullScreen: this.mainWindow.isFullScreen(),
    };

    windowStateStore.set('windowState', state);
  }

  /**
   * Ensure window fits within screen bounds
   */
  private ensureWindowFitsScreen(): void {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Ensure window isn't larger than screen
    if (this.windowState.width > screenWidth) {
      this.windowState.width = Math.floor(screenWidth * 0.9);
    }
    if (this.windowState.height > screenHeight) {
      this.windowState.height = Math.floor(screenHeight * 0.9);
    }

    // Ensure window is on screen
    if (this.windowState.x !== undefined && this.windowState.y !== undefined) {
      const displays = screen.getAllDisplays();
      let onScreen = false;

      for (const display of displays) {
        const { x, y, width, height } = display.bounds;
        if (
          this.windowState.x >= x &&
          this.windowState.x < x + width &&
          this.windowState.y >= y &&
          this.windowState.y < y + height
        ) {
          onScreen = true;
          break;
        }
      }

      if (!onScreen) {
        delete this.windowState.x;
        delete this.windowState.y;
      }
    }
  }

  /**
   * Get application icon path
   */
  private getAppIcon(): string | undefined {
    // For now, return undefined since we don't have icon files yet
    // This will be updated when we add actual icon files
    return undefined;

    // Future implementation:
    // if (process.platform === 'win32') {
    //   return path.join(__dirname, '../../assets/icon.ico');
    // } else if (process.platform === 'darwin') {
    //   return path.join(__dirname, '../../assets/icon.icns');
    // } else {
    //   return path.join(__dirname, '../../assets/icon.png');
    // }
  }

  /**
   * Load the application content
   */
  private loadApplication(): void {
    if (!this.mainWindow) return;

    if (MAIN_WINDOW_WEBPACK_ENTRY) {
      this.mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    }

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  /**
   * Setup window event handlers
   */
  private setupWindowEventHandlers(): void {
    if (!this.mainWindow) return;

    // Save state on window events
    this.mainWindow.on('resize', () => {
      if (!this.mainWindow?.isMaximized()) {
        this.saveWindowState();
      }
    });

    this.mainWindow.on('move', () => {
      if (!this.mainWindow?.isMaximized()) {
        this.saveWindowState();
      }
    });

    this.mainWindow.on('maximize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('unmaximize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('enter-full-screen', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('leave-full-screen', () => {
      this.saveWindowState();
    });

    // Handle window closing
    this.mainWindow.on('close', event => {
      if (process.platform === 'darwin' && !this.isQuitting) {
        // On macOS, hide window instead of closing
        event.preventDefault();
        this.mainWindow?.hide();
      } else {
        this.saveWindowState();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle unresponsive window
    this.mainWindow.on('unresponsive', () => {
      console.warn('Main window became unresponsive');
    });

    this.mainWindow.on('responsive', () => {
      console.log('Main window became responsive again');
    });
  }

  /**
   * Setup application event handlers
   */
  private setupAppEventHandlers(): void {
    // Handle app activation (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      } else if (this.mainWindow) {
        this.mainWindow.show();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      this.isQuitting = true;
      this.saveWindowState();
    });

    // Handle window all closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}

// Singleton instance
let windowManager: WindowManager | null = null;

/**
 * Get the window manager instance
 */
export const getWindowManager = (): WindowManager => {
  if (!windowManager) {
    windowManager = new WindowManager();
  }
  return windowManager;
};
