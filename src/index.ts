import { app, BrowserWindow, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { setupIpcHandlers, setupDirectoryEventForwarding } from './main/ipc-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app - use Vite dev server in development, built files in production
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Open the DevTools (always open for debugging)
  mainWindow.webContents.openDevTools();
};

// Register custom protocol for serving local image files
// This must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'photo', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Register photo:// protocol handler to serve local files
  protocol.handle('photo', (request) => {
    // URL format: photo://localhost/path/to/file.jpg
    const url = new URL(request.url);
    // pathname includes the leading /, e.g., /Users/sbarstow/Pictures/file.jpg
    const filePath = decodeURIComponent(url.pathname);

    // Security check: ensure the path exists and is a file
    try {
      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return new Response('Not a file', { status: 400 });
      }

      // Use net.fetch to serve the file
      return net.fetch(`file://${filePath}`);
    } catch (error) {
      console.error('Protocol handler error:', error);
      return new Response('Error loading file', { status: 500 });
    }
  });

  // Setup IPC handlers
  setupIpcHandlers();
  setupDirectoryEventForwarding();

  // Create the main window
  createWindow();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});