import React, { useState, useEffect, useCallback } from 'react';
import { DirectorySelector } from './components/DirectorySelector';
import { SplitPane } from './components/SplitPane';
import { FolderTree, FolderNode } from './components/FolderTree';
import { ThumbnailGrid, ImageItem } from './components/ThumbnailGrid';

// Define the electronAPI interface for TypeScript
interface ElectronAPI {
  openDirectory: () => Promise<{ success: boolean; data?: string; error?: string }>;
  directory: {
    setRoot: (dirPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getRoot: () => Promise<{ success: boolean; data?: any; error?: string }>;
    clearRoot: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
    scan: (dirPath?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getContents: (dirPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getSubdirectories: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
    isValid: (dirPath: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
    onFileAdded: (callback: (filePath: string) => void) => void;
    onFileRemoved: (callback: (filePath: string) => void) => void;
    onFileChanged: (callback: (filePath: string) => void) => void;
    onWatcherError: (callback: (error: string) => void) => void;
  };
  database: {
    getImageCount: () => Promise<{ success: boolean; data?: number; error?: string }>;
    getDuplicateCount: () => Promise<{ success: boolean; data?: number; error?: string }>;
    getImagesByDirectory: (directory: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  };
  thumbnail: {
    getAsDataUrl: (imagePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
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

type AppView = 'setup' | 'browser';

export const App: React.FC = () => {
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryInfo | null>(null);
  const [stats, setStats] = useState<AppStats>({ imageCount: 0, duplicateCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('setup');

  // Browser state
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());

  // Load initial directory and stats on component mount
  useEffect(() => {
    loadInitialData();
    setupFileEventListeners();
  }, []);

  // Switch to browser view when directory is set
  useEffect(() => {
    if (currentDirectory && currentDirectory.isValid) {
      setView('browser');
      setSelectedFolderPath(currentDirectory.path);
    } else {
      setView('setup');
    }
  }, [currentDirectory]);

  // Load images when folder selection changes
  useEffect(() => {
    if (selectedFolderPath) {
      loadImagesForFolder(selectedFolderPath);
    } else {
      setImages([]);
    }
  }, [selectedFolderPath]);

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
    window.electronAPI.directory.onFileAdded(() => {
      loadStats();
      if (selectedFolderPath) {
        loadImagesForFolder(selectedFolderPath);
      }
    });

    window.electronAPI.directory.onFileRemoved(() => {
      loadStats();
      if (selectedFolderPath) {
        loadImagesForFolder(selectedFolderPath);
      }
    });

    window.electronAPI.directory.onWatcherError((error) => {
      console.error('Directory watcher error:', error);
      setError(`Directory watching error: ${error}`);
    });
  };

  const loadImagesForFolder = async (folderPath: string) => {
    try {
      console.log('Loading images for folder:', folderPath);

      // First try to get from database
      const dbResponse = await window.electronAPI.database.getImagesByDirectory(folderPath);
      console.log('Database response:', dbResponse);

      if (dbResponse.success && dbResponse.data && dbResponse.data.length > 0) {
        console.log('Found', dbResponse.data.length, 'images in database');
        setImages(dbResponse.data.map(img => ({
          id: img.id,
          path: img.path,
          filename: img.filename
        })));
      } else {
        // Fall back to directory contents
        console.log('Falling back to directory contents');
        const contentsResponse = await window.electronAPI.directory.getContents(folderPath);
        console.log('Directory contents response:', contentsResponse);

        if (contentsResponse.success && contentsResponse.data) {
          const imageFiles = contentsResponse.data.filter(file => file.isImage);
          console.log('Found', imageFiles.length, 'image files in directory');
          setImages(imageFiles.map((file, index) => ({
            id: index,
            path: file.path,
            filename: file.name
          })));
        } else {
          console.log('Failed to get directory contents:', contentsResponse.error);
          setImages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load images:', err);
      setImages([]);
    }
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
        setSelectedFolderPath(null);
        setImages([]);
        setSelectedImageIds(new Set());
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

  const handleSelectFolder = useCallback((path: string) => {
    setSelectedFolderPath(path);
    setSelectedImageIds(new Set());
  }, []);

  const handleLoadFolderChildren = useCallback(async (path: string): Promise<FolderNode[]> => {
    try {
      const subdirs = await window.electronAPI.directory.getSubdirectories(path);
      if (!subdirs.success || !subdirs.data) return [];

      const nodes: FolderNode[] = [];
      for (const subdirPath of subdirs.data) {
        const name = subdirPath.split('/').pop() || subdirPath;
        const contentsResponse = await window.electronAPI.directory.getContents(subdirPath);
        const imageCount = contentsResponse.success
          ? (contentsResponse.data || []).filter(f => f.isImage).length
          : 0;

        nodes.push({
          path: subdirPath,
          name,
          hasImages: imageCount > 0,
          imageCount,
          isLoaded: false,
          isExpanded: false,
          depth: 1
        });
      }

      return nodes;
    } catch (err) {
      console.error('Failed to load folder children:', err);
      return [];
    }
  }, []);

  const handleSelectImage = useCallback((id: number, multiSelect: boolean) => {
    setSelectedImageIds(prev => {
      const next = new Set(multiSelect ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDoubleClickImage = useCallback((id: number) => {
    // TODO: Open image detail view
    console.log('Open image:', id);
  }, []);

  const handleLoadThumbnail = useCallback(async (imagePath: string): Promise<string> => {
    try {
      const response = await window.electronAPI.thumbnail.getAsDataUrl(imagePath);
      if (response.success && response.data) {
        return response.data;
      }
      return '';
    } catch (err) {
      console.error('Failed to load thumbnail:', err);
      return '';
    }
  }, []);

  // Render setup view
  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-gray-100 p-5 text-gray-800">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Photo Management App</h1>
          <p className="text-sm text-gray-500">Electron + React + TypeScript</p>
        </header>

        {error && (
          <div className="bg-red-500 text-white px-4 py-3 rounded-lg mb-5 flex justify-between items-center max-w-3xl mx-auto">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="bg-transparent border-none text-white text-lg cursor-pointer px-1 hover:opacity-80"
            >
              x
            </button>
          </div>
        )}

        <main className="max-w-3xl mx-auto">
          <DirectorySelector
            currentDirectory={currentDirectory}
            onDirectorySelected={handleDirectorySelected}
            onClearDirectory={handleClearDirectory}
            isLoading={isLoading}
          />
        </main>

        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
            <p>Processing...</p>
          </div>
        )}
      </div>
    );
  }

  // Render browser view
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800">Photo App</h1>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm text-gray-500 truncate max-w-md">
            {currentDirectory?.path}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-blue-600">{stats.imageCount}</span> images
            {stats.duplicateCount > 0 && (
              <>
                <span className="mx-2">|</span>
                <span className="font-medium text-orange-500">{stats.duplicateCount}</span> duplicate groups
              </>
            )}
          </div>

          <button
            onClick={() => setView('setup')}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500 text-white px-4 py-2 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-80">x</button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <SplitPane
          leftPanel={
            <FolderTree
              rootPath={currentDirectory?.path || null}
              selectedPath={selectedFolderPath}
              onSelectFolder={handleSelectFolder}
              onLoadChildren={handleLoadFolderChildren}
              className="h-full"
            />
          }
          rightPanel={
            <div className="h-full w-full bg-white">
              {/* Toolbar */}
              <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedFolderPath ? (
                    <>
                      <span className="font-medium">{images.length}</span> images
                      {selectedImageIds.size > 0 && (
                        <span className="ml-2 text-blue-600">
                          ({selectedImageIds.size} selected)
                        </span>
                      )}
                    </>
                  ) : (
                    'Select a folder'
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* TODO: Add view mode toggle, sort options */}
                </div>
              </div>

              {/* Thumbnail Grid */}
              <div className="h-[calc(100%-48px)] w-full">
                <ThumbnailGrid
                  images={images}
                  selectedIds={selectedImageIds}
                  onSelectImage={handleSelectImage}
                  onDoubleClickImage={handleDoubleClickImage}
                  onLoadThumbnail={handleLoadThumbnail}
                />
              </div>
            </div>
          }
          defaultLeftWidth={280}
          minLeftWidth={200}
          maxLeftWidth={400}
        />
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-50">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
};
