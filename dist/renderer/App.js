"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const DirectorySelector_1 = require("./components/DirectorySelector");
const SplitPane_1 = require("./components/SplitPane");
const FolderTree_1 = require("./components/FolderTree");
const ThumbnailGrid_1 = require("./components/ThumbnailGrid");
const PhotoDetail_1 = require("./components/PhotoDetail");
const App = () => {
    const [currentDirectory, setCurrentDirectory] = (0, react_1.useState)(null);
    const [stats, setStats] = (0, react_1.useState)({ imageCount: 0, duplicateCount: 0 });
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [view, setView] = (0, react_1.useState)('setup');
    // Browser state
    const [selectedFolderPath, setSelectedFolderPath] = (0, react_1.useState)(null);
    const [images, setImages] = (0, react_1.useState)([]);
    const [selectedImageIds, setSelectedImageIds] = (0, react_1.useState)(new Set());
    const [detailImagePath, setDetailImagePath] = (0, react_1.useState)(null);
    // Load initial directory and stats on component mount
    (0, react_1.useEffect)(() => {
        loadInitialData();
        setupFileEventListeners();
    }, []);
    // Switch to browser view when directory is set
    (0, react_1.useEffect)(() => {
        if (currentDirectory && currentDirectory.isValid) {
            setView('browser');
            setSelectedFolderPath(currentDirectory.path);
        }
        else {
            setView('setup');
        }
    }, [currentDirectory]);
    // Load images when folder selection changes
    (0, react_1.useEffect)(() => {
        if (selectedFolderPath) {
            loadImagesForFolder(selectedFolderPath);
        }
        else {
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
        }
        catch (err) {
            console.error('Failed to load initial data:', err);
            setError('Failed to load application data');
        }
        finally {
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
        }
        catch (err) {
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
    const loadImagesForFolder = async (folderPath) => {
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
            }
            else {
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
                }
                else {
                    console.log('Failed to get directory contents:', contentsResponse.error);
                    setImages([]);
                }
            }
        }
        catch (err) {
            console.error('Failed to load images:', err);
            setImages([]);
        }
    };
    const handleDirectorySelected = async (dirPath) => {
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
        }
        catch (err) {
            console.error('Failed to set directory:', err);
            setError(err instanceof Error ? err.message : 'Failed to set directory');
        }
        finally {
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
            }
            else {
                throw new Error(response.error || 'Failed to clear directory');
            }
        }
        catch (err) {
            console.error('Failed to clear directory:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear directory');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSelectFolder = (0, react_1.useCallback)((path) => {
        setSelectedFolderPath(path);
        setSelectedImageIds(new Set());
    }, []);
    const handleLoadFolderChildren = (0, react_1.useCallback)(async (path) => {
        try {
            const subdirs = await window.electronAPI.directory.getSubdirectories(path);
            if (!subdirs.success || !subdirs.data)
                return [];
            const nodes = [];
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
        }
        catch (err) {
            console.error('Failed to load folder children:', err);
            return [];
        }
    }, []);
    const handleSelectImage = (0, react_1.useCallback)((id, multiSelect) => {
        setSelectedImageIds(prev => {
            const next = new Set(multiSelect ? prev : []);
            if (next.has(id)) {
                next.delete(id);
            }
            else {
                next.add(id);
            }
            return next;
        });
    }, []);
    const handleDoubleClickImage = (0, react_1.useCallback)((id) => {
        const image = images.find(img => img.id === id);
        if (image) {
            setDetailImagePath(image.path);
        }
    }, [images]);
    const handleCloseDetail = (0, react_1.useCallback)(() => {
        setDetailImagePath(null);
    }, []);
    const handleNavigateDetail = (0, react_1.useCallback)((imagePath) => {
        setDetailImagePath(imagePath);
    }, []);
    const handleLoadThumbnail = (0, react_1.useCallback)(async (imagePath) => {
        try {
            const response = await window.electronAPI.thumbnail.getAsDataUrl(imagePath);
            if (response.success && response.data) {
                return response.data;
            }
            return '';
        }
        catch (err) {
            console.error('Failed to load thumbnail:', err);
            return '';
        }
    }, []);
    // Render setup view
    if (view === 'setup') {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-gray-100 p-5 text-gray-800", children: [(0, jsx_runtime_1.jsxs)("header", { className: "text-center mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Photo Management App" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "Electron + React + TypeScript" })] }), error && ((0, jsx_runtime_1.jsxs)("div", { className: "bg-red-500 text-white px-4 py-3 rounded-lg mb-5 flex justify-between items-center max-w-3xl mx-auto", children: [(0, jsx_runtime_1.jsx)("span", { children: error }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setError(null), className: "bg-transparent border-none text-white text-lg cursor-pointer px-1 hover:opacity-80", children: "x" })] })), (0, jsx_runtime_1.jsx)("main", { className: "max-w-3xl mx-auto", children: (0, jsx_runtime_1.jsx)(DirectorySelector_1.DirectorySelector, { currentDirectory: currentDirectory, onDirectorySelected: handleDirectorySelected, onClearDirectory: handleClearDirectory, isLoading: isLoading }) }), isLoading && ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 bg-black/50 flex flex-col items-center justify-center text-white", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" }), (0, jsx_runtime_1.jsx)("p", { children: "Processing..." })] }))] }));
    }
    // Render browser view
    return ((0, jsx_runtime_1.jsxs)("div", { className: "h-screen flex flex-col bg-gray-100", children: [(0, jsx_runtime_1.jsxs)("header", { className: "bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-gray-800", children: "Photo App" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-400", children: "|" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-500 truncate max-w-md", children: currentDirectory?.path })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-500", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-600", children: stats.imageCount }), " images", stats.duplicateCount > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "mx-2", children: "|" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-orange-500", children: stats.duplicateCount }), " duplicate groups"] }))] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setView('setup'), className: "text-sm text-gray-600 hover:text-gray-800", children: "Settings" })] })] }), error && ((0, jsx_runtime_1.jsxs)("div", { className: "bg-red-500 text-white px-4 py-2 flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { children: error }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setError(null), className: "hover:opacity-80", children: "x" })] })), (0, jsx_runtime_1.jsx)("main", { className: "flex-1 overflow-hidden", children: (0, jsx_runtime_1.jsx)(SplitPane_1.SplitPane, { leftPanel: (0, jsx_runtime_1.jsx)(FolderTree_1.FolderTree, { rootPath: currentDirectory?.path || null, selectedPath: selectedFolderPath, onSelectFolder: handleSelectFolder, onLoadChildren: handleLoadFolderChildren, className: "h-full" }), rightPanel: (0, jsx_runtime_1.jsxs)("div", { className: "h-full w-full bg-white", children: [(0, jsx_runtime_1.jsxs)("div", { className: "px-4 py-2 border-b border-gray-200 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: selectedFolderPath ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: images.length }), " images", selectedImageIds.size > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "ml-2 text-blue-600", children: ["(", selectedImageIds.size, " selected)"] }))] })) : ('Select a folder') }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2" })] }), (0, jsx_runtime_1.jsx)("div", { className: "h-[calc(100%-48px)] w-full", children: (0, jsx_runtime_1.jsx)(ThumbnailGrid_1.ThumbnailGrid, { images: images, selectedIds: selectedImageIds, onSelectImage: handleSelectImage, onDoubleClickImage: handleDoubleClickImage, onLoadThumbnail: handleLoadThumbnail }) })] }), defaultLeftWidth: 280, minLeftWidth: 200, maxLeftWidth: 400 }) }), isLoading && ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-50", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" }), (0, jsx_runtime_1.jsx)("p", { children: "Processing..." })] })), detailImagePath && ((0, jsx_runtime_1.jsx)(PhotoDetail_1.PhotoDetail, { imagePath: detailImagePath, allImages: images, onClose: handleCloseDetail, onNavigate: handleNavigateDetail }))] }));
};
exports.App = App;
//# sourceMappingURL=App.js.map