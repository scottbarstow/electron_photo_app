import { BrowserWindow, globalShortcut, dialog, shell } from 'electron';
import { getWindowManager } from './window-manager';
import { getLogger } from './logger';

const logger = getLogger();

export class DevTools {
  private shortcuts: Map<string, string> = new Map();

  /**
   * Initialize development tools and shortcuts
   */
  initialize(): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    logger.info('Initializing development tools...');
    this.registerGlobalShortcuts();
    this.setupDevMenu();
  }

  /**
   * Clean up development tools
   */
  cleanup(): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    logger.info('Cleaning up development tools...');
    this.unregisterGlobalShortcuts();
  }

  /**
   * Register global keyboard shortcuts for development
   */
  private registerGlobalShortcuts(): void {
    const shortcuts = [
      {
        accelerator: 'CommandOrControl+Shift+I',
        action: 'Toggle DevTools',
        handler: this.toggleDevTools.bind(this),
      },
      {
        accelerator: 'CommandOrControl+R',
        action: 'Reload Application',
        handler: this.reloadApplication.bind(this),
      },
      {
        accelerator: 'CommandOrControl+Shift+R',
        action: 'Force Reload Application',
        handler: this.forceReloadApplication.bind(this),
      },
      {
        accelerator: 'F11',
        action: 'Toggle Fullscreen',
        handler: this.toggleFullscreen.bind(this),
      },
      {
        accelerator: 'CommandOrControl+Shift+D',
        action: 'Show Debug Info',
        handler: this.showDebugInfo.bind(this),
      },
      {
        accelerator: 'CommandOrControl+Shift+L',
        action: 'Open Log Directory',
        handler: this.openLogDirectory.bind(this),
      },
      {
        accelerator: 'CommandOrControl+Shift+C',
        action: 'Clear Cache and Reload',
        handler: this.clearCacheAndReload.bind(this),
      },
    ];

    shortcuts.forEach(({ accelerator, action, handler }) => {
      try {
        const registered = globalShortcut.register(accelerator, handler);
        if (registered) {
          this.shortcuts.set(accelerator, action);
          logger.debug(`Registered shortcut: ${accelerator} - ${action}`);
        } else {
          logger.warn(
            `Failed to register shortcut: ${accelerator} - ${action}`,
          );
        }
      } catch (error) {
        logger.error(
          `Error registering shortcut ${accelerator}`,
          undefined,
          error as Error,
        );
      }
    });

    logger.info(`Registered ${this.shortcuts.size} development shortcuts`);
  }

  /**
   * Unregister all global shortcuts
   */
  private unregisterGlobalShortcuts(): void {
    this.shortcuts.forEach((action, accelerator) => {
      globalShortcut.unregister(accelerator);
      logger.debug(`Unregistered shortcut: ${accelerator} - ${action}`);
    });

    this.shortcuts.clear();
    globalShortcut.unregisterAll();
  }

  /**
   * Toggle DevTools for the focused window
   */
  private toggleDevTools(): void {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools();
      logger.debug('Toggled DevTools');
    }
  }

  /**
   * Reload the application
   */
  private reloadApplication(): void {
    const windowManager = getWindowManager();
    windowManager.reloadApplication();
    logger.info('Application reloaded');
  }

  /**
   * Force reload the application (ignoring cache)
   */
  private forceReloadApplication(): void {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.reloadIgnoringCache();
      logger.info('Application force reloaded');
    }
  }

  /**
   * Toggle fullscreen mode
   */
  private toggleFullscreen(): void {
    const windowManager = getWindowManager();
    windowManager.toggleFullScreen();
    logger.debug('Toggled fullscreen');
  }

  /**
   * Show debug information dialog
   */
  private async showDebugInfo(): Promise<void> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return;

    try {
      const webContents = focusedWindow.webContents;
      const debugInfo = {
        'Window ID': focusedWindow.id,
        URL: webContents.getURL(),
        Title: webContents.getTitle(),
        'User Agent': webContents.getUserAgent(),
        'Zoom Factor': webContents.getZoomFactor(),
        'DevTools Open': webContents.isDevToolsOpened(),
        Loading: webContents.isLoading(),
        Crashed: webContents.isCrashed(),
        'Process ID': webContents.getOSProcessId(),
        'Memory Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      };

      const message = Object.entries(debugInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      await dialog
        .showMessageBox(focusedWindow, {
          type: 'info',
          title: 'Debug Information',
          message: 'Application Debug Info',
          detail: message,
          buttons: ['OK', 'Copy to Clipboard'],
        })
        .then(result => {
          if (result.response === 1) {
            // Copy to clipboard using electron's clipboard
            import('electron').then(({ clipboard }) => {
              clipboard.writeText(message);
            });
          }
        });

      logger.debug('Showed debug info dialog');
    } catch (error) {
      logger.error('Failed to show debug info', undefined, error as Error);
    }
  }

  /**
   * Open log directory in file explorer
   */
  private async openLogDirectory(): Promise<void> {
    try {
      const logDir = logger.getLogDirectory();
      await shell.openPath(logDir);
      logger.debug('Opened log directory');
    } catch (error) {
      logger.error('Failed to open log directory', undefined, error as Error);
    }
  }

  /**
   * Clear cache and reload
   */
  private async clearCacheAndReload(): Promise<void> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return;

    try {
      const session = focusedWindow.webContents.session;
      await session.clearCache();
      await session.clearStorageData({
        storages: ['cookies', 'localstorage', 'websql', 'indexdb'],
      });

      focusedWindow.webContents.reload();
      logger.info('Cleared cache and reloaded application');

      // Show notification
      await dialog.showMessageBox(focusedWindow, {
        type: 'info',
        title: 'Cache Cleared',
        message:
          'Application cache has been cleared and the app has been reloaded.',
        buttons: ['OK'],
      });
    } catch (error) {
      logger.error('Failed to clear cache', undefined, error as Error);
    }
  }

  /**
   * Setup development menu (could be used for menu bar integration)
   */
  private setupDevMenu(): void {
    // This could be expanded to create an actual menu
    logger.debug('Development menu setup placeholder');
  }

  /**
   * Get list of registered shortcuts
   */
  getShortcuts(): Map<string, string> {
    return new Map(this.shortcuts);
  }

  /**
   * Enable/disable specific debugging features
   */
  setDebugMode(enabled: boolean): void {
    if (enabled) {
      // Enable additional debugging features
      process.env.DEBUG = '*';
      logger.setLevel(0); // Debug level
      logger.info('Debug mode enabled');
    } else {
      // Disable debugging features
      delete process.env.DEBUG;
      logger.setLevel(2); // Info level
      logger.info('Debug mode disabled');
    }
  }

  /**
   * Performance monitoring helper
   */
  startPerformanceMonitoring(): void {
    if (process.env.NODE_ENV !== 'development') return;

    setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      logger.debug('Performance metrics', {
        memory: {
          rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: `${Math.round(process.uptime())}s`,
      });
    }, 30000); // Log every 30 seconds
  }
}

// Singleton instance
let devTools: DevTools | null = null;

/**
 * Get the DevTools instance
 */
export const getDevTools = (): DevTools => {
  if (!devTools) {
    devTools = new DevTools();
  }
  return devTools;
};
