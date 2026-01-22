"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ipc_handlers_1 = require("./main/ipc-handlers");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
const isDev = process.env.NODE_ENV !== 'production' && !electron_1.app.isPackaged;
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    }
    // Open the DevTools (always open for debugging)
    mainWindow.webContents.openDevTools();
};
// Register custom protocol for serving local image files
// This must be called before app is ready
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'photo', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
electron_1.app.whenReady().then(() => {
    // Register photo:// protocol handler to serve local files
    electron_1.protocol.handle('photo', (request) => {
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
            return electron_1.net.fetch(`file://${filePath}`);
        }
        catch (error) {
            console.error('Protocol handler error:', error);
            return new Response('Error loading file', { status: 500 });
        }
    });
    // Setup IPC handlers
    (0, ipc_handlers_1.setupIpcHandlers)();
    (0, ipc_handlers_1.setupDirectoryEventForwarding)();
    // Create the main window
    createWindow();
});
// Quit when all windows are closed, except on macOS.
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
//# sourceMappingURL=index.js.map