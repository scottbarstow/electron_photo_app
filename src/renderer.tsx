import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import {
  getAppInfo,
  selectDirectory,
  showInfo,
  notifyRendererReady,
  setupWindowEventListeners,
} from './renderer/ipc-helpers';

const App: React.FC = () => {
  const [appInfo, setAppInfo] = useState<{
    version: string;
    system: any;
  } | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(
    null,
  );
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  useEffect(() => {
    // Setup IPC communication
    const initializeApp = async () => {
      // Notify main process that renderer is ready
      notifyRendererReady();

      // Get app information
      const info = await getAppInfo();
      if (info) {
        setAppInfo(info);
      }
    };

    // Setup window event listeners
    const cleanupWindowEvents = setupWindowEventListeners();

    // Listen for custom window events
    const handleWindowFocus = () => setIsWindowFocused(true);
    const handleWindowBlur = () => setIsWindowFocused(false);

    document.addEventListener('window-focus', handleWindowFocus);
    document.addEventListener('window-blur', handleWindowBlur);

    initializeApp();

    // Cleanup on unmount
    return () => {
      cleanupWindowEvents();
      document.removeEventListener('window-focus', handleWindowFocus);
      document.removeEventListener('window-blur', handleWindowBlur);
    };
  }, []);

  const handleSelectDirectory = async () => {
    const directory = await selectDirectory('Select Photo Directory');
    if (directory) {
      setSelectedDirectory(directory);
      await showInfo(`Selected directory: ${directory}`, 'Directory Selected');
    }
  };

  const handleShowAppInfo = async () => {
    if (appInfo) {
      const infoText = `
        App Version: ${appInfo.version}
        Platform: ${appInfo.system.platform}
        Architecture: ${appInfo.system.arch}
        Electron: ${appInfo.system.electronVersion}
        Node.js: ${appInfo.system.nodeVersion}
      `;
      await showInfo(infoText, 'Application Information');
    }
  };

  return (
    <div className='app'>
      <header className='app-header'>
        <h1>Photo Management App</h1>
        <p>Welcome to your Electron + React + TypeScript application!</p>
        <div
          style={{
            padding: '10px',
            backgroundColor: isWindowFocused ? '#4CAF50' : '#9E9E9E',
            color: 'white',
            borderRadius: '4px',
            marginTop: '10px',
          }}
        >
          Window Status: {isWindowFocused ? 'Focused' : 'Not Focused'}
        </div>
      </header>
      <main className='app-main'>
        <div className='feature-grid'>
          <div className='feature-card'>
            <h3>📁 Browse Folders</h3>
            <p>Navigate through your photo directories with ease</p>
            <button
              onClick={handleSelectDirectory}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '10px',
              }}
            >
              Select Directory
            </button>
            {selectedDirectory && (
              <p style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                Selected: {selectedDirectory}
              </p>
            )}
          </div>
          <div className='feature-card'>
            <h3>🖼️ Preview Images</h3>
            <p>View your photos with zoom and navigation controls</p>
          </div>
          <div className='feature-card'>
            <h3>🔍 Find Duplicates</h3>
            <p>Automatically detect and manage duplicate photos</p>
          </div>
          <div className='feature-card'>
            <h3>ℹ️ App Information</h3>
            <p>View application and system information</p>
            <button
              onClick={handleShowAppInfo}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '10px',
              }}
            >
              Show App Info
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root element not found');
}
