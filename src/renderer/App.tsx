import React, { useState, useEffect, useCallback } from 'react';
import { DirectorySelector } from './components/DirectorySelector';
import { SplitPane } from './components/SplitPane';
import { FolderNode } from './components/FolderTree';
import { Sidebar } from './components/Sidebar';
import { ThumbnailGrid, ImageItem } from './components/ThumbnailGrid';
import { PhotoDetail } from './components/PhotoDetail';
import { DuplicateReview } from './components/DuplicateReview';
import { QuickTagMenu } from './components/QuickTagMenu';
import { BatchActions } from './components/BatchActions';
import { AlbumManager } from './components/AlbumManager';

// Define the electronAPI interface for TypeScript
interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ScanProgress {
  phase: string;
  completed: number;
  total: number;
  currentFile?: string;
}

interface ScanResult {
  groups: Array<{
    hash: string;
    filesize: number;
    files: string[];
  }>;
  totalWastedBytes: number;
  totalDuplicateFiles: number;
  totalGroups: number;
}

// Tag and Album types
export interface Tag {
  id: number;
  name: string;
  color: string;
  created?: number;
}

export interface Album {
  id: number;
  name: string;
  description?: string;
  coverImageId?: number;
  created?: number;
  updated?: number;
}

export interface ImageRecord {
  id: number;
  path: string;
  filename: string;
  directory?: string;
  size?: number;
  modified?: number;
  hash?: string;
  width?: number;
  height?: number;
  dateTaken?: number;
  cameraMake?: string;
  cameraModel?: string;
}

interface ElectronAPI {
  openDirectory: () => Promise<IpcResponse<string>>;
  directory: {
    setRoot: (dirPath: string) => Promise<IpcResponse<any>>;
    getRoot: () => Promise<IpcResponse<any>>;
    clearRoot: () => Promise<IpcResponse<boolean>>;
    scan: (dirPath?: string) => Promise<IpcResponse<any>>;
    getContents: (dirPath: string) => Promise<IpcResponse<any[]>>;
    getSubdirectories: (dirPath: string) => Promise<IpcResponse<string[]>>;
    isValid: (dirPath: string) => Promise<IpcResponse<boolean>>;
    onFileAdded: (callback: (filePath: string) => void) => void;
    onFileRemoved: (callback: (filePath: string) => void) => void;
    onFileChanged: (callback: (filePath: string) => void) => void;
    onWatcherError: (callback: (error: string) => void) => void;
  };
  database: {
    getImageCount: () => Promise<IpcResponse<number>>;
    getDuplicateCount: () => Promise<IpcResponse<number>>;
    getImagesByDirectory: (directory: string) => Promise<IpcResponse<any[]>>;
  };
  thumbnail: {
    getAsDataUrl: (imagePath: string) => Promise<IpcResponse<string>>;
  };
  exif: {
    extract: (filepath: string) => Promise<IpcResponse<any>>;
  };
  trash: {
    getFileInfo: (filepath: string) => Promise<IpcResponse<{ size: number; modified: number }>>;
    trashFiles: (filepaths: string[]) => Promise<IpcResponse<{ successful: string[]; failed: any[] }>>;
  };
  duplicates: {
    scan: (dirPath: string, recursive: boolean) => Promise<IpcResponse<ScanResult>>;
    getStats: () => Promise<IpcResponse<{ totalGroups: number; totalWastedBytes: number; totalDuplicateFiles: number }>>;
    onProgress: (callback: (progress: ScanProgress) => void) => () => void;
  };
  shell: {
    openInFinder: (folderPath: string) => Promise<IpcResponse<boolean>>;
  };
  tags: {
    create: (name: string, color?: string) => Promise<IpcResponse<number>>;
    get: (id: number) => Promise<IpcResponse<Tag>>;
    getByName: (name: string) => Promise<IpcResponse<Tag>>;
    getAll: () => Promise<IpcResponse<Tag[]>>;
    update: (id: number, updates: { name?: string; color?: string }) => Promise<IpcResponse<void>>;
    delete: (id: number) => Promise<IpcResponse<void>>;
    addToImage: (imageId: number, tagId: number) => Promise<IpcResponse<void>>;
    removeFromImage: (imageId: number, tagId: number) => Promise<IpcResponse<void>>;
    getForImage: (imageId: number) => Promise<IpcResponse<Tag[]>>;
    getImages: (tagId: number) => Promise<IpcResponse<ImageRecord[]>>;
  };
  albums: {
    create: (name: string, description?: string) => Promise<IpcResponse<number>>;
    get: (id: number) => Promise<IpcResponse<Album>>;
    getAll: () => Promise<IpcResponse<Album[]>>;
    update: (id: number, updates: { name?: string; description?: string; coverImageId?: number }) => Promise<IpcResponse<void>>;
    delete: (id: number) => Promise<IpcResponse<void>>;
    addImage: (albumId: number, imageId: number, position?: number) => Promise<IpcResponse<void>>;
    removeImage: (albumId: number, imageId: number) => Promise<IpcResponse<void>>;
    getImages: (albumId: number) => Promise<IpcResponse<ImageRecord[]>>;
    getForImage: (imageId: number) => Promise<IpcResponse<Album[]>>;
    reorderImages: (albumId: number, imageIds: number[]) => Promise<IpcResponse<void>>;
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

type AppView = 'setup' | 'browser' | 'duplicates';

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
  const [detailImagePath, setDetailImagePath] = useState<string | null>(null);

  // Quick tag menu state
  const [quickTagMenu, setQuickTagMenu] = useState<{
    x: number;
    y: number;
    imageIds: number[];
  } | null>(null);

  // Manager modals state
  const [showAlbumManager, setShowAlbumManager] = useState(false);

  // Tag/Album filtering state
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

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

  // Load images when folder, tag, or album selection changes
  useEffect(() => {
    if (selectedTag) {
      loadImagesForTag(selectedTag.id);
    } else if (selectedAlbum) {
      loadImagesForAlbum(selectedAlbum.id);
    } else if (selectedFolderPath) {
      loadImagesForFolder(selectedFolderPath);
    } else {
      setImages([]);
    }
  }, [selectedFolderPath, selectedTag, selectedAlbum]);

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

  const loadImagesForTag = async (tagId: number) => {
    try {
      console.log('Loading images for tag:', tagId);
      const response = await window.electronAPI.tags.getImages(tagId);
      if (response.success && response.data) {
        console.log('Found', response.data.length, 'images for tag');
        setImages(response.data.map(img => ({
          id: img.id,
          path: img.path,
          filename: img.filename
        })));
      } else {
        setImages([]);
      }
    } catch (err) {
      console.error('Failed to load images for tag:', err);
      setImages([]);
    }
  };

  const loadImagesForAlbum = async (albumId: number) => {
    try {
      console.log('Loading images for album:', albumId);
      const response = await window.electronAPI.albums.getImages(albumId);
      if (response.success && response.data) {
        console.log('Found', response.data.length, 'images in album');
        setImages(response.data.map(img => ({
          id: img.id,
          path: img.path,
          filename: img.filename
        })));
      } else {
        setImages([]);
      }
    } catch (err) {
      console.error('Failed to load images for album:', err);
      setImages([]);
    }
  };

  const handleDirectorySelected = async (dirPath: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Set as root directory (this validates the directory internally)
      const setResponse = await window.electronAPI.directory.setRoot(dirPath);
      if (!setResponse.success) {
        throw new Error(setResponse.error || 'Failed to set root directory');
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
    const image = images.find(img => img.id === id);
    if (image) {
      setDetailImagePath(image.path);
    }
  }, [images]);

  const handleCloseDetail = useCallback(() => {
    setDetailImagePath(null);
  }, []);

  const handleNavigateDetail = useCallback((imagePath: string) => {
    setDetailImagePath(imagePath);
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

  // Refresh everything after files are deleted (stats + current folder images)
  const handleRefreshAfterDelete = useCallback(async () => {
    await loadStats();
    if (selectedFolderPath) {
      await loadImagesForFolder(selectedFolderPath);
    }
  }, [selectedFolderPath]);

  // Handle context menu (right-click) on thumbnails
  const handleContextMenu = useCallback((x: number, y: number, imageIds: number[]) => {
    setQuickTagMenu({ x, y, imageIds });
  }, []);

  // Handle tags changed from quick tag menu
  const handleQuickTagsChanged = useCallback(() => {
    // Force re-render of thumbnail grid to show updated tags
    // This is done by reloading the images which will trigger tag reload
    if (selectedFolderPath) {
      loadImagesForFolder(selectedFolderPath);
    }
  }, [selectedFolderPath]);

  // Clear all selected images
  const handleClearSelection = useCallback(() => {
    setSelectedImageIds(new Set());
  }, []);

  // Handle tag selection for filtering
  const handleSelectTag = useCallback((tag: Tag | null) => {
    setSelectedTag(tag);
    setSelectedAlbum(null);
    setSelectedImageIds(new Set());
  }, []);

  // Handle album selection for filtering
  const handleSelectAlbum = useCallback((album: Album | null) => {
    setSelectedAlbum(album);
    setSelectedTag(null);
    setSelectedImageIds(new Set());
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

  // Render duplicates view
  if (view === 'duplicates') {
    return (
      <div className="h-screen flex flex-col bg-gray-100">
        <DuplicateReview
          rootPath={currentDirectory?.path || null}
          currentFolderPath={selectedFolderPath}
          onBack={() => setView('browser')}
          onRefreshStats={handleRefreshAfterDelete}
          onLoadThumbnail={handleLoadThumbnail}
        />
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
            onClick={() => setShowAlbumManager(true)}
            className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          >
            Albums
          </button>

          <button
            onClick={() => setView('duplicates')}
            className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
          >
            Find Duplicates
          </button>

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
            <Sidebar
              rootPath={currentDirectory?.path || null}
              selectedFolderPath={selectedFolderPath}
              onSelectFolder={handleSelectFolder}
              onLoadFolderChildren={handleLoadFolderChildren}
              onSelectTag={handleSelectTag}
              onSelectAlbum={handleSelectAlbum}
              selectedTagId={selectedTag?.id || null}
              selectedAlbumId={selectedAlbum?.id || null}
              className="h-full"
            />
          }
          rightPanel={
            <div className="h-full w-full bg-white">
              {/* Toolbar */}
              <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedTag ? (
                    <>
                      <span
                        className="w-3 h-3 rounded-full inline-block mr-1"
                        style={{ backgroundColor: selectedTag.color }}
                      />
                      <span className="font-medium">{selectedTag.name}</span>
                      <span className="mx-1">-</span>
                      <span>{images.length}</span> images
                      {selectedImageIds.size > 0 && selectedImageIds.size < 2 && (
                        <span className="ml-2 text-blue-600">
                          ({selectedImageIds.size} selected)
                        </span>
                      )}
                    </>
                  ) : selectedAlbum ? (
                    <>
                      <span className="font-medium">{selectedAlbum.name}</span>
                      <span className="mx-1">-</span>
                      <span>{images.length}</span> images
                      {selectedImageIds.size > 0 && selectedImageIds.size < 2 && (
                        <span className="ml-2 text-blue-600">
                          ({selectedImageIds.size} selected)
                        </span>
                      )}
                    </>
                  ) : selectedFolderPath ? (
                    <>
                      <span className="font-medium">{images.length}</span> images
                      {selectedImageIds.size > 0 && selectedImageIds.size < 2 && (
                        <span className="ml-2 text-blue-600">
                          ({selectedImageIds.size} selected)
                        </span>
                      )}
                    </>
                  ) : (
                    'Select a folder, tag, or album'
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Clear filter button when tag or album selected */}
                  {(selectedTag || selectedAlbum) && (
                    <button
                      onClick={() => {
                        setSelectedTag(null);
                        setSelectedAlbum(null);
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Batch Actions Toolbar */}
              <BatchActions
                selectedIds={selectedImageIds}
                onClearSelection={handleClearSelection}
                onTagsChanged={handleQuickTagsChanged}
              />

              {/* Thumbnail Grid */}
              <div className={`w-full ${selectedImageIds.size >= 2 ? 'h-[calc(100%-88px)]' : 'h-[calc(100%-48px)]'}`}>
                <ThumbnailGrid
                  images={images}
                  selectedIds={selectedImageIds}
                  onSelectImage={handleSelectImage}
                  onDoubleClickImage={handleDoubleClickImage}
                  onLoadThumbnail={handleLoadThumbnail}
                  onContextMenu={handleContextMenu}
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

      {/* Photo Detail View */}
      {detailImagePath && (
        <PhotoDetail
          imagePath={detailImagePath}
          allImages={images}
          onClose={handleCloseDetail}
          onNavigate={handleNavigateDetail}
          onTagsChanged={handleQuickTagsChanged}
        />
      )}

      {/* Quick Tag Menu (context menu) */}
      {quickTagMenu && (
        <QuickTagMenu
          x={quickTagMenu.x}
          y={quickTagMenu.y}
          imageIds={quickTagMenu.imageIds}
          onClose={() => setQuickTagMenu(null)}
          onTagsChanged={handleQuickTagsChanged}
        />
      )}

      {/* Album Manager Modal */}
      <AlbumManager
        isOpen={showAlbumManager}
        onClose={() => setShowAlbumManager(false)}
        onAlbumsChanged={() => {}}
        onLoadThumbnail={handleLoadThumbnail}
      />
    </div>
  );
};
