import { app } from 'electron';
import {
  setupIpcHandlers,
  setupWindowEventForwarding,
  cleanupIpcHandlers,
} from './main/ipc-handlers';
import { getWindowManager } from './main/window-manager';
import { getLogger } from './main/logger';
import { getDevTools } from './main/dev-tools';
import { initializeDatabase, closeDatabase } from './main/database';
import { initializeRepositories } from './main/repositories';
import {
  initializeDirectoryService,
  cleanupDirectoryService,
} from './main/directory-service';

// Initialize logger
const logger = getLogger();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  logger.info('App started via squirrel installer, quitting...');
  app.quit();
}

// Set app user model id for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.photoapp.desktop');
}

const createWindow = (): void => {
  logger.info('Creating main window...');

  try {
    // Create window using window manager
    const windowManager = getWindowManager();
    const mainWindow = windowManager.createMainWindow();

    // Set up window event forwarding to renderer
    setupWindowEventForwarding(mainWindow);

    logger.info('Main window created successfully');
  } catch (error) {
    logger.error('Failed to create main window', undefined, error as Error);
    throw error;
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught exception in main process', undefined, error);
  // Don't exit in development for better debugging
  if (process.env.NODE_ENV !== 'development') {
    app.quit();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection in main process', {
    reason,
    promise,
  });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  logger.info('Electron app ready, initializing...');

  try {
    // Initialize database first
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize repositories
    initializeRepositories();
    logger.info('Repositories initialized successfully');

    // Initialize directory service
    await initializeDirectoryService();
    logger.info('Directory service initialized successfully');

    // Set up IPC handlers before creating windows
    setupIpcHandlers();
    logger.info('IPC handlers set up successfully');

    // Initialize development tools
    const devTools = getDevTools();
    devTools.initialize();

    // Start performance monitoring in development
    if (process.env.NODE_ENV === 'development') {
      devTools.startPerformanceMonitoring();
    }

    // Create the main window
    createWindow();

    logger.info('Application initialization complete');
  } catch (error) {
    logger.error('Failed to initialize application', undefined, error as Error);
    app.quit();
  }
});

// Handle app activation (macOS specific behavior is handled in WindowManager)
app.on('activate', () => {
  logger.debug('App activated');
});

// Handle before quit
app.on('before-quit', async () => {
  logger.info('Application quitting...');

  try {
    // Clean up development tools
    const devTools = getDevTools();
    devTools.cleanup();

    // Clean up IPC handlers
    cleanupIpcHandlers();

    // Cleanup directory service
    await cleanupDirectoryService();
    logger.info('Directory service cleaned up');

    // Close database connection
    closeDatabase();
    logger.info('Database connection closed');

    // Flush logger
    await logger.flush();
  } catch (error) {
    logger.error('Error during app shutdown', undefined, error as Error);
  }
});

// Handle will quit
app.on('will-quit', () => {
  logger.info('Application will quit');
});

// Handle window all closed (macOS specific behavior is handled in WindowManager)
app.on('window-all-closed', () => {
  logger.debug('All windows closed');
});

// Handle certificate errors
app.on(
  'certificate-error',
  (event, _webContents, url, error, _certificate, callback) => {
    logger.warn('Certificate error', { url, error: error.toString() });

    // In development, you might want to ignore certificate errors
    if (process.env.NODE_ENV === 'development') {
      event.preventDefault();
      callback(true);
    } else {
      callback(false);
    }
  },
);

// Handle app ready for browser login (for OAuth flows)
app.on('login', (_event, _webContents, details, _authInfo, _callback) => {
  logger.info('Login requested', { details: details.url });
  // Handle authentication if needed
});

// Log app startup info
logger.info('Photo Management App starting...', {
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
});
