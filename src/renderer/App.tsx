import React, { useState, useEffect } from 'react';
import { DirectorySelector } from './components/DirectorySelector';

// Define the electronAPI interface for TypeScript
interface ElectronAPI {
  openDirectory: () => Promise<{ success: boolean; data?: string; error?: string }>;
  directory: {
    setRoot: (dirPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getRoot: () => Promise<{ success: boolean; data?: any; error?: string }>;
    clearRoot: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
    scan: (dirPath?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    isValid: (dirPath: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
    onFileAdded: (callback: (filePath: string) => void) => void;
    onFileRemoved: (callback: (filePath: string) => void) => void;
    onFileChanged: (callback: (filePath: string) => void) => void;
    onWatcherError: (callback: (error: string) => void) => void;
  };
  database: {
    getImageCount: () => Promise<{ success: boolean; data?: number; error?: string }>;
    getDuplicateCount: () => Promise<{ success: boolean; data?: number; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface DirectoryInfo {
  path: string;
  name: string;
  isValid: boolean;
  lastAccessed?: number;
}

interface AppStats {
  imageCount: number;
  duplicateCount: number;
  lastScanTime?: number;
}

export const App: React.FC = () => {
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryInfo | null>(null);
  const [stats, setStats] = useState<AppStats>({ imageCount: 0, duplicateCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileEvents, setFileEvents] = useState<string[]>([]);

  // Load initial directory and stats on component mount
  useEffect(() => {
    loadInitialData();
    setupFileEventListeners();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load current directory
      const dirResponse = await window.electronAPI.directory.getRoot();
      if (dirResponse.success && dirResponse.data) {
        setCurrentDirectory(dirResponse.data);
      }
      
      // Load database stats
      await loadStats();
      
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load application data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [imageCountResponse, duplicateCountResponse] = await Promise.all([
        window.electronAPI.database.getImageCount(),
        window.electronAPI.database.getDuplicateCount()
      ]);

      setStats({
        imageCount: imageCountResponse.success ? imageCountResponse.data || 0 : 0,
        duplicateCount: duplicateCountResponse.success ? duplicateCountResponse.data || 0 : 0,
        lastScanTime: Date.now()
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const setupFileEventListeners = () => {
    // Listen for file changes
    window.electronAPI.directory.onFileAdded((filePath) => {
      setFileEvents(prev => [...prev.slice(-9), `Added: ${filePath}`]);
      loadStats(); // Refresh stats when files change
    });

    window.electronAPI.directory.onFileRemoved((filePath) => {
      setFileEvents(prev => [...prev.slice(-9), `Removed: ${filePath}`]);
      loadStats();
    });

    window.electronAPI.directory.onFileChanged((filePath) => {
      setFileEvents(prev => [...prev.slice(-9), `Changed: ${filePath}`]);
    });

    window.electronAPI.directory.onWatcherError((error) => {
      console.error('Directory watcher error:', error);
      setError(`Directory watching error: ${error}`);
    });
  };

  const handleDirectorySelected = async (dirPath: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate directory
      const validResponse = await window.electronAPI.directory.isValid(dirPath);
      if (!validResponse.success || !validResponse.data) {
        throw new Error('Selected directory is not valid or accessible');
      }

      // Set as root directory
      const setResponse = await window.electronAPI.directory.setRoot(dirPath);
      if (!setResponse.success) {
        throw new Error(setResponse.error || 'Failed to set directory');
      }

      setCurrentDirectory(setResponse.data);

      // Start initial scan
      const scanResponse = await window.electronAPI.directory.scan();
      if (scanResponse.success) {
        console.log('Directory scan completed:', scanResponse.data);
      }

      // Refresh stats
      await loadStats();

    } catch (err) {
      console.error('Failed to set directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to set directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDirectory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await window.electronAPI.directory.clearRoot();
      if (response.success) {
        setCurrentDirectory(null);
        setStats({ imageCount: 0, duplicateCount: 0 });
        setFileEvents([]);
      } else {
        throw new Error(response.error || 'Failed to clear directory');
      }
    } catch (err) {
      console.error('Failed to clear directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear directory');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🗂️ Photo Management App</h1>
        <p style={styles.subtitle}>Clean Electron + React + TypeScript</p>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span>❌ {error}</span>
          <button 
            onClick={() => setError(null)}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>
      )}

      <main style={styles.main}>
        <DirectorySelector
          currentDirectory={currentDirectory}
          onDirectorySelected={handleDirectorySelected}
          onClearDirectory={handleClearDirectory}
          isLoading={isLoading}
        />

        {currentDirectory && (
          <div style={styles.statsSection}>
            <h3 style={styles.sectionTitle}>📊 Statistics</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{stats.imageCount}</div>
                <div style={styles.statLabel}>Images</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{stats.duplicateCount}</div>
                <div style={styles.statLabel}>Duplicate Groups</div>
              </div>
            </div>
            {stats.lastScanTime && (
              <p style={styles.lastScan}>
                Last updated: {new Date(stats.lastScanTime).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {fileEvents.length > 0 && (
          <div style={styles.eventsSection}>
            <h3 style={styles.sectionTitle}>📝 Recent File Events</h3>
            <div style={styles.eventsList}>
              {fileEvents.map((event, index) => (
                <div key={index} style={styles.eventItem}>
                  {event}
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner}></div>
            <p>Processing...</p>
          </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    color: '#333'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '30px'
  },
  title: {
    fontSize: '28px',
    margin: '0 0 10px 0',
    color: '#2c3e50'
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f8c8d',
    margin: 0
  },
  errorBanner: {
    backgroundColor: '#e74c3c',
    color: 'white',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px'
  },
  main: {
    maxWidth: '800px',
    margin: '0 auto',
    position: 'relative' as const
  },
  statsSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    margin: '0 0 16px 0',
    color: '#2c3e50'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  statCard: {
    textAlign: 'center' as const,
    padding: '16px',
    backgroundColor: '#ecf0f1',
    borderRadius: '6px'
  },
  statNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#7f8c8d',
    textTransform: 'uppercase' as const
  },
  lastScan: {
    fontSize: '12px',
    color: '#95a5a6',
    margin: 0,
    textAlign: 'center' as const
  },
  eventsSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  eventsList: {
    maxHeight: '200px',
    overflowY: 'auto' as const
  },
  eventItem: {
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    color: '#495057'
  },
  loadingOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  }
};